# CoC → Discord Bot — Research & Plan

> Product & architecture plan for the clan Discord bot. The living backlog lives in the
> **[CoC Discord Bot GitHub Project](https://github.com/users/thatgardnerone/projects/9)**;
> this document is the durable "why" behind it.

## 1. The constraint that shapes everything

The official API (`https://api.clashofclans.com/v1`) is **poll-only and IP-locked**:

- **No webhooks / no push / no event stream.** Every "notification" (war started, member
  left, attack made) is produced by *polling on an interval and diffing snapshots against
  stored state*. → We need a datastore and a snapshot/diff engine, not just a stateless bot.
- **Tokens are bound to a fixed IP** (~10 req/s per token). A key only works from the IP it
  was created for. On dynamic-IP hosts you must log into the developer portal at runtime to
  mint per-IP keys (the "coc.py / ClashKing" email+password pattern).
- **Latency is minutes, not seconds.** Fine for war/CWL/donation/join-leave; "live" attack
  logs are as fresh as the poll cadence, never instant.
- **Notable gaps:** **Clan Games has no endpoint** — points are inferred by diffing the
  "Games Champion" achievement. No ongoing legend-league per-attack feed (daily-summary
  grade only).

### Hosting decision (chosen) — app03.tgo.dev

**Static-IP VPS: `app03.tgo.dev`** (Ubuntu 24.04, Node v22, Postgres 18 + Redis running).
Simplest correct option: mint one IP-locked token for the host, run a long-lived Node
process, use SQLite for poll/diff state. Avoids the runtime token-minting complexity that
dynamic-IP hosts (Cloudflare Workers, most PaaS) would force.

- 🔑 **Egress public IP = `161.97.139.3`** — mint the CoC token for this exact IP at
  developer.clashofclans.com.
- **Runtime:** systemd service (house style — matches `gunicorn-claytontv*`; no pm2).
- **Layout:** `/srv/coc-bot/{current,shared}` (Deployer-style, like the other `/srv` sites);
  `.env` in `shared/` (chmod 600); SQLite in `shared/data/`.
- **No nginx vhost** — Discord gateway + CoC API are outbound only (both confirmed reachable).
- **Service user:** dedicated low-priv `cocbot` recommended (bot holds Discord + CoC secrets).
- Timezone Europe/Berlin; reminders compute off the API's absolute UTC war timestamps.

```ini
# /etc/systemd/system/coc-bot.service
[Unit]
Description=Clash of Clans Discord bot
After=network-online.target
Wants=network-online.target
[Service]
User=cocbot
WorkingDirectory=/srv/coc-bot/current
EnvironmentFile=/srv/coc-bot/shared/.env
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
PrivateTmp=true
[Install]
WantedBy=multi-user.target
```

## 2. Target architecture

```
Discord (discord.js v13)         CoC API (poll-only, IP-locked token)
        ▲                                   ▲
        │ embeds / pings                    │ GET on interval
        │                                   │
┌───────┴───────────────────────────────────┴────────┐
│  Bot process (Node, systemd/pm2, static-IP host)    │
│  ┌──────────────┐   ┌───────────────┐   ┌─────────┐ │
│  │ Poll scheduler│──▶│ Snapshot/diff │──▶│ Feature │ │
│  │ (per-resource)│   │    engine     │   │ modules │ │
│  └──────────────┘   └──────┬────────┘   └────┬────┘ │
│         ▲                  │ read/write        │      │
│         │            ┌─────▼──────┐            │      │
│         └────────────│  SQLite    │◀───────────┘      │
│    hardened client   │ (snapshots │  channel routing  │
│  (backoff/retries)   │  + links)  │  + config         │
│                      └────────────┘                   │
└──────────────────────────────────────────────────────┘
```

Builds on the existing layered client (`api/CoC.js` → `api/components/*` → `api/client.js`).
Current state: only `Clans` is wired; other components are stubs; commands are `ping` +
`clan_info`.

## 3. Capability taxonomy (API → data → Discord feature)

| API endpoint | Key data | Discord feature | Diff? |
|---|---|---|---|
| `GET /clans/{tag}` | level, points, war streak, league, members | `/clan_info`, clan achievement alerts | for alerts |
| `GET /clans/{tag}/members` | role, TH, trophies, donations, league | donation leaderboards, join/leave, role/name/TH changes | ✅ |
| `GET /clans/{tag}/warlog` | historical results, stars, destruction | war history, win-rate stats | no |
| `GET /clans/{tag}/currentwar` | state, per-member attacks, opponent | war start/end, live attack log, attack reminders, missed-attack report | ✅ |
| `GET /clans/{tag}/currentwar/leaguegroup` | CWL group, round war tags | CWL roster, round schedule, TH distribution | poll |
| `GET /clanwarleagues/wars/{warTag}` | per-round rosters/attacks | CWL attack log, missed-attacks, standings | ✅ |
| `GET /clans/{tag}/capitalraidseasons` | per-member raid attacks/loot, districts | raid-weekend summary, missed-raid tracker, contribution board | ✅ |
| `GET /players/{tag}` | heroes/troops/spells, trophies, achievements | `/player`, linking, rushed check, Clan Games (achievement diff) | for CG |
| `POST /players/{tag}/verifytoken` | validates in-game token | verified linking → auto Discord roles | on demand |
| `GET /leagues` `/warleagues` `/capitalleagues` `/builderbaseleagues` | league names/badges | embed enrichment | no |
| `GET /locations/{id}/rankings/*` | clan/player/builder/capital ranks | leaderboard flex, rank-change alerts | for alerts |
| `GET /goldpass/seasons/current` | season timing | season countdown | no |
| `GET /labels/{clans\|players}` | label metadata | profile badges | no |

## 4. MoSCoW backlog

**Must** — Foundation (EPIC 0), Clan War notifications (EPIC 1: start/end, reminders,
missed-attack), member join/leave (EPIC 2 subset).
**Should** — CWL (EPIC 3), Raid Weekend (EPIC 4), donations (EPIC 5), verified linking &
roles (EPIC 6), role/TH-change logs.
**Could** — Clan Games embed, rich `/player` & `/clan` lookups, leaderboard flex, last-seen,
legend daily summary (EPIC 7).
**Won't (this phase)** — anything the API can't do: sub-poll real-time attack push, live
legend per-attack feed, exact Clan Games points, chat/relations data.

## 5. Discord UX: channels & onboarding

**Per-channel routing** (so people can mute noise without losing high-signal reminders). Each
notification type maps to a configurable channel (see #53):

| Channel | Content | Volume |
|---|---|---|
| `#war-reminders` | @-mention pings only | Low / high-signal → keep unmuted |
| `#war-log` | war start/end + live attacks | High → opt-in |
| `#cwl` | CWL roster, rounds, results | Bursty (monthly) |
| `#capital` | raid-weekend summaries, missed-raid | Weekly |
| `#clan-feed` | join/leave, role/name/TH, donations | Steady log |
| `#verify` | onboarding/linking | Near-zero |

**@-mention reminders depend on linking.** To ping a member the bot needs their Discord ID ↔
player tag (EPIC 6). Until linked, reminders list the in-game name instead.

**Onboarding (not DMs).** Discord bots can't reliably *initiate* DMs, so onboarding is a
persistent **button in `#verify` → ephemeral modal** (player tag + in-game API token →
`verifytoken` → auto role) plus a `/link` slash command (ephemeral). See #54.

### Discord app config (App/Client ID `972807855897972797`)

- **Login uses the Bot Token** (Bot tab) → `DISCORD_TOKEN`. The **client secret and public
  key are unused** in this architecture (gateway-based, in-game token verification — no
  Discord OAuth web flow, no HTTP interactions endpoint).
- **Interactions Endpoint URL: leave blank** — interactions arrive over the gateway (discord.js).
- **Privileged intents: all OFF** (Presence, Server Members, Message Content). Slash commands
  + buttons + CoC-API polling need none of them. Client intents stay `[GUILDS]`.
- **OAuth2 invite** — scopes `bot applications.commands`; permissions bitfield **`268553216`**
  = View Channels, Send Messages, Embed Links, Read Message History, Attach Files, Manage Roles:
  `https://discord.com/api/oauth2/authorize?client_id=972807855897972797&permissions=268553216&scope=bot%20applications.commands`
- **Role hierarchy:** the bot's role must sit **above** the roles it assigns (Member/Elder/Co).
- Make any role used for reminder pings **mentionable** (avoids needing Mention Everyone).

## 6. v1 target

**Full War + CWL** — EPIC 0 (Foundation) + EPIC 1 (War) + EPIC 3 (CWL). These epics'
stories are marked **Todo** on the board as the active sprint; everything else is backlog.

## 7. Sources

- Official portal — <https://developer.clashofclans.com/>
- coc.py docs — <https://cocpy.readthedocs.io/> · clashofclans.js — <https://clashofclans.js.org/>
- ClashPerk feature/log reference — <https://docs.clashperk.com/features/logs>
- ClashKing — <https://clashk.ing/>
