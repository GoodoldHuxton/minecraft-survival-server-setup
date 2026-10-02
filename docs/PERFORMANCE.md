# Performance

The goal: a survival server that holds **20 TPS** on modest hardware without changing how vanilla
survival feels. Every change below is a known, low-risk optimisation for Paper; anything that would
noticeably change gameplay (e.g. disabling hopper events, very low view distance) was left out.

## 1. Pre-generated world

Generating new terrain is the single most expensive thing a server does. The world is
pre-generated with **Chunky** and fenced in with a world border:

```text
worldborder center 0 0
worldborder set 10000
chunky world world
chunky center 0 0
chunky radius 1000
chunky start
```

- 2000 × 2000 blocks = **16,129 chunks**, generated in **5 min 35 s** on the test machine
- `/rtp` is limited to 250–950 blocks from spawn, i.e. *inside* the pre-generated area, so random
  teleports never trigger world generation
- Pre-generate further out (e.g. `chunky radius 3000`) before opening a public server

## 2. server.properties

| Setting | Default | Here | Why |
|---|---|---|---|
| `view-distance` | 10 | **8** | Fewer chunks sent per player; still looks good |
| `simulation-distance` | 10 | **6** | Entities/redstone only tick near players: the biggest CPU saver |
| `entity-broadcast-range-percentage` | 100 | **80** | Less entity tracking traffic |
| `sync-chunk-writes` | true | **false** | Chunk saving no longer blocks the main thread |

## 3. Paper (`config/paper-world-defaults.yml`)

| Setting | Value | Why |
|---|---|---|
| `misc.redstone-implementation` | `ALTERNATE_CURRENT` | Much faster redstone, vanilla-compatible for normal builds |
| `environment.optimize-explosions` | `true` | Cheaper TNT/creeper explosions |
| `collisions.max-entity-collisions` | `2` | Stops entity cramming lag (mob farms) |
| `chunks.max-auto-save-chunks-per-tick` | `8` | Spreads autosave over more ticks, no autosave lag spikes |
| `chunks.prevent-moving-into-unloaded-chunks` | `true` | No lag/exploits from outrunning chunk loading |
| `chunks.entity-per-chunk-save-limit` | arrows 16, XP orbs 16, pearls/snowballs/fireballs 8 | Prevents "chunk ban" lag machines |
| `entities.spawning.alt-item-despawn-rate` | cobble, dirt, netherrack, sand, leaves… → 15 s | Junk items disappear fast |
| `entities.spawning.despawn-ranges.monster` | soft 30 / hard 56 | Matches the lower simulation distance |
| `environment.treasure-maps.find-already-discovered` | `true` | Avoids the famous treasure-map structure search lag |
| `tick-rates.mob-spawner` / `grass-spread` | 2 / 4 | Halves spawner checks, grass still spreads naturally |

## 4. Spigot (`spigot.yml`)

| Setting | Value | Why |
|---|---|---|
| `entity-activation-range` | animals 16, monsters 24, raiders 48, villagers 16, misc 8 | Far-away entities tick less often |
| `tick-inactive-villagers` | `false` | Villager halls far from players stop eating CPU |
| `mob-spawn-range` | `6` | Must be ≤ simulation distance |
| `nerf-spawner-mobs` | `true` | Spawner mobs have no AI (cheap mob farms) |
| `merge-radius` | items 3.5, XP 4.0 | Fewer item/XP entities on the ground |

## 5. Bukkit (`bukkit.yml`)

| Setting | Value | Why |
|---|---|---|
| `spawn-limits.monsters` | 50 (default 70) | Fewer mobs per player, survival still feels dangerous |
| `spawn-limits.water-ambient` / `ambient` | 10 / 5 | Fish and bats are pure overhead |
| `ticks-per.monster-spawns` | 2 | Halves mob-spawn attempts |
| `chunk-gc.period-in-ticks` | 400 | Unloads unused chunks more often |

## 6. JVM

`start.bat` uses [Aikar's G1GC flags](https://docs.papermc.io/paper/aikars-flags), the standard
recommendation from PaperMC, minus `G1RSetUpdatingPauseTimeTarget`, which no longer exists on
Java 20+ (the JVM refuses to start with it).

## Measured results

Measured with **spark** on the test machine (Intel i5-11400H laptop with 8 GB RAM, 3 GB heap,
Windows 11, other apps running).

**Stress test:** 5 players each teleport to a random spot in the pre-generated area **every 4
seconds** for 2 minutes, which means constant chunk loading from disk. Real players move far slower;
this is a deliberate worst case. Script: [`tests/load-test.js`](../tests/load-test.js).

| Metric | Result |
|---|---|
| TPS (last 10 s / 1 min / 5 min / 15 min) | 20.0 / 18.5 / 18.8 / 19.6 |
| Tick time, last 1 min (median / 95th percentile) | 22 ms / 64 ms |
| Worst single tick | 1.8 s (one spike while loading chunks under the stress test) |
| CPU (process, 1 min) | 28 % |

Profiler report: https://spark.lucko.me/EdTvdXE763

For a live server, run `/spark tps` and `/spark health` regularly, and `/spark profiler start
--timeout 300` if players report lag. The report shows exactly which plugin or entity type costs
the most.
