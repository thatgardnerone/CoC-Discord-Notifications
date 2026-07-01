import { describe, it, expect, vi } from "vitest";
import { createCocClient, HttpError } from "../src/coc/http.js";

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

const ok = { status: 200, data: { name: "Breakfast Foods" }, headers: {} };

describe("createCocClient (retry/backoff behaviour)", () => {
    it("returns the response on first success without retrying", async () => {
        const transport = vi.fn().mockResolvedValue(ok);
        const { sleep } = fakeSleep();
        const client = createCocClient({ transport, sleep });

        const res = await client.get("clans/%23PVVY8L2L");

        expect(res.data.name).toBe("Breakfast Foods");
        expect(transport).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
    });

    it("retries server errors with exponential backoff, then succeeds", async () => {
        const transport = vi
            .fn()
            .mockRejectedValueOnce(new HttpError(500))
            .mockRejectedValueOnce(new HttpError(503))
            .mockResolvedValue(ok);
        const { sleep, calls } = fakeSleep();
        const client = createCocClient({ transport, sleep, backoffBaseMs: 500 });

        const res = await client.get("clans/x");

        expect(res.data.name).toBe("Breakfast Foods");
        expect(transport).toHaveBeenCalledTimes(3);
        expect(calls).toEqual([500, 1000]); // 500·2^0, 500·2^1
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
        expect(sleep).not.toHaveBeenCalled();
    });

    it("retries network/timeout errors (non-HTTP)", async () => {
        const transport = vi
            .fn()
            .mockRejectedValueOnce(new Error("ECONNRESET"))
            .mockResolvedValue(ok);
        const { sleep } = fakeSleep();
        const client = createCocClient({ transport, sleep });

        const res = await client.get("clans/x");

        expect(res.status).toBe(200);
        expect(transport).toHaveBeenCalledTimes(2);
    });

    it("honours the Retry-After header on 429", async () => {
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
