/**
 * War-state event detection. The CoC API is poll-only, so we compare the
 * previously-stored war snapshot with the freshly-polled one and emit an event
 * on each meaningful state transition.
 *
 * @typedef {{ state: "notInWar" }} NotInWar
 * @typedef {Object} ActiveWar
 * @property {"preparation"|"inWar"|"warEnded"} state
 * @property {number} [teamSize]
 * @property {string} [startTime]
 * @property {string} [endTime]
 * @property {{ name: string, tag: string, stars: number, destruction: number, attacks?: number }} clan
 * @property {{ name: string, tag: string, stars: number, destruction: number }} opponent
 * @typedef {NotInWar | ActiveWar} WarSnapshot
 * @typedef {"win"|"lose"|"tie"} WarResult
 * @typedef {{ type: "warPreparation"|"warStart"|"warEnd", war: WarSnapshot, result?: WarResult }} WarEvent
 */

/**
 * @param {WarSnapshot | null} prev
 * @param {WarSnapshot} curr
 * @returns {WarEvent[]}
 */
export function detectWarEvents(prev, curr) {
    // No baseline yet, or nothing changed — establish/keep state, announce nothing.
    if (!prev || prev.state === curr.state) return [];

    switch (curr.state) {
        case "preparation":
            return [{ type: "warPreparation", war: curr }];
        case "inWar":
            return [{ type: "warStart", war: curr }];
        case "warEnded":
            return [{ type: "warEnd", war: curr, result: computeWarResult(curr) }];
        default:
            return []; // -> notInWar: nothing to announce
    }
}

/**
 * Standard CoC war result: more stars wins; ties break on destruction %.
 *
 * @param {WarSnapshot} war
 * @returns {WarResult}
 */
export function computeWarResult(war) {
    if (war.state === "notInWar") return "tie";
    const { clan, opponent } = war;
    if (clan.stars !== opponent.stars) return clan.stars > opponent.stars ? "win" : "lose";
    if (clan.destruction !== opponent.destruction) {
        return clan.destruction > opponent.destruction ? "win" : "lose";
    }
    return "tie";
}
