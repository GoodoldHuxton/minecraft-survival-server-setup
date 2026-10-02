# Ranks & Permissions

Permissions are managed by **LuckPerms** with YAML storage, so every rank is a readable file in
[`configs/luckperms/groups/`](../configs/luckperms/groups). The same setup is also available as a
list of console commands in [`configs/luckperms/setup-ranks.txt`](../configs/luckperms/setup-ranks.txt),
which documents *why* each node is there.

## Hierarchy

```
Owner      weight 100   [Owner]       everything (*)
  ↓
Admin      weight 80    [Admin]       all Essentials, rollback, claims admin, anti-cheat, spark
  ↓
Moderator  weight 60    [Moderator]   kick, (temp)ban, mute, vanish, invsee, block-log lookup
  ↓
VIP        weight 20    [VIP]         cosmetic + quality-of-life perks
  ↓
Member     weight 10    [Member]      the default rank for every player
```

Each rank **inherits** everything from the rank below it. Prefixes are LuckPerms meta, so chat
(EssentialsX Chat), the tab list and name tags (TAB) all show the same prefix.

## What each rank can do

| | Member | VIP | Moderator | Admin | Owner |
|---|:---:|:---:|:---:|:---:|:---:|
| `/spawn`, `/warp`, `/rtp`, `/tpa` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Homes (`/sethome`) | 2 | 5 | 10 | ∞ | ∞ |
| Claim land (golden shovel / `/claim`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/msg`, `/mail`, `/ignore`, `/afk`, `/rules` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coloured chat & `/nick` with colours | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/hat`, `/workbench`, AFK message | ❌ | ✅ | ✅ | ✅ | ✅ |
| Join when the server is full | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/kick`, `/tempban`, `/ban`, `/mute` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/vanish`, `/invsee`, `/socialspy`, `/tp` | ❌ | ❌ | ✅ | ✅ | ✅ |
| Block logs: inspect & lookup (`/co i`, `/co l`) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Anti-cheat alerts | ❌ | ❌ | ✅ | ✅ | ✅ |
| Rollback / restore (`/co rollback`) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Admin claims, delete claims, ignore claims | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gamemode, give, time, weather, spark, Chunky | ❌ | ❌ | ❌ | ✅ | ✅ |
| Purge block-log database, manage ranks | ❌ | ❌ | ❌ | ❌ | ✅ |

## No pay-to-win

VIP perks are deliberately cosmetic or convenience-only: colours, a nickname, a hat, a portable
crafting table, a few more homes and a reserved slot. VIP players do **not** get extra claim
blocks, `/fly`, `/back` on death, kits with gear or anything else that affects survival balance.
The automated tests check that VIP still cannot use `/fly` or staff commands.

## Common tasks

```text
lp user <player> parent set vip           # give a rank (replaces the current one)
lp user <player> parent set default       # back to Member
lp user <player> info                     # see a player's rank and permissions
lp group vip permission set <node> true   # add a permission to a rank
lp editor                                 # web editor for everything above
```

## A LuckPerms gotcha this setup avoids

LuckPerms resolves an **exact** node before a **wildcard**, even when the exact node comes from a
lower rank. So a `essentials.near false` on Member would beat Admin's `essentials.*` and silently
take the command away from every admin. That is why the Member rank never sets `false` nodes, and
why Owner gets an explicit `coreprotect.purge true` on top of `*` (Admin denies purge).
