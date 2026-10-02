// Fulghen Survival - end-to-end acceptance tests.
//
// Real (offline-mode) Mineflayer bots join the server, get a rank each and try what
// that rank should and should not be able to do. Console checks go through RCON.
//
//   node run-tests.js ../server                  main suite
//   node run-tests.js ../server --after-restart  persistence checks (run after a restart)
//
// Requires: online-mode=false, RCON enabled, ViaBackwards (download.ps1 -WithTestTools).
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { Vec3 } = require('vec3');
const { connectFromServerDir, readProps } = require('./rcon');
const { joinBot, command, waitFor, sleep } = require('./bots');

const serverDir = path.resolve(process.argv[2] || '../server');
const afterRestart = process.argv.includes('--after-restart');
const port = Number(readProps(serverDir)['server-port'] || 25565);

const DENIED = /permission|do not have access|unknown or incomplete command|unknown command/i;
const results = [];
let rcon;
const bots = {};

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try { await fn(); results.push([name, true]); console.log('PASS'); }
  catch (e) { results.push([name, false, e.message]); console.log('FAIL\n    ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const near = (bot, x, y, z, d = 3) =>
  Math.hypot(bot.entity.position.x - x, bot.entity.position.y - y, bot.entity.position.z - z) < d;
// Chat is checked in the server log: it shows exactly how the server rendered the line
// (the test bots run an older protocol through ViaBackwards and don't always get chat packets).
const latestLog = path.join(serverDir, 'logs', 'latest.log');
const logSize = () => fs.statSync(latestLog).size;
async function waitForLog(re, from, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const fd = fs.openSync(latestLog, 'r');
    const buf = Buffer.alloc(Math.max(0, logSize() - from));
    fs.readSync(fd, buf, 0, buf.length, from); fs.closeSync(fd);
    const text = buf.toString('utf8').replace(/\x1b\[[0-9;]*m/g, '');
    if (re.test(text)) return;
    await sleep(200);
  }
  throw new Error(`server log: expected ${re}`);
}
async function blockIs(x, y, z, block) {
  const out = await rcon.cmd(`execute if block ${x} ${y} ${z} ${block}`);
  return /passed/i.test(out);
}
// Offline-mode UUID, so ranks can be assigned before a bot ever joins
function offlineUuid(name) {
  const h = require('crypto').createHash('md5').update('OfflinePlayer:' + name).digest();
  h[6] = (h[6] & 0x0f) | 0x30; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
async function join(name, rank) {
  const uuid = offlineUuid(name);
  if (rank) await rcon.cmd(`lp user ${uuid} parent set ${rank}`);
  // Bots do not send packets like a real client; keep the anti-cheat off them
  await rcon.cmd(`lp user ${uuid} permission set grim.exempt true`);
  const bot = await joinBot(name, { port });
  bots[name] = bot;
  return bot;
}

// The test bots all connect from 127.0.0.1, but GriefPrevention allows 3 accounts per IP
// (anti-alt), blocks re-joining for 60s after a kick and hides join messages after 5
// logins a minute (anti-spam). Relax these while the tests run, then restore them.
const gpConfig = path.join(serverDir, 'plugins', 'GriefPreventionData', 'config.yml');
let gpOriginal;
async function relaxIpLimit() {
  gpOriginal = fs.readFileSync(gpConfig, 'utf8');
  fs.writeFileSync(gpConfig, gpOriginal
    .replace(/MaxPlayersPerIpAddress: \d+/, 'MaxPlayersPerIpAddress: 10')
    .replace(/LoginCooldownSeconds: \d+/, 'LoginCooldownSeconds: 0')
    .replace(/LoginLogoutNotificationsPerMinute: \d+/, 'LoginLogoutNotificationsPerMinute: 1000'));
  await rcon.cmd('gpreload');
}
async function restoreIpLimit() {
  if (gpOriginal) { fs.writeFileSync(gpConfig, gpOriginal); await rcon.cmd('gpreload'); }
}

async function mainSuite() {
  // The 'wild' warp (set by setup-world.js) is a known safe spot on the ground
  const warpFile = fs.readFileSync(path.join(serverDir, 'plugins', 'Essentials', 'warps', 'wild.yml'), 'utf8');
  const wild = Object.fromEntries(['x', 'y', 'z'].map(k => [k, Number(warpFile.match(new RegExp('^' + k + ': (.+)$', 'm'))[1])]));
  await rcon.cmd('time set day');
  await rcon.cmd('difficulty peaceful');
  // Clean slate for the test users
  for (const n of ['TestMember', 'TestMember2', 'TestVIP', 'TestMod', 'TestAdmin']) {
    await rcon.cmd(`pardon ${n}`); await rcon.cmd(`ess unban ${n}`).catch(() => {});
  }

  console.log('\nServer list');
  await test('MOTD shows the two-line Fulghen Survival banner', async () => {
    const res = await new Promise((ok, fail) =>
      require('minecraft-protocol').ping({ host: '127.0.0.1', port }, (e, r) => (e ? fail(e) : ok(r))));
    const flat = d => (typeof d === 'string' ? d : (d.text || '') + (d.extra || []).map(flat).join(''));
    const motd = flat(res.description);
    assert(/✦ FULGHEN SURVIVAL ✦\n.*Survival • Community • No P2W/.test(motd), 'MOTD: ' + JSON.stringify(motd));
  });

  console.log('\nJoin, chat & tab list');
  const member = await join('TestMember', 'default');
  await rcon.cmd('gamemode survival TestMember');
  await test('Custom join message is broadcast', async () => {
    const from = logSize();
    await join('TestMember2', 'default');
    await waitForLog(/Welcome TestMember2 to Fulghen Survival!/, from);
  });
  const member2 = bots.TestMember2;
  const vip = await join('TestVIP', 'vip');
  const mod = await join('TestMod', 'moderator');
  const admin = await join('TestAdmin', 'admin');
  await sleep(2500);

  await test('Chat format shows rank prefix: [VIP] Name » message', async () => {
    const from = logSize();
    vip.chat('hello boys');
    await waitForLog(/\[VIP\] TestVIP » hello boys/, from);
  });
  await test('Tab list header shows server name, rank and ping', async () => {
    await sleep(1500);
    const header = vip.tablist.header.toString();
    assert(/FULGHEN SURVIVAL/.test(header), 'no server name in header: ' + header);
    assert(/Rank: VIP/.test(header), 'rank not shown: ' + header);
    assert(/Ping: \d+ms/.test(header), 'ping not shown: ' + header);
  });

  console.log('\nMember: basic commands work, staff commands are blocked');
  await test('Member cannot /ban', async () => { await command(member, '/ban TestMember2 test', DENIED); });
  await test('Member cannot /gamemode', async () => { await command(member, '/gamemode creative', DENIED); });
  await test('Member cannot /give', async () => { await command(member, '/give TestMember diamond 64', DENIED); });
  await test('Member cannot roll back (/co rollback)', async () => { await command(member, '/co rollback t:1h r:10', DENIED); });
  await test('Member cannot change ranks (/lp)', async () => {
    member.chat('/lp user TestMember parent set owner');
    await sleep(2000);
    // LuckPerms replies asynchronously (RCON would see an empty answer): read its storage
    const file = path.join(serverDir, 'plugins', 'LuckPerms', 'yaml-storage', 'users', offlineUuid('TestMember') + '.yml');
    const stored = fs.readFileSync(file, 'utf8');
    assert(/primary-group: default/.test(stored) && !/owner/.test(stored), 'member promoted themselves!\n' + stored);
  });
  await test('/spawn teleports to spawn after the 3s warm-up', async () => {
    await rcon.cmd(`execute in minecraft:overworld run minecraft:tp TestMember ${wild.x} ${wild.y} ${wild.z}`); // on solid ground
    await sleep(1000);
    await command(member, '/spawn', /teleport/i);
    await sleep(4500);
    assert(near(member, 0.5, 151, 0.5, 4), 'not at spawn: ' + member.entity.position);
  });
  await test('/sethome + /home work, members are limited to 2 homes', async () => {
    await rcon.cmd('ess homes TestMember').catch(() => {});
    for (const h of ['home', 'base', 'farm', 'mine', 'persist']) await rcon.cmd(`delhome TestMember:${h}`);
    await command(member, '/sethome base', /home.*set/i);
    await command(member, '/sethome farm', /home.*set/i);
    await command(member, '/sethome mine', /cannot set more than 2|maximum|limit/i);
  });
  await test('/tpa request + /tpaccept teleports the player', async () => {
    await rcon.cmd('minecraft:tp TestMember2 8 151 8');
    await sleep(5500); // 5s teleport cooldown after the previous test's /spawn
    const from = member2.log.length;
    await command(member, '/tpa TestMember2', /request sent/i);
    await waitFor(member2, /requested to teleport to you/i, 5000, from);
    await command(member2, '/tpaccept', /accepted/i);
    await sleep(4500);
    assert(near(member, 8, 151, 8, 3), 'tpa did not teleport: ' + member.entity.position);
  });
  await test('/warp wild works', async () => {
    await sleep(5500); // teleport cooldown
    await command(member, '/warp wild', /commence|teleporting/i);
    await sleep(4500);
    assert(near(member, wild.x, wild.y, wild.z, 3), 'not at warp: ' + member.entity.position);
  });

  console.log('\nVIP: cosmetic perks only');
  await test('VIP can use /nick with colours', async () => { await command(vip, '/nick &6Champ', /nickname.*(changed|set)|Champ/i); vip.chat('/nick off'); });
  await test('VIP can open /workbench', async () => {
    const opened = new Promise((res, rej) => { vip.once('windowOpen', res); setTimeout(() => rej(new Error('no window opened')), 5000); });
    vip.chat('/workbench'); await opened; vip.closeWindow(vip.currentWindow);
  });
  await test('VIP can set more homes than a member (5)', async () => {
    for (const h of ['a', 'b', 'c']) await rcon.cmd(`delhome TestVIP:${h}`);
    for (const h of ['a', 'b', 'c']) await command(vip, `/sethome ${h}`, /home.*set/i);
  });
  await test('VIP chat colours work, member colour codes are stripped', async () => {
    const from = logSize();
    vip.chat('&cred from vip'); member2.chat('&cred from member');
    await waitForLog(/TestVIP » red from vip/, from);              // &c turned into colour
    await waitForLog(/TestMember2 » &cred from member/, from);     // left as plain text
  });
  await test('VIP still cannot use staff commands (no P2W)', async () => {
    await command(vip, '/fly', DENIED);
    await command(vip, '/kick TestMember test', DENIED);
  });

  console.log('\nModerator: kick / ban / logs');
  await test('Moderator can /kick', async () => {
    const kicked = new Promise(res => member2.once('end', res));
    mod.chat('/kick TestMember2 test kick');
    await Promise.race([kicked, sleep(6000).then(() => { throw new Error('not kicked'); })]);
    bots.TestMember2 = await joinBot('TestMember2', { port });
  });
  await test('Moderator can /tempban and /unban', async () => {
    const ended = new Promise(res => bots.TestMember2.once('end', res));
    mod.chat('/tempban TestMember2 1m test ban');
    await Promise.race([ended, sleep(6000).then(() => { throw new Error('not banned'); })]);
    await joinBot('TestMember2', { port }).then(b => { b.quit(); throw new Error('banned player could join'); }, () => {});
    await command(mod, '/unban TestMember2', /unbanned/i);
    bots.TestMember2 = await joinBot('TestMember2', { port });
  });
  await test('Moderator can look up block logs (/co lookup)', async () => {
    await command(mod, '/co lookup t:1h r:#global', /CoreProtect|Lookup|No results|----/i);
  });
  await test('Moderator cannot roll back (admin only)', async () => {
    await command(mod, '/co rollback t:1h r:10', DENIED);
  });

  console.log('\nGrief protection & rollback');
  // Deterministic test area in the wild: a flat stone platform at y=119 around 300,300
  await rcon.cmd('execute in minecraft:overworld run forceload add 288 278 312 312');
  await rcon.cmd('execute in minecraft:overworld run fill 290 119 280 310 119 310 minecraft:stone');
  await rcon.cmd('execute in minecraft:overworld run fill 290 120 280 310 125 310 minecraft:air');
  await test('Griefed blocks are logged and /co rollback restores them', async () => {
    await rcon.cmd('execute in minecraft:overworld run minecraft:tp TestMember 300.5 120 300.5 -90 0');
    await rcon.cmd('setblock 302 120 300 minecraft:oak_planks');
    await sleep(2000);
    assert(await blockIs(302, 120, 300, 'minecraft:oak_planks'), 'setup: planks missing');
    await member.dig(member.blockAt(new Vec3(302, 120, 300)), true);
    await sleep(500);
    assert(!(await blockIs(302, 120, 300, 'minecraft:oak_planks')), 'block was not broken');
    await sleep(4000); // CoreProtect writes its queue asynchronously
    await command(admin, '/co rollback u:TestMember t:5m r:#global', /rollback|completed|modified/i, 15000);
    await sleep(2000);
    assert(await blockIs(302, 120, 300, 'minecraft:oak_planks'), 'rollback did not restore the block');
  });
  await test('Claimed land is protected from other players (GriefPrevention)', async () => {
    const m2 = bots.TestMember2;
    await rcon.cmd('execute in minecraft:overworld run minecraft:tp TestMember2 300.5 120 290.5');
    await rcon.cmd('minecraft:item replace entity TestMember2 hotbar.0 with minecraft:golden_shovel');
    await sleep(2000);
    m2.setQuickBarSlot(0);
    await command(m2, '/claim 5', /claim/i);
    await rcon.cmd('setblock 302 120 290 minecraft:oak_planks');
    await rcon.cmd('execute in minecraft:overworld run minecraft:tp TestMember 300.5 120 290.5 -90 0');
    await sleep(2000);
    await member.dig(member.blockAt(new Vec3(302, 120, 290)), true).catch(() => {});
    await sleep(1000);
    assert(await blockIs(302, 120, 290, 'minecraft:oak_planks'), 'block inside claim was broken!');
    m2.chat('/abandonallclaims'); await sleep(500); m2.chat('/abandonallclaims');
  });
  await rcon.cmd('execute in minecraft:overworld run forceload remove 288 278 312 312');

  console.log('\nPersistence (part 1)');
  await test('Saving a home + rank for the restart check', async () => {
    await rcon.cmd('minecraft:tp TestMember 5.5 151 -5.5');
    await sleep(6000);
    for (const h of ['persist', 'farm']) await rcon.cmd(`delhome TestMember:${h}`);
    await command(member, '/sethome persist', /home.*set/i);
    fs.writeFileSync(path.join(__dirname, '.persist.json'), JSON.stringify({ x: 5.5, y: 151, z: -5.5 }));
  });

  console.log('\nBackups');
  await test('backup.bat creates a zip with the world inside (while the server runs)', async () => {
    const before = new Set(fs.existsSync(path.join(serverDir, 'backups')) ? fs.readdirSync(path.join(serverDir, 'backups')) : []);
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(__dirname, '..', 'scripts', 'backup.ps1'), '-ServerDir', serverDir, '-Keep', '14'], { stdio: 'pipe' });
    const created = fs.readdirSync(path.join(serverDir, 'backups')).filter(f => !before.has(f));
    assert(created.length === 1, 'no new backup zip');
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    const list = execFileSync(tar, ['-tf', path.join(serverDir, 'backups', created[0])]).toString();
    assert(/world\/level\.dat/.test(list.replace(/\\/g, '/')), 'world/level.dat missing from zip');
  });
}

async function afterRestartSuite() {
  console.log('\nPersistence (part 2, after restart)');
  const member = await join('TestMember');
  await test('Ranks survive a restart (LuckPerms)', async () => {
    const vip = await join('TestVIP');      // no rank passed: must come from storage
    await sleep(2500);
    assert(/Rank: VIP/.test(vip.tablist.header.toString()), 'TestVIP lost its rank: ' + vip.tablist.header.toString());
  });
  await test('Homes survive a restart (Essentials)', async () => {
    const want = JSON.parse(fs.readFileSync(path.join(__dirname, '.persist.json'), 'utf8'));
    await sleep(5500);
    await command(member, '/home persist', /teleport/i);
    await sleep(4500);
    assert(near(member, want.x, want.y, want.z, 2), 'home moved: ' + member.entity.position);
  });
  await test('Block logs survive a restart (CoreProtect)', async () => {
    // CoreProtect answers lookups asynchronously, so ask through an in-game admin
    const admin = await join('TestAdmin');
    await command(admin, '/co lookup u:TestMember t:1d r:#global', /TestMember (broke|removed|placed)/i, 15000);
  });
}

(async () => {
  rcon = await connectFromServerDir(serverDir);
  console.log(`Fulghen Survival tests against 127.0.0.1:${port}${afterRestart ? ' (after restart)' : ''}`);
  await relaxIpLimit();
  try { await (afterRestart ? afterRestartSuite() : mainSuite()); }
  finally {
    for (const b of Object.values(bots)) try { b.quit(); } catch {}
    await restoreIpLimit();
    await rcon.cmd('difficulty normal');
  }
  const failed = results.filter(r => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  rcon.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
