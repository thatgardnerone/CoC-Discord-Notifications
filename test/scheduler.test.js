import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createScheduler } from "../src/scheduler.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("scheduler", () => {
    it("runs a task immediately and then every interval", async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        const s = createScheduler();
        s.every(10, task);

        expect(task).toHaveBeenCalledTimes(1); // immediate
        await vi.advanceTimersByTimeAsync(10_000);
        expect(task).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(20_000);
        expect(task).toHaveBeenCalledTimes(4);
        s.stop();
    });

    it("can skip the immediate run", async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        const s = createScheduler();
        s.every(10, task, { runImmediately: false });

        expect(task).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(task).toHaveBeenCalledTimes(1);
        s.stop();
    });

    it("isolates failures: a throwing task keeps its schedule and reports via onError", async () => {
        const onError = vi.fn();
        const bad = vi.fn().mockRejectedValue(new Error("boom"));
        const s = createScheduler({ onError });
        s.every(5, bad);

        await vi.advanceTimersByTimeAsync(0); // flush the immediate run's rejection
        expect(bad).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(bad).toHaveBeenCalledTimes(2); // still scheduled despite throwing
        expect(onError).toHaveBeenCalledTimes(2);
        s.stop();
    });

    it("skips a tick if the previous run is still in flight (no pile-up)", async () => {
        /** @type {() => void} */
        let release = () => {};
        const task = vi.fn(
            () =>
                new Promise((resolve) => {
                    release = () => resolve(undefined);
                }),
        );
        const s = createScheduler();
        s.every(10, task);

        expect(task).toHaveBeenCalledTimes(1); // in flight
        await vi.advanceTimersByTimeAsync(10_000);
        expect(task).toHaveBeenCalledTimes(1); // tick skipped — still running
        release();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(task).toHaveBeenCalledTimes(2);
        s.stop();
    });

    it("stop() halts all further runs", async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        const s = createScheduler();
        s.every(10, task, { runImmediately: false });

        await vi.advanceTimersByTimeAsync(10_000);
        expect(task).toHaveBeenCalledTimes(1);
        s.stop();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(task).toHaveBeenCalledTimes(1);
    });
});
