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
- `/ticket claim`, `add`, `remove`, `transcript`, `close`, `reopen`. Closing saves the closed state first, archives all available message pages and attachment bytes to persistent `data/transcripts/`, posts multipart archives to Ticket Logs and attempts an opener DM. Closed DMs and Discord log-upload failures do not prevent closure. Failed log uploads retry from their last confirmed part. Channel deletion follows after five seconds only once a local archive exists; failed capture retains the closed channel for retry. A final message check recaptures late additions before deletion. Large archives and attachments are split into 7 MB parts. Transcript records include text, IDs, timestamps, replies, embeds, components, stickers, reaction summaries and polls when available. Messages deleted before capture cannot be recovered, nor can external linked content be downloaded automatically. Keep persistent storage backed up; local archives are retained. Transfer, Add Person and Remove Person buttons are available alongside commands.
- `/verify` publishes the verification panel. Verification assigns role `1570764086055018497`, confirmed as the role which unlocks existing community channels. Verification also assigns the eight configured starter roles through individual additions, preserving existing roles.
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

## Verification starter roles

Human members receive all eight starter roles when pressing Verify: MET Police, Police Community Support Officer, Standard Response Driver (no blue-light ticket), London Ambulance Service, Student Paramedic, London Fire Brigade, Student Firefighter, and Civilian. Bot accounts are skipped. Joining alone does not assign roles. This applies when verifying, not as a bulk change to existing members. If a starter role cannot be assigned, verification reports the failure and can be retried. The bot role must be above every starter role.

ERPT is not assigned automatically. Verification skips Police Community Support Officer for members holding one of the configured MET ranks from MPS Constable through Commissioner. LAS, LFB and staff ranks do not trigger this exception.

## Server lead log DMs

New bot log posts in all nine configured logging channels are copied to WesternSpi (723343308872744990) and Sean (703990442894688356) by DM. Copies include the source link, text, embeds and attachment links. Each recipient is queued separately with retry handling; closed DMs are marked undeliverable without blocking channel logs. This applies to new logs while the bot is connected, not historical posts. Lead notification IDs do not grant command permissions.

## Ownership mention reminders

When a human message mentions an Owner or Co-Owner, or either ownership role directly, the bot replies: “Please open a ticket in <#1570764465304117248> and refrain from pinging ownership.” One reminder is sent per matching message without pinging anyone. Bots and webhooks are ignored.

## Getting started and recovery

The getting-started panel is refreshed in channel 1566163079496994948 with FiveM and website link buttons, joining instructions, department/spawn guidance and the CAD sequence: /link in-game, /linkme in Discord, then /sync in Discord. These linking commands belong to the existing CAD integration, not this bot.

Use root index.js or npm start for the worker supervisor. Crashes restart with 5–60 second backoff. Ticket/panel/command setup failures retry without exiting the connected bot. This cannot recover a host-stopped container or hosting outage. Persistent storage failures still stop the worker to protect records.
