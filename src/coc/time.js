/**
 * Parses CoC's compact ISO-8601 timestamps (e.g. "20260701T120000.000Z", which
 * `Date.parse` won't accept) into unix seconds, for Discord `<t:...>` rendering.
 *
 * @param {string | null | undefined} value
 * @returns {number | null}
 */
export function cocTimeToUnix(value) {
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value ?? "");
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match;
    return Math.floor(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) / 1000);
}
