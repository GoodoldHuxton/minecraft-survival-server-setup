// Load test used for the spark profile in the README: N bots explore the pre-generated
// area (a random teleport every few seconds) while spark profiles the server.
//   node load-test.js ../server [bots=5] [seconds=120]
const path = require('path');
const { connectFromServerDir, readProps } = require('./rcon');
const { joinBot, sleep } = require('./bots');

(async () => {
  const serverDir = path.resolve(process.argv[2] || '../server');
  const count = Number(process.argv[3] || 5), seconds = Number(process.argv[4] || 120);
  const port = Number(readProps(serverDir)['server-port'] || 25565);
  const rcon = await connectFromServerDir(serverDir);
  const bots = [];
  for (let i = 1; i <= count; i++) {
    const name = `LoadBot${i}`;
    bots.push(await joinBot(name, { port }));
    await sleep(800);
  }
  await rcon.cmd('spark profiler start --timeout ' + seconds);
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    for (const b of bots) {
      const x = Math.floor(Math.random() * 1800) - 900, z = Math.floor(Math.random() * 1800) - 900;
      await rcon.cmd(`execute in minecraft:overworld run minecraft:tp ${b.username} ${x} 200 ${z}`);
    }
    await sleep(4000);
  }
  await sleep(3000);
  console.log((await rcon.cmd('spark tps')) || '(see server log for spark output)');
  for (const b of bots) b.quit();
  rcon.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
