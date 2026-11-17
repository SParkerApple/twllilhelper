# TWL Lil Helper

Discord bot for **The Western Line** FiveM community, server `1566132871163412581`.

## Run

Use Node.js 24. Run `npm ci`, set `DISCORD_TOKEN` in your host environment, then `npm start`. The bot registers its guild commands at startup. Enable **Server Members Intent** and **Message Content Intent** in the Discord Developer Portal.

Keep the host's `data/` directory on persistent storage across deployments. It contains tickets, moderation cases, warnings, temporary-ban schedules, and queued log delivery. Back it up regularly. Do not run multiple instances against the same data directory. Neither the token nor server records belong in GitHub.

Bot permissions: View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Manage Channels, Manage Roles, Manage Messages, View Audit Log, Ban Members, Kick Members, Moderate Members. Place its role above Verified and any members it must moderate. Developer bug-report pings require the Developer role to be mentionable or the bot to have Mention Everyone permission in the bug report channel; message payloads only permit the configured Developer role.

## Features

- All 28 announcement routes are defined in `config.json`. Announcement commands accept `message` and optional `title`. Only the exact configured roles can publish; Administrator and server-owner status do not bypass these checks. Announcement text does not generate mentions.
- `/suggestion` opens an idea form and posts to the supplied suggestions channel.
- `/bugreport` collects reproduction steps, expected and actual results, and evidence/context. It posts to the supplied bug channel and pings Developer (`1566156709280489562`). Each member has a one-minute submission cooldown per form type.
- `/ticket open` offers general/in-game support, player reports, punishment appeals, and technical help. `/ticket panel` publishes the panel in the supplied support channel.
- `/ticket transfer destination reason` follows Support → Management → Ownership. Only Owner, Co-Owner and Developer may move in any direction or skip a level. Technical tickets start in Developer. Transfer replaces the category and explicit access list, clears the claim and records the reason.
- Support access includes Support, Moderator and Administrator roles. Management tickets are visible to Management, Ownership and Developers. Ownership/Developer tickets are visible to Ownership and Developers. Discord's native Administrator permission still bypasses private-channel visibility; the bot cannot prevent this.
- `/ticket claim`, `add`, `remove`, `transcript`, `close`, `reopen`. Ticket participants cannot transfer tickets. Closing uploads a text transcript to Ticket Logs and retains the channel for reopening. Transcripts contain available message content, embed data and attachment links, not downloaded attachment copies. Exports above 7 MB require manual handling before closure.
- `/verify` publishes the verification panel. Verification assigns role `1570764086055018497`, confirmed as the role which unlocks existing community channels. It does not grant service or staff roles.
- `/ban`, `/unban`, `/tempban`, `/banlog`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/case`, `/clear`, `/purge`, `/slowmode`, `/lock`, `/unlock`. Moderators and Support can use ordinary moderation; Administrator, Management and Ownership can ban. Discord role hierarchy and bot permissions still apply. Case voiding requires Discord Administrator. Temporary bans resume after restart.
- `/sticky set/remove`, `/say`, `/status`, `/help`.
- Audit, member, role, channel, voice, moderation and message logs use the supplied channels. Uncached deleted message contents cannot be reconstructed.
- Safeguarding flags accounts under seven days old on joining. Management can run `/safeguard scan` for current members. This is a staff-review signal, never a claim of wrongdoing or an automatic punishment. It does not inspect private data or other servers.

LOA, welcomes, TWERK, Comrade pings/reminders, Twitch/social role integrations and original server-specific IDs are excluded.

## Hosting / updates

Repository: https://github.com/SParkerApple/twllilhelper

On Bot-Hosting.net choose Application → GitHub (or upload the release archive), Node.js 24, startup `npm start`, and environment variable `DISCORD_TOKEN`. Install dependencies with `npm ci`. Keep `data/` outside any folder replaced by source redeployment, or configure `DATA_DIR` to a persistent location. Do not reset the live data directory during updates.

Run `npm test` before pushing. After restart, confirm the console shows `READY TWL Lil Helper` and test `/status`. The bot publishes or refreshes its support and verification panels automatically on startup. `/ticket panel` and `/verify` can refresh them manually; saved message IDs prevent duplicates during normal restarts.

The code reuses moderation cases, purge logic and event logging from the user-supplied Goober Town export. The FiveM routing, announcements, reports and ticket workflow are rebuilt for this server.

Discord references: https://docs.discord.com/developers/interactions/application-commands and https://docs.discord.com/developers/events/gateway

## Automatic starter roles

New human members receive all eight requested starter roles: MET Police, PCSO, Standard Response Driver (no blue-light ticket), London Ambulance Service, Student Paramedic, London Fire Brigade, Student Firefighter, and Civilian. Bot accounts are skipped. This applies to future joins, not a bulk change to existing members. Role failures are reported in Member Logs. The bot role must be above every starter role.
