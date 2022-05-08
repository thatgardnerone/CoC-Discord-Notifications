// Access clan specific information
import { client } from "../client.js";

export class Clans {

    constructor(clanTag) {
        this.clanTag = clanTag.replace("#", "%23");
    }

    search(query) {
        const validParams = [
            "name",
            "warFrequency",
            "locationId",
            "minMembers",
            "maxMembers",
            "minClanPoints",
            "minClanLevel",
            "limit",
            "after",
            "before",
            "labelIds",
        ];

        let queryParams = [];
        Object.values(query).map((param) => {
            if (validParams.includes(param)) {
                queryParams.push(param);
            }
        });

        const queryString = queryParams.join("&");

        return client.get("clans?" + queryString);
    }

    leagueWar(warTag) {
        return client.get("clanwarleagues/wars/" + warTag);
    }

    get currentWar() {
        return client.get("clans/" + this.clanTag + "/currentwar");
    }

    get info() {
        return client.get("clans/" + this.clanTag);
    }

    get leagueGroup() {
        return client.get("clans/" + this.clanTag + "/currentwar/leaguegroup");
    }

    get members() {
        return client.get("clans/" + this.clanTag + "/members");
    }

    get warLog() {
        return client.get("clans/" + this.clanTag + "/warlog");
    }

}