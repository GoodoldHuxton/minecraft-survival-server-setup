# Testing

The setup ships with an **automated acceptance test suite** in [`tests/`](../tests). Real Minecraft
clients ([Mineflayer](https://github.com/PrismarineJS/mineflayer) bots) join the server, each gets a
rank, and they try what that rank should — and should not — be able to do. Console-side checks
(block states, rank storage, backups) go through RCON.

## Results

Run against a **fresh install** made with `scripts/install.ps1` (Paper 26.2, Java 25):

```
Server list
  MOTD shows the two-line Fulghen Survival banner ... PASS

Join, chat & tab list
  Custom join message is broadcast ... PASS
  Chat format shows rank prefix: [VIP] Name » message ... PASS
  Tab list header shows server name, rank and ping ... PASS

Member: basic commands work, staff commands are blocked
  Member cannot /ban ... PASS
  Member cannot /gamemode ... PASS
  Member cannot /give ... PASS
  Member cannot roll back (/co rollback) ... PASS
  Member cannot change ranks (/lp) ... PASS
  /spawn teleports to spawn after the 3s warm-up ... PASS
  /sethome + /home work, members are limited to 2 homes ... PASS
  /tpa request + /tpaccept teleports the player ... PASS
  /warp wild works ... PASS

VIP: cosmetic perks only
  VIP can use /nick with colours ... PASS
  VIP can open /workbench ... PASS
  VIP can set more homes than a member (5) ... PASS
  VIP chat colours work, member colour codes are stripped ... PASS
  VIP still cannot use staff commands (no P2W) ... PASS

Moderator: kick / ban / logs
  Moderator can /kick ... PASS
  Moderator can /tempban and /unban ... PASS
  Moderator can look up block logs (/co lookup) ... PASS
  Moderator cannot roll back (admin only) ... PASS

Grief protection & rollback
  Griefed blocks are logged and /co rollback restores them ... PASS
  Claimed land is protected from other players (GriefPrevention) ... PASS

Persistence (part 1)
  Saving a home + rank for the restart check ... PASS

Backups
  backup.bat creates a zip with the world inside (while the server runs) ... PASS

26/26 passed
```

After a restart (`stop`, then `start.bat` brings the server back automatically after 10 s):

```
Persistence (part 2, after restart)
  Ranks survive a restart (LuckPerms) ... PASS
  Homes survive a restart (Essentials) ... PASS
  Block logs survive a restart (CoreProtect) ... PASS

3/3 passed
```

**Discord bridge, checked by hand** with a real bot in a test Discord server (it needs a token,
so it isn't in the automated suite): the "server is online" message, join/leave embeds, in-game
chat → Discord (`[VIP] TestVIP » hello from Minecraft!`) and Discord → game
(`[Discord] Good Old Huxton > hey!`) all arrived. See `screenshots/discord.png`.

**Not covered automatically:** the anti-cheat itself (bots are exempted from GrimAC, because their packets don't look like a real
client's; GrimAC flagging them on sight during development was a nice side-check).

## Running the tests yourself

Only on a **private test copy** of the server, never on a live one:

1. Install with test tools: `scripts\install.ps1 -ServerDir C:\mc\test -AcceptEula -WithTestTools`
2. In `server.properties`: `online-mode=false` (bots have no Mojang account). RCON is already enabled.
3. Start the server, paste `configs/spawn/build-spawn.txt` into the console, pre-generate (see INSTALLATION.md).
4. Then:

```powershell
cd tests
npm install
node setup-world.js C:\mc\test       # /setspawn, warps, /rtp area
node run-tests.js C:\mc\test         # main suite
# restart the server, then:
node run-tests.js C:\mc\test --after-restart
```

While the tests run they temporarily relax three GriefPrevention anti-abuse limits that would
otherwise block a crowd of bots from one IP (accounts per IP, re-login cooldown, join-message
spam limit) and restore them afterwards.

## Load test

`node load-test.js C:\mc\test 5 120` joins 5 bots that teleport to a random spot in the
pre-generated area every 4 seconds while spark profiles the server for 2 minutes. Results are in
[PERFORMANCE.md](PERFORMANCE.md).

## Bugs the tests caught during development

Writing the tests paid off. Each of these would have reached players:

- Members could only set **1 home instead of 2**: EssentialsX needs `essentials.sethome.multiple`
  before it reads the per-rank home limits.
- The **MOTD lost its second line** in the server list (a newline escape was written as a real line
  break into `server.properties`).
- The `wild` warp was saved **at spawn** because the setup bot was snapped back from an unloaded
  chunk, and the first candidate spot was in the middle of a river.
- `start.bat` **could not start Java 25**: Aikar's flag set still contained
  `G1RSetUpdatingPauseTimeTarget`, which was removed in Java 20. Its restart loop also spun without
  waiting when the console input was redirected.
- `backup.bat` failed while the server was running: LuckPerms' H2 database file is locked. Switched
  LuckPerms to YAML storage (also makes the ranks readable in git), and pinned Windows' own
  `tar.exe` instead of whichever `tar` is first on `PATH`.
