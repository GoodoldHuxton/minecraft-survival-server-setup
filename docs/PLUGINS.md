# Plugins

Everything in this setup is **free and open source**. No paid plugins are needed.

Plugin `.jar` files are **not** included in this repository: each project has its own license and
its own official download page. [`scripts/download.ps1`](../scripts/download.ps1) fetches the newest
build that supports the chosen Minecraft version straight from the official source, so the setup
never goes stale and nothing is redistributed.

Tested with **Paper 26.2** (stable channel) on **Java 25**.

| Plugin | Role in this setup | Official page |
|---|---|---|
| **Paper** | High-performance server software | https://papermc.io/downloads/paper |
| **LuckPerms** | Ranks, inheritance, prefixes (YAML storage) | https://luckperms.net |
| **EssentialsX** + Chat + Spawn | Homes, warps, `/tpa`, `/rtp`, kits, join/quit messages, chat format, MOTD, moderation | https://essentialsx.net |
| **Vault** | Bridges LuckPerms prefixes into EssentialsX Chat | https://github.com/MilkBowl/Vault |
| **PlaceholderAPI** | Placeholder bridge for TAB / DiscordSRV / future plugins | https://modrinth.com/plugin/placeholderapi |
| **TAB** | Tab list header/footer, sidebar scoreboard, sorted name tags | https://modrinth.com/plugin/tab-was-taken |
| **CoreProtect CE** | Block / container / chat logging and rollback | https://modrinth.com/plugin/coreprotect |
| **GriefPrevention** | Player land claims (golden shovel), anti-grief, anti-spam | https://modrinth.com/plugin/griefprevention |
| **GrimAC** | Anti-cheat (movement, combat, packet checks) | https://modrinth.com/plugin/grimac |
| **Chunky** | Chunk pre-generation | https://modrinth.com/plugin/chunky |
| **ViaVersion** | Lets newer Minecraft clients join | https://modrinth.com/plugin/viaversion |
| **DiscordSRV** | Minecraft ⇄ Discord chat bridge, join/leave/death messages | https://modrinth.com/plugin/discordsrv |
| **spark** | Profiler & TPS/MSPT monitoring | Built into Paper (`/spark`) |

### Version notes

- **EssentialsX** is downloaded from the official CI (`ci.ender.zone`). The latest *release* only
  supports Minecraft up to 26.1; the EssentialsX team publishes dev builds for newer versions and
  recommends them. Those builds also contain the fix for first-join messages on modern Paper.
- **GrimAC** publishes every build in the *alpha* channel; the newest one for the game version is used.
- **ViaBackwards** (lets *older* clients join) is **not** part of the production setup: GrimAC does
  not support it on 1.21.2+ and older clients get vehicle desync. It is only installed with
  `download.ps1 -WithTestTools`, because the automated test bots speak an older protocol.

### Why these and not others

- **LuckPerms + Vault** is the de-facto standard; every other plugin understands it.
- **GriefPrevention** instead of WorldGuard: players protect their own land without staff help.
- **CoreProtect** logs to a local SQLite database, so even unclaimed griefs can be rolled back.
- **TAB** draws the tab list *and* the scoreboard, one plugin less to keep updated.
- Spawn holograms are vanilla `text_display` entities, so no hologram plugin is needed.
