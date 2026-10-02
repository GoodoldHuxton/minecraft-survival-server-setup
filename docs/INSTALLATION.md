# Installation

Takes about 15 minutes, most of it waiting for chunk pre-generation. Written for Windows; the
configs themselves work on any OS (on Linux use the same Java flags in a shell script).

## Requirements

- Windows 10/11
- **Java 25** (e.g. [Amazon Corretto 25](https://aws.amazon.com/corretto/) or [Adoptium Temurin 25](https://adoptium.net/))
- 4 GB of free RAM for the server, a few GB of disk space
- A Minecraft Java account to join and finish the setup in game

## 1. Install

```powershell
git clone https://github.com/GoodoldHuxton/minecraft-survival-server-setup.git
cd minecraft-survival-server-setup
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -ServerDir C:\mc\fulghen -AcceptEula
```

`install.ps1` downloads Paper and every plugin from their official sources, copies all configs into
place, creates `server.properties` with a random RCON password and copies `start.bat` /
`backup.bat` into the server folder. `-AcceptEula` writes `eula.txt`; only use it if you agree to
the [Minecraft EULA](https://aka.ms/MinecraftEULA).

Before going public, edit `server.properties`:

- `motd` is ready; change it if your server has another name
- replace `play.example.com` in `plugins\TAB\config.yml` and `plugins\DiscordSRV\messages.yml`

## 2. First start

Double-click **`start.bat`** in the server folder. When the console shows `Done (…)! For help, type "help"`:

```text
op YourName
```

Then join and give yourself the Owner rank (from the console):

```text
lp user YourName parent set owner
```

## 3. Spawn

Open [`configs/spawn/build-spawn.txt`](../configs/spawn/build-spawn.txt) and paste its commands into
the console (everything except the `#` comment lines). It builds a small sky spawn at 0, 150, 0 with
gardens, lanterns and three holograms, sets the world spawn, and builds a small obsidian hub in the
Nether at 0, 64, 0.

Then **in game**, as Owner:

```text
/tp 0.5 151 0.5
/setspawn
```

## 4. Warps and random teleport

```text
/settpr world center          (stand at spawn)
/settpr world minrange 250
/settpr world maxrange 950
```

Walk or fly to a nice spot in the wild and `/setwarp wild`. For the Nether hub:

```text
/execute in minecraft:the_nether run tp @s 0.5 64 0.5
/setwarp nether
```

> With `online-mode=false` on a private test server, `node tests\setup-world.js <server>` does all of
> step 3's `/setspawn` and step 4 automatically.

## 5. Pre-generate the world

In the console:

```text
worldborder center 0 0
worldborder set 10000
chunky world world
chunky center 0 0
chunky radius 1000
chunky start
```

Wait for `[Chunky] Task finished` (about 5–10 minutes). Larger servers: raise the radius and the
`maxrange` of `/settpr` together.

## 6. Discord

1. Create a bot at the [Discord Developer Portal](https://discord.com/developers/applications),
   enable **Message Content Intent** and **Server Members Intent**, and invite it to your server.
2. In `plugins\DiscordSRV\config.yml` set:
   ```yaml
   BotToken: "your bot token"
   Channels: {"global": "your-chat-channel-id"}
   ```
3. Restart. The channel gets a "server is online" message, and chat, joins, leaves and deaths are
   bridged both ways.

**Never commit the token.** It lives only in the server folder, which is git-ignored.

## 7. Backups

`backup.bat` (in the server folder) zips the worlds, plugin data and configs into `backups\` and
keeps the newest 14. It is safe while the server runs: it uses RCON to pause saving
(`save-off` + `save-all flush`) during the copy.

Daily at 05:00 with Task Scheduler:

```bat
schtasks /create /tn "Fulghen Backup" /sc daily /st 05:00 /tr "cmd /c cd /d C:\mc\fulghen && backup.bat"
```

RCON listens on port 25575: **do not port-forward it**. Only the game port (25565) needs to be open.

To restore: stop the server, move the current `world*` folders away, unzip a backup into the server
folder, start again.

## 8. Port forwarding & going live

- Forward **TCP 25565** on your router to this PC, or use a host.
- Keep `online-mode=true` (the default here). It verifies accounts with Mojang.
- Run `/spark tps` after the first evening with players.

## Updating

Stop the server and run `scripts\download.ps1 -ServerDir C:\mc\fulghen` again. It removes the jars
it downloaded last time (listed in `plugins\.downloaded-by-setup.txt`) and fetches the newest
compatible builds. Worlds, configs and any plugins you added yourself are left alone.
