import { describe, it, expect, vi } from "vitest";
import { createCocClient, HttpError, parseRetryAfterSeconds } from "../src/coc/http.js";

/** A sleep spy that records the delays requested without actually waiting. */
function fakeSleep() {
    /** @type {number[]} */
    const calls = [];
    const sleep = vi.fn((/** @type {number} */ ms) => {
        calls.push(ms);
        return Promise.resolve();
    });
    return { sleep, calls };
}

/**
 * Build a minimal fetch Response stand-in.
 * @param {number} status
 * @param {any} body
 * @param {Record<string, string>} [headers]
 */
function makeRes(status, body, headers = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (/** @type {string} */ k) => headers[k.toLowerCase()] ?? null,
            forEach: (/** @type {(v: string, k: string) => void} */ cb) =>
                Object.entries(headers).forEach(([k, v]) => cb(String(v), k)),
        },
        json: async () => body,
    };
}

const ok = { status: 200, data: { name: "Breakfast Foods" }, headers: {} };

describe("createCocClient — retry policy (injected transport)", () => {
    it("returns the response on first success without retrying", async () => {
        const transport = vi.fn().mockResolvedValue(ok);
        const { sleep } = fakeSleep();
        const client = createCocClient({ transport, sleep });

        const res = await client.get("clans/%23PVVY8L2L");

        expect(res.data.name).toBe("Breakfast Foods");
        expect(transport).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it("retries server errors, then succeeds (jitter: random=1 → full exponential)", async () => {
        const transport = vi
            .fn()
            .mockRejectedValueOnce(new HttpError(500))
            .mockRejectedValueOnce(new HttpError(503))
            .mockResolvedValue(ok);
        const { sleep, calls } = fakeSleep();
        const client = createCocClient({ transport, sleep, backoffBaseMs: 500, random: () => 1 });

        await client.get("clans/x");

        expect(transport).toHaveBeenCalledTimes(3);
        expect(calls).toEqual([500, 1000]); // full exp: 500·2^0, 500·2^1
    });

    it("applies equal jitter (random=0 → half exponential)", async () => {
        const transport = vi
            .fn()
            .mockRejectedValueOnce(new HttpError(500))
            .mockRejectedValueOnce(new HttpError(500))
            .mockResolvedValue(ok);
        const { sleep, calls } = fakeSleep();
        const client = createCocClient({ transport, sleep, backoffBaseMs: 500, random: () => 0 });

        await client.get("clans/x");

        expect(calls).toEqual([250, 500]); // half of 500, half of 1000
    });

    it("caps any single delay at maxBackoffMs (defends against huge Retry-After)", async () => {
        const transport = vi
            .fn()
            .mockRejectedValueOnce(new HttpError(429, { retryAfterSeconds: 100000 }))
            .mockResolvedValue(ok);
        const { sleep, calls } = fakeSleep();
        const client = createCocClient({ transport, sleep, maxBackoffMs: 30000 });

        await client.get("clans/x");

        expect(calls).toEqual([30000]);
    });

    it("gives up after the retry budget on persistent errors", async () => {
        const transport = vi.fn().mockRejectedValue(new HttpError(503));
        const { sleep } = fakeSleep();
        const client = createCocClient({ transport, sleep, retries: 2 });

        await expect(client.get("clans/x")).rejects.toBeInstanceOf(HttpError);
        expect(transport).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("does not retry client errors (4xx)", async () => {
        const transport = vi.fn().mockRejectedValue(new HttpError(403));
        const { sleep } = fakeSleep();
        const client = createCocClient({ transport, sleep });

        await expect(client.get("clans/x")).rejects.toMatchObject({ status: 403 });
        expect(transport).toHaveBeenCalledTimes(1);
    });

    it("retries 408/425 and network (status 0) errors", async () => {
        for (const status of [408, 425, 0]) {
            const transport = vi
                .fn()
                .mockRejectedValueOnce(new HttpError(status))
                .mockResolvedValue(ok);
            const { sleep } = fakeSleep();
            const client = createCocClient({ transport, sleep, random: () => 1 });
            await client.get("clans/x");
            expect(transport).toHaveBeenCalledTimes(2);
        }
    });

    it("honours Retry-After (seconds) as the delay", async () => {
        const transport = vi
            .fn()
            .mockRejectedValueOnce(new HttpError(429, { retryAfterSeconds: 2 }))
            .mockResolvedValue(ok);
        const { sleep, calls } = fakeSleep();
        const client = createCocClient({ transport, sleep });

        await client.get("clans/x");

        expect(calls).toEqual([2000]);
    });
});

describe("createCocClient — real fetch transport", () => {
    it("sends bearer auth to the encoded URL and returns parsed data", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(makeRes(200, { name: "Breakfast Foods" }));
        const { sleep } = fakeSleep();
        const client = createCocClient({ token: "test-token", fetchImpl, sleep });

        const res = await client.get("clans/%23PVVY8L2L");

        expect(res.data.name).toBe("Breakfast Foods");
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toContain("/v1/clans/%23PVVY8L2L");
        expect(init.headers.Authorization).toBe("Bearer test-token");
    });

    it("normalises a 5xx response into HttpError", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(makeRes(500, { reason: "boom" }));
        const { sleep } = fakeSleep();
        const client = createCocClient({ fetchImpl, sleep, retries: 0 });

        await expect(client.get("clans/x")).rejects.toMatchObject({ status: 500 });
    });

    it("normalises a network failure into HttpError(status 0)", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
        const { sleep } = fakeSleep();
        const client = createCocClient({ fetchImpl, sleep, retries: 0 });

        await expect(client.get("clans/x")).rejects.toMatchObject({ status: 0 });
    });

    it("parses a Retry-After HTTP-date header without busy-looping (regression)", async () => {
        const future = new Date(Date.now() + 5000).toUTCString();
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(makeRes(503, {}, { "retry-after": future }))
            .mockResolvedValue(makeRes(200, {}));
        const { sleep, calls } = fakeSleep();
        const client = createCocClient({ fetchImpl, sleep });

        await client.get("clans/x");

        expect(calls).toHaveLength(1);
        expect(calls[0]).toBeGreaterThan(1000); // NOT 0ms — the bug this guards against
        expect(calls[0]).toBeLessThanOrEqual(5000);
    });
});

describe("parseRetryAfterSeconds", () => {
    it("parses delta-seconds", () => {
        expect(parseRetryAfterSeconds("30")).toBe(30);
    });
    it("parses an HTTP-date into remaining seconds", () => {
        const secs = parseRetryAfterSeconds(new Date(Date.now() + 10000).toUTCString());
        expect(secs).toBeGreaterThan(5);
        expect(secs).toBeLessThanOrEqual(10);
    });
    it("returns undefined for missing or unparseable values", () => {
        expect(parseRetryAfterSeconds(null)).toBeUndefined();
        expect(parseRetryAfterSeconds("")).toBeUndefined();
        expect(parseRetryAfterSeconds("not-a-date")).toBeUndefined();
    });
});
