/**
 * War-state event detection. The CoC API is poll-only, so we compare the
 * previously-stored war snapshot with the freshly-polled one and emit an event
 * on each meaningful state transition.
 *
 * @typedef {{ order: number, attackerTag: string, defenderTag: string, stars: number, destructionPercentage: number }} WarAttack
 * @typedef {{ tag: string, name: string, mapPosition: number, townhallLevel: number, attacks: WarAttack[] }} WarMember
 * @typedef {{ name: string, tag: string, stars: number, destruction: number, members: WarMember[] }} WarSide
 * @typedef {{ state: "notInWar" }} NotInWar
 * @typedef {{ state: "preparation"|"inWar"|"warEnded", teamSize?: number, attacksPerMember?: number, startTime?: string, endTime?: string, clan: WarSide, opponent: WarSide }} ActiveWar
 * @typedef {NotInWar | ActiveWar} WarSnapshot
 * @typedef {"win"|"lose"|"tie"} WarResult
 * @typedef {{ type: "warPreparation"|"warStart"|"warEnd", war: ActiveWar, result?: WarResult }} WarEvent
 * @typedef {{ order: number, side: "clan"|"opponent", attackerTag: string, attackerName: string, defenderTag: string, stars: number, destructionPercentage: number }} LoggedAttack
 * @typedef {{ tag: string, name: string, used: number, of: number }} MissedAttacker
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

/**
 * New attacks in `curr` not present in `prev`, across both sides, keyed by the
 * war-global attack `order`. Only call this for the same ongoing war (i.e.
 * prev.state === "inWar"), otherwise every attack looks new.
 *
 * @param {ActiveWar} prev
 * @param {ActiveWar} curr
 * @returns {LoggedAttack[]}
 */
export function detectNewAttacks(prev, curr) {
    const seen = new Set(collectAttacks(prev).map((a) => a.order));
    return collectAttacks(curr)
        .filter((a) => !seen.has(a.order))
        .sort((a, b) => a.order - b.order);
}

/**
 * @param {ActiveWar} war
 * @returns {LoggedAttack[]}
 */
function collectAttacks(war) {
    /** @type {LoggedAttack[]} */
    const out = [];
    for (const side of /** @type {("clan"|"opponent")[]} */ (["clan", "opponent"])) {
        for (const member of war[side].members) {
            for (const attack of member.attacks) {
                out.push({
                    order: attack.order,
                    side,
                    attackerTag: member.tag,
                    attackerName: member.name,
                    defenderTag: attack.defenderTag,
                    stars: attack.stars,
                    destructionPercentage: attack.destructionPercentage,
                });
            }
        }
    }
    return out;
}

/**
 * Our clan members who used fewer than the allowed number of attacks.
 *
 * @param {ActiveWar} war
 * @returns {MissedAttacker[]}
 */
export function computeMissedAttacks(war) {
    const of = war.attacksPerMember ?? 2;
    return war.clan.members
        .map((member) => ({ tag: member.tag, name: member.name, used: member.attacks.length, of }))
        .filter((member) => member.used < member.of);
}
