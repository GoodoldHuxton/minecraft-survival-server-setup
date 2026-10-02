// Helpers for driving Mineflayer test bots.
const mineflayer = require('mineflayer');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function joinBot(username, { host = '127.0.0.1', port, version = '26.1' } = {}) {
  return new Promise((resolve, reject) => {
    const bot = mineflayer.createBot({ host, port, username, version, auth: 'offline', hideErrors: true });
    bot.log = [];
    // Keep failure output readable: skip action-bar text and anti-cheat alert spam
    // ('message' carries the fully formatted line for player chat, 'messagestr' the plain text)
    const keep = (m, position) => { if (position !== 'game_info' && !/^Grim »/.test(m)) bot.log.push(m); };
    bot.on('messagestr', keep);
    bot.on('message', (json, position) => keep(json.toString(), position));
    // Bots only move when the server teleports them. With physics on, a bot teleported into a
    // freshly loaded chunk starts falling before the chunk arrives and Paper snaps it back.
    bot.physicsEnabled = false;
    bot.once('spawn', () => resolve(bot));
    bot.once('kicked', r => reject(new Error(`${username} kicked: ${JSON.stringify(r)}`)));
    bot.once('error', reject);
  });
}

// Run a chat command and wait until a message matching `expect` arrives.
async function command(bot, cmd, expect, timeout = 8000) {
  const start = bot.log.length;
  bot.chat(cmd);
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const hit = bot.log.slice(start).find(m => expect.test(m));
    if (hit) return hit;
    await sleep(100);
  }
  throw new Error(`"${cmd}": expected ${expect}, got:\n    ${bot.log.slice(start).join('\n    ') || '(no messages)'}`);
}

async function waitFor(bot, expect, timeout = 8000, from = 0) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const hit = bot.log.slice(from).find(m => expect.test(m));
    if (hit) return hit;
    await sleep(100);
  }
  throw new Error(`expected ${expect}, got:\n    ${bot.log.slice(from).join('\n    ') || '(no messages)'}`);
}

module.exports = { joinBot, command, waitFor, sleep };
