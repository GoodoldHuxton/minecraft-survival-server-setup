# Production-Ready Minecraft Survival Server Setup

![Paper](https://img.shields.io/badge/Paper-26.2-blue)
![Java](https://img.shields.io/badge/Java-25-orange)
![Tests](https://img.shields.io/badge/acceptance%20tests-29%2F29%20passing-brightgreen)
![Plugins](https://img.shields.io/badge/paid%20plugins-0-success)

A fully configured Minecraft survival server setup built as a portfolio project.

Includes permissions, ranks, moderation tools, grief protection, performance optimization, backups
and quality-of-life features. **"Fulghen Survival"** is the example server name used throughout.

**Give it an empty folder, run one command, and you get a playable, manageable and fast survival
server.** Ranks, moderation, grief protection, restarts and backups are verified by an automated
test suite with real Minecraft clients.

## Features

- Complete Paper server configuration
- LuckPerms permission hierarchy
- Custom ranks and prefixes
- Essentials commands
- Custom TAB and scoreboard
- Grief protection
- Block logging and rollback
- Automated backup scripts
- Chunk pre-generation
- Performance optimization
- Discord integration
- Basic anti-cheat and exploit protection
- **29 automated end-to-end tests** (bots that join and try every rank's permissions)

## What players see

**Server list (MOTD)**

```
          ✦ FULGHEN SURVIVAL ✦
     Survival • Community • No P2W
```

**Joining:** vanilla `Acid joined the game` becomes

```
✦ Welcome Acid to Fulghen Survival!
✦ Acid joined for the first time! Say hi!        (first join only, plus a starter kit)
```

**Chat**

```
[VIP] Acid » hello boys
```

**Tab list**

```
FULGHEN SURVIVAL
Survival • Community • No P2W

Online: 12
Rank: Member
Ping: 31ms

play.example.com
```

**Sidebar scoreboard**: player name, rank, ping, online and staff count (toggle with `/sb`).

**Spawn**: a small, clean sky island with gardens, lanterns and holograms for getting started and
the rules, built entirely from console commands. Warps: `/spawn`, `/warp wild`, `/warp nether`,
plus `/rtp` into the pre-generated area.

## Ranks

```
Owner > Admin > Moderator > VIP > Member
```

| Rank | Highlights |
|---|---|
| **Member** | `/spawn` `/home` (2) `/tpa` `/warp` `/rtp` `/msg` `/mail`, land claims |
| **VIP** | coloured chat & `/nick`, `/hat`, `/workbench`, 5 homes, joins full server. **No P2W.** |
| **Moderator** | kick, tempban, ban, mute, vanish, invsee, block-log lookup, anti-cheat alerts |
| **Admin** | everything in Essentials, rollback, claim admin, spark, Chunky |
| **Owner** | `*` |

Full matrix and every permission node: [docs/PERMISSIONS.md](docs/PERMISSIONS.md)

## Tech Stack

| | |
|---|---|
| Server | Paper 26.2 on Java 25, Aikar's G1GC flags |
| Ranks & permissions | LuckPerms (YAML storage) + Vault |
| Commands, chat, spawn | EssentialsX, EssentialsX Chat, EssentialsX Spawn |
| Tab list & scoreboard | TAB + PlaceholderAPI |
| Grief protection | GriefPrevention (claims) + CoreProtect (logs & rollback) |
| Anti-cheat | GrimAC + Paper anti-xray + exploit limits |
| Performance | Chunky pre-generation, spark profiling, tuned Paper/Spigot/Bukkit configs |
| Discord | DiscordSRV |
| Version support | ViaVersion (newer clients can join) |
| Scripts | PowerShell / batch: install, download, start, backup |
| Tests | Node.js, Mineflayer bots, RCON |

All plugins are free and open source: [docs/PLUGINS.md](docs/PLUGINS.md).

## Installation

```powershell
git clone https://github.com/GoodoldHuxton/minecraft-survival-server-setup.git
cd minecraft-survival-server-setup
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -ServerDir C:\mc\fulghen -AcceptEula
```

Then double-click `start.bat` in the server folder, paste the spawn builder into the console and
set the warps. Step by step, including Discord and daily backups: [docs/INSTALLATION.md](docs/INSTALLATION.md)

No plugin `.jar` files are stored in this repo. The installer downloads each one from its official
source, always the newest build compatible with the server version.

## Usage

| Task | How |
|---|---|
| Start / auto-restart after crash | `start.bat` |
| Backup (safe while running) | `backup.bat` → `backups\backup-<date>.zip`, keeps 14 |
| Daily backups | one `schtasks` line, see INSTALLATION.md |
| Promote a player | `lp user <name> parent set vip` |
| Roll back a griefer | `/co rollback u:<name> t:1d r:#global` |
| Check performance | `/spark tps`, `/spark health`, `/spark profiler start --timeout 300` |
| Update Paper & plugins | `scripts\download.ps1 -ServerDir <server>` |

## Performance

- **16,129 chunks pre-generated** (2000 × 2000 blocks) behind a 10,000-block world border; `/rtp`
  only lands inside that area, so exploring never triggers chunk generation.
- View distance 8, simulation distance 6, tuned entity activation ranges, mob caps, Alternate
  Current redstone, item-merge radius, junk-item despawn and per-chunk entity limits.
- Tested with spark profiling and pre-generated chunks: **TPS 18.5–20** in a deliberate stress test
  where 5 players teleport to a random spot every 4 seconds
  ([report](https://spark.lucko.me/EdTvdXE763)).

Every setting with its default and the reason: [docs/PERFORMANCE.md](docs/PERFORMANCE.md)

## Tested

A fresh install made with `install.ps1` was checked by the automated suite in [`tests/`](tests):
real bot clients join, get ranks and try what each rank should and should not do.

| Check | Result |
|---|---|
| Member → can they run admin commands (`/ban`, `/gamemode`, `/give`, `/co rollback`, `/lp`)? | Blocked ✅ |
| VIP → do the perks work (`/nick`, colours, `/workbench`, 5 homes)? Still no staff commands? | ✅ |
| Moderator → kick / tempban / unban / block-log lookup work, rollback blocked? | ✅ |
| Grief → griefed blocks restored with `/co rollback`; claimed land protected? | ✅ |
| Server restart → ranks, homes and block logs kept? | ✅ |
| Backup → zip actually created, with the world inside, while the server runs? | ✅ |
| Discord → messages delivered? | Configured; needs your bot token |

**29/29 passing.** Full output and the bugs the tests caught: [docs/TESTING.md](docs/TESTING.md)

## What problem it solves

Setting up a survival server properly takes days: picking plugins that work together, wiring
permissions so nobody gets admin by accident, making chat and the tab list look right, protecting
builds, keeping the server at 20 TPS and making sure a crash doesn't wipe the world. Most servers
skip half of it and find out later.

This setup does all of it, documents why, and proves it works with tests. A server owner gets a
community-ready server instead of a folder of plugins.

## Project structure

```
minecraft-survival-server-setup/
├── configs/
│   ├── essentials/        config, kits, MOTD, rules
│   ├── luckperms/         config, rank files, setup-ranks.txt
│   ├── tab/               tab list + scoreboard
│   ├── griefprevention/   claims & anti-spam
│   ├── discordsrv/        Discord bridge (no token)
│   ├── paper/             paper-global, paper-world-defaults, spigot, bukkit
│   └── spawn/             build-spawn.txt (console spawn builder)
├── scripts/
│   ├── install.ps1        one-command install
│   ├── download.ps1       fetches Paper + plugins from official sources
│   ├── start.bat          tuned JVM flags + auto-restart
│   └── backup.bat         safe live backups (+ backup.ps1)
├── tests/                 Mineflayer + RCON acceptance tests, load test
├── docs/
│   ├── INSTALLATION.md
│   ├── PERMISSIONS.md
│   ├── PLUGINS.md
│   ├── PERFORMANCE.md
│   └── TESTING.md
├── server.properties.example
└── README.md
```

Secrets (Discord bot token, RCON password, server IP) are never stored in the repo.

## Freelance Work

I provide custom Minecraft server setup, configuration, optimization and troubleshooting services.

For custom work, contact me through [LinkedIn](https://www.linkedin.com/in/yi%C4%9Fit-alp-bayar-96630b268) or BuiltByBit.
