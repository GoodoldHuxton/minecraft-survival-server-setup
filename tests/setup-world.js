// One-time world setup that needs a player: Essentials spawn, warps and /rtp area.
// Run after configs/spawn/build-spawn.txt.  Usage: node setup-world.js ../server
const path = require('path');
const { connectFromServerDir, readProps } = require('./rcon');
const { joinBot, command, sleep } = require('./bots');

(async () => {
  const serverDir = path.resolve(process.argv[2] || '../server');
  const port = Number(readProps(serverDir)['server-port'] || 25565);
  const rcon = await connectFromServerDir(serverDir);
  const bot = await joinBot('SetupBot', { port });
  await rcon.cmd('lp user SetupBot parent set owner');
  await sleep(1500);

  // Spawn: centre of the platform, facing south
  await rcon.cmd('minecraft:tp SetupBot 0.5 151 0.5 0 0');
  await sleep(1500);
  console.log(await command(bot, '/setspawn', /spawn/i));

  // /rtp only lands inside the pre-generated area (no chunk generation lag)
  console.log(await command(bot, '/settpr world center', /center/i));
  console.log(await command(bot, '/settpr world minrange 250', /range/i));
  console.log(await command(bot, '/settpr world maxrange 950', /range/i));

  // Warp "wild": on grass, 350 blocks east (chunk must be loaded for the heightmap)
  await rcon.cmd('execute in minecraft:overworld run forceload add 350 0');
  await sleep(1000);
  const onGrass = await rcon.cmd('execute in minecraft:overworld positioned 350.5 0 0.5 positioned over motion_blocking_no_leaves if block ~ ~-1 ~ minecraft:grass_block');
  if (!/passed/i.test(onGrass)) throw new Error('wild warp location is not on grass, pick another spot');
  await rcon.cmd('execute in minecraft:overworld positioned 350.5 0 0.5 positioned over motion_blocking_no_leaves run minecraft:tp SetupBot ~ ~ ~ -90 0');
  await sleep(2500);
  console.log(await command(bot, '/setwarp wild', /warp/i), bot.entity.position.toString());
  await rcon.cmd('execute in minecraft:overworld run forceload remove 350 0');

  // Warp "nether": the obsidian hub at nether 0,64,0 (built by build-spawn.txt)
  await rcon.cmd('execute in minecraft:the_nether run minecraft:tp SetupBot 0.5 64 0.5');
  await sleep(2500);
  console.log(await command(bot, '/setwarp nether', /warp/i), bot.entity.position.toString());

  await rcon.cmd('minecraft:tp SetupBot 0.5 151 0.5');
  bot.quit();
  await sleep(1000);
  await rcon.cmd('lp user SetupBot clear');
  rcon.close();
  console.log('World setup done.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
