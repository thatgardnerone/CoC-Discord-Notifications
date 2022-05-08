import { Clans } from "./components/clans.js";
import { Esports } from "./components/esports.js";
import { Goldpass } from "./components/goldpass.js";
import { Labels } from "./components/labels.js";
import { Leagues } from "./components/leagues.js";
import { Locations } from "./components/locations.js";
import { Players } from "./components/players.js";

export class CoC {
    constructor() {
    }

    clans(clanTag) {
        return new Clans(clanTag);
    }

    get esports() {
        return new Esports();
    }

    get goldpass() {
        return new Goldpass();
    }

    get labels() {
        return new Labels();
    }

    get leagues() {
        return new Leagues();
    }

    get locations() {
        return new Locations();
    }

    get players() {
        return new Players();
    }
}