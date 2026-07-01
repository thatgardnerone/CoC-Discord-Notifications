/**
 * Generic snapshot diffing. Since the CoC API is poll-only, every notification
 * is derived by comparing the previous snapshot with the current one. These
 * primitives are the shared basis for member join/leave, role/TH changes, war
 * attacks, donation deltas, etc.
 */

/**
 * Compares two collections by a stable key.
 *
 * `common` holds every item present in both snapshots (paired before/after) —
 * callers decide which field changes are noteworthy via {@link changedFields},
 * avoiding false positives from ever-changing fields like donations.
 *
 * An empty `prev` yields all-added and nothing removed, so a first run (no
 * baseline) never emits spurious "left" events.
 *
 * Precondition: `keyFn` must be unique within each snapshot. Collisions collapse
 * (last-wins) with no signal, so callers must key on something unique (member
 * tag, war attack order) — never a repeated field.
 *
 * @template T
 * @param {T[]} prev
 * @param {T[]} curr
 * @param {(item: T) => string} keyFn
 * @returns {{ added: T[], removed: T[], common: Array<{ before: T, after: T }> }}
 */
export function diffBy(prev, curr, keyFn) {
    const prevMap = new Map(prev.map((item) => [keyFn(item), item]));
    const currMap = new Map(curr.map((item) => [keyFn(item), item]));

    /** @type {T[]} */
    const added = [];
    /** @type {T[]} */
    const removed = [];
    /** @type {Array<{ before: T, after: T }>} */
    const common = [];

    for (const [key, after] of currMap) {
        const before = prevMap.get(key);
        if (before === undefined) added.push(after);
        else common.push({ before, after });
    }
    for (const [key, before] of prevMap) {
        if (!currMap.has(key)) removed.push(before);
    }

    return { added, removed, common };
}

/**
 * Returns the subset of watched fields whose value differs between two versions
 * of the same item. Comparison is shallow (`!==`), so watch primitive fields —
 * an object/array field will always report as changed.
 *
 * @template {object} T
 * @param {T} before
 * @param {T} after
 * @param {(keyof T)[]} fields
 * @returns {(keyof T)[]}
 */
export function changedFields(before, after, fields) {
    return fields.filter((field) => before[field] !== after[field]);
}
