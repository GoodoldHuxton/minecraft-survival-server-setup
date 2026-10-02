// Minimal Source RCON client (Minecraft's console-over-TCP protocol).
const net = require('net');
const fs = require('fs');
const path = require('path');

function readProps(serverDir) {
  const props = {};
  for (const line of fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) props[m[1].trim()] = m[2].trim();
  }
  return props;
}

class Rcon {
  constructor(host, port, password) { Object.assign(this, { host, port, password }); this.id = 1; this.pending = new Map(); this.buf = Buffer.alloc(0); }
  connect() {
    return new Promise((resolve, reject) => {
      this.sock = net.connect(this.port, this.host, async () => {
        try { await this.send(this.password, 3); resolve(this); } catch (e) { reject(e); }
      });
      this.sock.on('error', reject);
      this.sock.on('data', d => this.onData(d));
    });
  }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 4) {
      const len = this.buf.readInt32LE(0);
      if (this.buf.length < len + 4) break;
      const id = this.buf.readInt32LE(4);
      const body = this.buf.toString('utf8', 12, len + 2);
      this.buf = this.buf.subarray(len + 4);
      if (id === -1) { // failed login
        const a = this.pending.get(this.authId);
        if (a) { this.pending.delete(this.authId); a.reject(new Error('RCON auth failed')); }
        continue;
      }
      const p = this.pending.get(id);
      if (p) { this.pending.delete(id); p.resolve(body.replace(/§./g, '')); }
    }
  }
  send(body, type = 2) {
    const id = this.id++;
    if (type === 3) this.authId = id;
    const payload = Buffer.from(body, 'utf8');
    const pkt = Buffer.alloc(14 + payload.length);
    pkt.writeInt32LE(10 + payload.length, 0); pkt.writeInt32LE(id, 4); pkt.writeInt32LE(type, 8); payload.copy(pkt, 12);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.sock.write(pkt);
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error('RCON timeout: ' + body)); }, 15000);
    });
  }
  cmd(c) { return this.send(c, 2); }
  close() { this.sock.end(); }
}

async function connectFromServerDir(serverDir) {
  const p = readProps(serverDir);
  if (p['enable-rcon'] !== 'true') throw new Error('Enable RCON in server.properties to run the tests');
  return new Rcon('127.0.0.1', Number(p['rcon.port']), p['rcon.password']).connect();
}

module.exports = { Rcon, connectFromServerDir, readProps };
