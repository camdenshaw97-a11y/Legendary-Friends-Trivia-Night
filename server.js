'use strict';
/*
 * Legendary Friends: Trivia Night — the server.
 * One process holds every room in memory. The TV page creates a room, phones join it with a
 * 4-letter code, and the server is the single source of truth: every change is pushed to every
 * screen as a fresh snapshot. Secrets stay here: nobody's phone is sent a right answer until the
 * question is over, and a hidden question's text is only ever sent to the phone that reads it.
 *
 * Built the same way as Friend Feud, Jeopardy, Wheel, Monopoly and Clue: the same join flow, the
 * same reconnect and restart-survival tricks. There is no host: the TV computer picks the worlds,
 * the length of the run and the question packs, and every phone plays.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const Heroes = require('./heroes');
const Worlds = require('./worlds');
const Q = require('./questions');

const PORT = process.env.PORT || 3000;
const PUB = __dirname;
const PAGE_FILES = new Set(['index.html', 'tv.html', 'common.js', 'heroes.js', 'worlds.js', 'style.css', 'anton.woff2', 'baskerville.woff2', 'baskerville-italic.woff2', 'baskerville-bold.woff2']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json'
};

// A fingerprint of the pages as they are right now, so a screen left open across an update reloads itself.
const BUILD = (() => {
  const h = crypto.createHash('sha1');
  for (const f of ['index.html', 'tv.html', 'common.js', 'heroes.js', 'worlds.js', 'style.css']) {
    try { h.update(fs.readFileSync(path.join(PUB, f))); } catch (e) { /* missing file: nothing to add */ }
  }
  return h.digest('hex').slice(0, 12);
})();

/* ---------------------------------------------------------------- rules */

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const BOT_NAMES = ['PIXEL', 'GIZMO', 'RUNE', 'COMET', 'EMBER', 'ZIP', 'MOXIE', 'TURBO'];
const BOT_MS = 1400;
const FIGHT_CHOICES = [2, 3, 4];           // fights before each world's boss
const STRENGTH_CHOICES = ['casual', 'normal', 'legendary'];
const STRENGTH = { casual: 0.75, normal: 1, legendary: 1.3 };   // monster health
const DMG = { casual: 0.55, normal: 0.7, legendary: 1.0 };        // what monsters do to you
const QSECS_CHOICES = [15, 20, 30];
const DEFAULT_PACKS = Heroes.PACKS.filter(p => !p.adult).map(p => p.id);

const SPEED = Number(process.env.SPEED_UP) || 1;   // tests run the clocks faster
const INTRO_MS = 9000;
const FORK_MS = 25000;
const WALK_MS = 2600;
const ENTER_MS = 4200;
const LOCK_MS = 1300;                     // everyone has answered: a beat before the reveal
const RESULT_MS = 5200;
const STRIKE_MS = 3400;
const VICTORY_MS = 6000;
const SHOP_MS = 75000;
const CAMP_MS = 5500;
const TREASURE_MS = 5000;
const WORLD_DONE_MS = 6500;
const REVIVE_MS = 16000;                  // everyone is down: this long to roll before the monster wins
const WORD_MS = 4200;                     // this-or-that: one word
const WORD_GAP_MS = 1100;
const HIDDEN_EXTRA = 12000;
const RIDDLE_MS = 40000;
const LIST_MS = 50000;
const REVIVE_COST = 250;
const ROOM_IDLE_MS = 6 * 60 * 60 * 1000;
const IDLE_MS = 20000;                    // a dropped phone's hero fights on by itself after this

const BOOT = Date.now();
const RESTORE_WINDOW_MS = Number(process.env.RESTORE_WINDOW_MS) || 10 * 60 * 1000;
const RESTORE_GRACE_MS = 5000;
const SEAT_HOLD_MS = Number(process.env.SEAT_HOLD_MS) || 30000;
const STRAGGLER_MS = Number(process.env.STRAGGLER_MS) || 3 * 60 * 1000;
const BACKUP_V = 1;
const BACKUP_DELAY_MS = 200;
const BACKUP_MAX = 380 * 1024;
const BACKUP_KEY = (() => {
  let seed = process.env.BACKUP_KEY || process.env.RENDER_SERVICE_ID;
  if (!seed) {
    const file = path.join(__dirname, '.backup-key');
    try { seed = fs.readFileSync(file, 'utf8').trim(); } catch (e) { /* first run */ }
    if (!seed) {
      seed = crypto.randomBytes(32).toString('hex');
      try { fs.writeFileSync(file, seed + '\n', { mode: 0o600 }); } catch (e) { /* read-only disk */ }
    }
  }
  return crypto.createHash('sha256').update('legendary-friends room backup|' + seed).digest();
})();

const DEFAULT_SETTINGS = { worlds: ['halloween', 'west', 'space'], fights: 3, final: true, strength: 'normal', qSecs: 20, packs: DEFAULT_PACKS };
const rooms = new Map();

/* ------------------------------------------------------------------ http */

const server = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, 'http://localhost'); } catch (e) { res.writeHead(400); return res.end(); }
  let p;
  try { p = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (p === '/version') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(BUILD); }
  if (p === '/uptime') {
    res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    return res.end('started ' + new Date(BOOT).toISOString() + ' · up ' + Math.round((Date.now() - BOOT) / 1000) + 's');
  }
  if (p === '/qr.svg') {
    const text = (u.searchParams.get('u') || '').slice(0, 300);
    return QRCode.toString(text || ' ', { type: 'svg', margin: 1, errorCorrectionLevel: 'L' }, (err, svg) => {
      if (err) { res.writeHead(500); return res.end(); }
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' });
      res.end(svg);
    });
  }
  if (p === '/') p = '/index.html';
  if (p === '/tv') p = '/tv.html';
  const rel = p.replace(/^\/+/, '');
  if (!PAGE_FILES.has(rel)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
  const file = path.join(PUB, rel);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file);
    if (ext === '.html') data = Buffer.from(String(data).replace('<html lang="en">', '<html lang="en" data-build="' + BUILD + '">'));
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.woff2' ? 'public, max-age=604800' : 'no-cache' });
    res.end(data);
  });
});

/* --------------------------------------------------------------- helpers */

const rid = (n = 12) => crypto.randomBytes(n).toString('base64url');
const d20 = () => crypto.randomInt(20) + 1;
const pick = a => a[crypto.randomInt(a.length)];
const chance = p => crypto.randomInt(1000) < p * 1000;
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function makeCode() {
  const letters = 'BCDFGHJKLMNPQRSTVWXZ';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += letters[crypto.randomInt(letters.length)];
    if (!rooms.has(c)) return c;
  }
}
function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function cleanSettings(s) {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  if (!s || typeof s !== 'object') return out;
  if (Array.isArray(s.worlds)) { const w = s.worlds.filter(id => Worlds.worldById(id) && id !== 'final').slice(0, 6); if (w.length) out.worlds = w; }
  if (FIGHT_CHOICES.includes(s.fights)) out.fights = s.fights;
  if (typeof s.final === 'boolean') out.final = s.final;
  if (STRENGTH_CHOICES.includes(s.strength)) out.strength = s.strength;
  if (QSECS_CHOICES.includes(s.qSecs)) out.qSecs = s.qSecs;
  if (Array.isArray(s.packs)) { const p = s.packs.filter(id => Heroes.PACKS.some(x => x.id === id)); if (p.length) out.packs = p; }
  return out;
}

/* ----------------------------------------------------------------- rooms */

function newRoom() {
  const room = {
    code: makeCode(), adminToken: rid(), touched: Date.now(), displays: new Set(), players: new Map(),
    order: [], settings: Object.assign({}, DEFAULT_SETTINGS), chats: {}, game: null, fx: [], fxSeq: 0, timer: null, botTimer: null
  };
  rooms.set(room.code, room);
  return room;
}
function fx(room, type, data) {
  room.fx.push(Object.assign({ seq: ++room.fxSeq, type }, data || {}));
  if (room.fx.length > 18) room.fx.shift();
}
const pname = (room, id) => { const p = room.players.get(id); return p ? p.name : '?'; };
const seats = room => room.order.filter(id => room.players.has(id));
const captainId = room => {
  const ids = seats(room).filter(id => !room.players.get(id).bot && !(room.game && room.game.players[id] && room.game.players[id].left));
  return ids.find(id => room.players.get(id).connected) || ids[0] || null;
};
const heroTaken = (room, h, except) => [...room.players.values()].some(x => x !== except && room.order.includes(x.id) && x.hero === h);
function freeHero(room) { return (Heroes.HEROES.find(h => !heroTaken(room, h.id, null)) || Heroes.HEROES[0]).id; }

/* ---------------------------------------------------- surviving a restart */

function packRoom(room, lean, kind) {
  const data = {
    v: BACKUP_V, at: Date.now(), kind: kind || 'backup', code: room.code, adminToken: room.adminToken,
    players: [...room.players.values()].map(p => ({ id: p.id, token: p.token, name: p.name, hero: p.hero, bot: !!p.bot })),
    order: room.order, settings: room.settings, chats: lean ? {} : room.chats, game: room.game, fxSeq: room.fxSeq
  };
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', BACKUP_KEY, iv);
  const body = Buffer.concat([c.update(zlib.deflateRawSync(JSON.stringify(data))), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
}
function unpackRoom(blob) {
  const raw = Buffer.from(String(blob), 'base64');
  if (raw.length < 30) throw new Error('too short');
  const d = crypto.createDecipheriv('aes-256-gcm', BACKUP_KEY, raw.subarray(0, 12), { authTagLength: 16 });
  d.setAuthTag(raw.subarray(12, 28));
  const body = Buffer.concat([d.update(raw.subarray(28)), d.final()]);
  return JSON.parse(zlib.inflateRawSync(body, { maxOutputLength: 16 * 1024 * 1024 }));
}
function sendBackup(room) {
  if (rooms.get(room.code) !== room) return;
  const to = [...room.displays].filter(ws => ws.admin && ws.readyState === 1);
  if (!to.length) return;
  let blob;
  try { blob = packRoom(room, false); } catch (e) { return console.error('backup error', e); }
  if (blob.length > BACKUP_MAX) return;
  const msg = JSON.stringify({ t: 'backup', code: room.code, blob, info: saveInfo(room) });
  for (const ws of to) ws.send(msg);
}
function queueBackup(room) {
  if (room.backupTimer) return;
  room.backupTimer = setTimeout(() => { room.backupTimer = null; sendBackup(room); }, BACKUP_DELAY_MS);
}
function saveInfo(room) {
  const g = room.game;
  return {
    at: Date.now(), players: seats(room).map(id => pname(room, id)), phase: g ? g.phase : 'lobby',
    world: g ? worldOf(g).name : '', progress: g ? ('world ' + (g.wi + 1) + ' of ' + g.run.length) : '', fights: g ? g.fightsWon : 0
  };
}
function hydrateRoom(d, code, opts) {
  const room = {
    code, adminToken: opts.adminToken, touched: Date.now(), displays: new Set(), players: new Map(), order: d.order || [],
    settings: cleanSettings(d.settings), chats: d.chats && typeof d.chats === 'object' ? d.chats : {}, game: d.game, fx: [], fxSeq: (d.fxSeq || 0) + 50, timer: null, botTimer: null
  };
  const hold = Date.now() + SEAT_HOLD_MS;
  for (const p of d.players) {
    if (p.bot) room.players.set(p.id, { id: p.id, token: p.token, name: p.name, hero: p.hero, bot: true, connected: true, ws: null, hold: 0, goneAt: 0 });
    else room.players.set(p.id, { id: p.id, token: opts.freshTokens ? rid() : p.token, name: p.name, hero: p.hero, connected: false, ws: null, hold: opts.freshTokens ? 0 : hold, goneAt: Date.now(), waitingFor: true });
  }
  const g = room.game;
  if (g && g.clock) {
    const used = Math.max(0, Math.min(Number(opts.idle) || 0, 10 * 60 * 1000));
    g.clock.at = Date.now() + Math.max(0, g.clock.at - d.at - used) + RESTORE_GRACE_MS;
    if (opts.freshTokens) freshClock(room);
  }
  if (g && opts.freshTokens) g.started = Date.now() - (g.played || 0);
  return room;
}
function restoreRoom(blob, code, token, idle) {
  let d;
  try { d = unpackRoom(blob); } catch (e) { return null; }
  if (!d || d.v !== BACKUP_V || d.code !== code || !token || d.adminToken !== token) return null;
  if (!(Date.now() - d.at < ROOM_IDLE_MS) || rooms.has(code)) return null;
  const room = hydrateRoom(d, code, { adminToken: d.adminToken, idle });
  try { publicState(room); } catch (e) { console.error('restore error', e); return null; }
  rooms.set(code, room);
  armTimer(room); scheduleBots(room);
  room.tidyTimer = setTimeout(() => {
    room.tidyTimer = null;
    if (rooms.get(code) !== room || room.game) return;
    let gone = 0;
    for (const p of [...room.players.values()]) if (!p.connected && !room.order.includes(p.id)) { room.players.delete(p.id); gone++; }
    if (gone) pushAll(room);
  }, STRAGGLER_MS);
  fx(room, 'restored');
  console.log('restored room ' + code + ' (' + room.players.size + ' players, ' + (room.game ? room.game.phase : 'lobby') + ')');
  return room;
}
function loadRoom(blob) {
  let d;
  try { d = unpackRoom(blob); } catch (e) { return null; }
  if (!d || d.v !== BACKUP_V || !d.game) return null;
  const code = makeCode();
  const room = hydrateRoom(d, code, { adminToken: rid(), freshTokens: true });
  try { publicState(room); } catch (e) { console.error('load error', e); return null; }
  rooms.set(code, room);
  armTimer(room); scheduleBots(room);
  fx(room, 'loaded');
  console.log('loaded saved game as room ' + code);
  return room;
}

/* ------------------------------------------------------------ the clock */

function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } }
function setClock(room, what, ms, show) {
  ms = Math.round(ms / SPEED);
  room.game.clock = { what, at: Date.now() + ms, len: ms, show: !!show };
  armTimer(room);
}
function stopClock(room) { if (room.game) room.game.clock = null; clearTimer(room); }
function armTimer(room) {
  clearTimer(room);
  const g = room.game;
  if (!g || !g.clock) return;
  const c = g.clock;
  room.timer = setTimeout(() => {
    room.timer = null;
    if (room.game !== g || g.clock !== c) return;
    g.clock = null;
    try { onClock(room, c.what); } catch (e) { console.error('clock error', e); }
    pushAll(room);
  }, Math.max(0, c.at - Date.now()));
}
function onClock(room, what) {
  switch (what) {
    case 'intro': startFork(room); break;
    case 'fork': resolveFork(room); break;
    case 'walk': arrive(room); break;
    case 'enter': askQuestion(room); break;
    case 'answer': resolveQuestion(room); break;
    case 'word': nextWord(room); break;
    case 'result': afterResult(room); break;
    case 'strike': afterStrike(room); break;
    case 'revive': if (allDown(room.game)) wipe(room); else nextQuestion(room); break;
    case 'victory': leaveNode(room); break;
    case 'shop': leaveNode(room); break;
    case 'camp': leaveNode(room); break;
    case 'treasure': leaveNode(room); break;
    case 'worldDone': nextWorld(room); break;
    case 'auto': autoAct(room); break;
  }
}
// The clock a phase starts with, for a game picked up again.
function freshClock(room) {
  const g = room.game;
  g.clock = null;
  switch (g.phase) {
    case 'intro': setClock(room, 'intro', INTRO_MS); break;
    case 'fork': setClock(room, 'fork', FORK_MS, true); break;
    case 'walk': setClock(room, 'walk', WALK_MS); break;
    case 'enter': setClock(room, 'enter', ENTER_MS); break;
    case 'between': setClock(room, 'enter', 700); break;
    case 'question': if (g.q.t === 'tot') setClock(room, 'word', WORD_MS, true); else setClock(room, 'answer', questionMs(g), true); break;
    case 'result': setClock(room, 'result', RESULT_MS); break;
    case 'strike': setClock(room, 'strike', STRIKE_MS); break;
    case 'revive': setClock(room, 'revive', REVIVE_MS, true); break;
    case 'victory': setClock(room, 'victory', VICTORY_MS); break;
    case 'shop': setClock(room, 'shop', SHOP_MS, true); break;
    case 'camp': setClock(room, 'camp', CAMP_MS); break;
    case 'treasure': setClock(room, 'treasure', TREASURE_MS); break;
    case 'worldDone': setClock(room, 'worldDone', WORLD_DONE_MS); break;
    default: armTimer(room);
  }
}

/* ------------------------------------------------------------ the game */

const P = (g, id) => g.players[id];
const inParty = g => g.order.filter(id => g.players[id] && !g.players[id].left);
const standing = g => inParty(g).filter(id => !g.players[id].down);
const allDown = g => standing(g).length === 0;
const heroOf = p => Heroes.heroById(p.hero);
const worldOf = g => Worlds.worldById(g.world) || Worlds.FINAL;
const isFinal = g => g.world === 'final';

function log(room, text, kind, data) {
  const g = room.game;
  g.log.push(Object.assign({ n: ++g.logSeq, text, kind: kind || '' }, data || {}));
  if (g.log.length > 60) g.log.shift();
}

function newHero(room, id) {
  const h = heroOf(room.players.get(id));
  return {
    hero: h.id, hp: Heroes.HEALTH[h.health], maxHp: Heroes.HEALTH[h.health], coins: 0, down: false, left: false, items: [],
    buffs: {}, used: {}, oxygen: false,
    stats: { right: 0, wrong: 0, damage: 0, gold: 0, revives: 0, downs: 0, gifts: 0, firsts: 0, hits: 0, spent: 0, bought: 0 }
  };
}

function startGame(room) {
  const ids = seats(room);
  if (ids.length < MIN_PLAYERS || ids.length > MAX_PLAYERS) return;
  const s = room.settings;
  const run = s.worlds.slice();
  const players = {};
  for (const id of ids) players[id] = newHero(room, id);
  room.game = {
    phase: 'intro', started: Date.now(), played: 0,
    run, fights: s.fights, final: s.final, strength: s.strength, qSecs: s.qSecs, packs: s.packs.slice(),
    wi: 0, world: run[0], level: 0, fork: null, node: null, fight: null, q: null, result: null, strike: null, shop: null,
    order: ids.slice(), players, used: [], usedMonsters: [], readerIdx: 0, fightsWon: 0, bossesWon: 0, questions: 0,
    log: [], logSeq: 0, clock: null, awards: null, why: null
  };
  const g = room.game;
  log(room, 'The party sets out for ' + worldOf(g).name + '.', 'world');
  fx(room, 'start');
  setClock(room, 'intro', INTRO_MS);
}

/* -------- the path */

function monsterPool(g) {
  const w = worldOf(g);
  const left = w.monsters.filter(m => !g.usedMonsters.includes(g.world + ':' + m.id));
  return left.length ? left : w.monsters.slice();
}
function fightNode(g) {
  const m = pick(monsterPool(g));
  g.usedMonsters.push(g.world + ':' + m.id);
  const fav = m.types[0];
  return { kind: 'fight', monster: m.id, label: Heroes.TYPES[fav].short, type: fav };
}
function makeFork(g) {
  const w = worldOf(g);
  let a, b;
  if (g.level >= g.fights) {
    // The last stop before the boss: stock up or rest.
    a = { kind: 'shop', label: w.shop.title }; b = { kind: 'camp', label: 'Rest at ' + w.camp.name };
  } else if (g.level === 0) {
    a = fightNode(g); b = fightNode(g);
  } else {
    a = fightNode(g);
    const roll = crypto.randomInt(100);
    if (!g.shopSeen && roll < 55) b = { kind: 'shop', label: w.shop.title };
    else if (roll < 70) b = { kind: 'treasure', label: 'Treasure: ' + w.treasure.name };
    else if (roll < 82) b = { kind: 'camp', label: 'Rest at ' + w.camp.name };
    else b = fightNode(g);
  }
  if (b.kind === 'shop') g.shopSeen = true;
  const opts = chance(0.5) ? [a, b] : [b, a];
  // Two fights on one fork should ask differently.
  if (opts[0].kind === 'fight' && opts[1].kind === 'fight' && opts[0].type === opts[1].type) {
    const m = Worlds.monsterOf(w, opts[1].monster), alt = m.types.find(t => t !== opts[0].type);
    if (alt) { opts[1].type = alt; opts[1].label = Heroes.TYPES[alt].short; }
  }
  return { options: opts, votes: {}, locked: null };
}
function startFork(room) {
  const g = room.game;
  if (isFinal(g)) { g.node = { kind: 'fight', monster: Worlds.FINAL.boss.id, boss: true, final: true, label: 'The Quizmaster' }; g.fork = null; g.phase = 'walk'; setClock(room, 'walk', WALK_MS); return; }
  if (g.level > g.fights) {
    // Past the last fork: the boss waits.
    const w = worldOf(g);
    g.node = { kind: 'fight', monster: w.boss.id, boss: true, label: w.boss.name };
    g.fork = null; g.phase = 'walk';
    setClock(room, 'walk', WALK_MS);
    return;
  }
  g.fork = makeFork(g);
  g.phase = 'fork';
  setClock(room, 'fork', FORK_MS, true);
}
function vote(room, p, i) {
  const g = room.game;
  if (!g || g.phase !== 'fork' || !g.fork || g.fork.locked != null) return;
  if (i !== 0 && i !== 1) return;
  if (!inParty(g).includes(p.id)) return;
  g.fork.votes[p.id] = i;
  checkVotes(room);
}
function checkVotes(room) {
  const g = room.game;
  if (!g || g.phase !== 'fork' || !g.fork || g.fork.locked != null) return;
  const voters = inParty(g).filter(id => room.players.get(id) && (room.players.get(id).connected || room.players.get(id).bot));
  if (voters.length && voters.every(id => g.fork.votes[id] != null)) { stopClock(room); resolveFork(room); }
}
function lockFork(room, i) {
  const g = room.game;
  if (!g || g.phase !== 'fork' || !g.fork) return;
  if (i === 0 || i === 1) g.fork.locked = i;
  stopClock(room); resolveFork(room);
}
function resolveFork(room) {
  const g = room.game, f = g.fork;
  if (!f) return;
  let choice = f.locked;
  if (choice == null) {
    const n = [0, 0];
    for (const id of Object.keys(f.votes)) n[f.votes[id]]++;
    if (n[0] !== n[1]) choice = n[0] > n[1] ? 0 : 1;
    else { const cap = captainId(room); choice = cap != null && f.votes[cap] != null ? f.votes[cap] : crypto.randomInt(2); }
  }
  f.chosen = choice;
  g.node = f.options[choice];
  g.phase = 'walk';
  fx(room, 'path', { i: choice });
  log(room, 'The party heads for ' + nodeName(g, g.node) + '.', 'path');
  setClock(room, 'walk', WALK_MS);
}
function nodeName(g, n) {
  const w = worldOf(g);
  if (n.kind === 'fight') return (n.boss ? 'the boss: ' : 'a fight: ') + Worlds.monsterOf(w, n.monster).name;
  if (n.kind === 'shop') return w.shop.title;
  if (n.kind === 'camp') return w.camp.name;
  return w.treasure.name;
}
function arrive(room) {
  const g = room.game, n = g.node, w = worldOf(g);
  g.fork = null;
  if (n.kind === 'fight') { startFight(room); return; }
  if (n.kind === 'shop') {
    const stock = ['heal', 'hint', 'revive'].concat(shuffle(Heroes.ITEMS.map(i => i.id).filter(i => !['heal', 'hint', 'revive'].includes(i))).slice(0, 3));
    g.shop = { items: stock, done: {}, line: pick(w.shop.lines), bought: [] };
    g.phase = 'shop';
    log(room, 'Welcome to ' + w.shop.title + '. “' + g.shop.line + '”', 'shop');
    fx(room, 'shop');
    setClock(room, 'shop', SHOP_MS, true);
    return;
  }
  if (n.kind === 'camp') {
    for (const id of inParty(g)) {
      const p = P(g, id);
      if (p.down) { p.down = false; p.hp = Math.round(p.maxHp * 0.3); log(room, pname(room, id) + ' wakes up at ' + w.camp.name + '.', 'heal'); }
      else p.hp = Math.min(p.maxHp, p.hp + 250);
    }
    g.phase = 'camp';
    log(room, w.camp.line, 'camp');
    fx(room, 'camp');
    setClock(room, 'camp', CAMP_MS);
    return;
  }
  // treasure: gold for everyone, and an item for the lucky
  g.treasure = { got: {} };
  for (const id of inParty(g)) {
    const p = P(g, id);
    const coins = 100 + crypto.randomInt(4) * 25;
    p.coins += coins; p.stats.gold += coins;
    const item = chance(0.5) && p.items.length < Heroes.MAX_ITEMS ? pick(Heroes.ITEMS).id : null;
    if (item) { p.items.push(item); applyPassive(g, p, item); }
    g.treasure.got[id] = { coins, item };
  }
  g.phase = 'treasure';
  log(room, w.treasure.line, 'treasure');
  fx(room, 'treasure');
  setClock(room, 'treasure', TREASURE_MS);
}
function leaveNode(room) {
  const g = room.game;
  stopClock(room);
  g.shop = null; g.treasure = null;
  if (g.node && g.node.kind === 'fight' && g.node.boss) {
    if (isFinal(g)) { endGame(room, 'legend'); return; }
    g.phase = 'worldDone';
    log(room, worldOf(g).done, 'world');
    fx(room, 'worldDone');
    setClock(room, 'worldDone', WORLD_DONE_MS);
    return;
  }
  g.level++;
  g.node = null; g.fight = null;
  startFork(room);
}
function nextWorld(room) {
  const g = room.game;
  g.wi++;
  g.level = 0; g.node = null; g.fight = null; g.shopSeen = false;
  if (g.wi >= g.run.length) {
    if (!g.final) { endGame(room, 'legend'); return; }
    g.world = 'final';
  } else g.world = g.run[g.wi];
  g.phase = 'intro';
  log(room, 'The party sets out for ' + worldOf(g).name + '.', 'world');
  fx(room, 'world');
  setClock(room, 'intro', INTRO_MS);
}
function skipIntro(room) {
  const g = room.game;
  if (!g || g.phase !== 'intro') return;
  stopClock(room); startFork(room);
}

/* -------- fights */

// Monster health for this party: the numbers in worlds.js are for four heroes. A fight should
// take a sharp party four or five questions, a boss about ten, the Quizmaster a dozen.
function scale(g, n, boss, final) {
  const party = Math.max(2, inParty(g).length);
  const k = final ? 1 : boss ? 1.2 : 1.4;
  return Math.round(n * k * STRENGTH[g.strength] * party / 4);
}
function startFight(room) {
  const g = room.game, w = worldOf(g), m = Worlds.monsterOf(w, g.node.monster);
  const boss = !!g.node.boss;
  g.fight = {
    id: m.id, name: m.name, emoji: m.emoji, hp: scale(g, m.hp, boss, isFinal(g)), maxHp: scale(g, m.hp, boss, isFinal(g)), hurt: Math.round(m.hurt * DMG[g.strength]),
    strike: Object.assign({}, m.strike, { amount: Math.round(m.strike.amount * DMG[g.strength]), every: (m.strike.every || 3) + (g.strength === 'legendary' ? 0 : 1) }), types: m.types, voice: m.voice,
    boss, final: isFinal(g), intro: m.intro, taunt: m.taunt, dead: m.dead, finisher: m.finisher || null, finisherDone: false,
    qCount: 0, strikes: 0, decoy: false, shieldWall: false, damageBy: {}, retry: 0
  };
  for (const id of inParty(g)) { const p = P(g, id); p.used = {}; }
  g.phase = 'enter';
  log(room, m.intro, 'enter');
  fx(room, 'enter', { boss });
  setClock(room, 'enter', ENTER_MS);
}

function pickType(room) {
  const g = room.game, f = g.fight;
  if (f.boss && f.finisher && !f.finisherDone && f.hp <= f.maxHp * 0.3) { f.finisherDone = true; return { t: f.finisher, finisher: true }; }
  let t = g.fight.qCount === 0 && g.node.type ? g.node.type : pick(f.types);
  if (t === 'hidden' && standing(g).length < 3) t = 'mc';
  if (t === 'picture' && standing(g).length < 2) t = 'mc';
  return { t };
}
function pickQuestion(room, t, tried) {
  const g = room.game;
  const pool = Q.ALL.filter(q => q.t === t && g.packs.includes(q.pack));
  let left = pool.filter(q => !g.used.includes(q.id));
  if (!left.length && pool.length) {
    // Every question of this kind in the packs has been asked: recycle the oldest.
    g.used = g.used.filter(id => !pool.some(q => q.id === id));
    left = pool;
  }
  if (!left.length) {
    tried = (tried || []).concat(t);
    const other = Q.TYPES.find(x => !tried.includes(x));
    return other ? pickQuestion(room, other, tried) : null;
  }
  const q = pick(left);
  g.used.push(q.id);
  return q;
}
function questionMs(g) {
  const base = g.qSecs * 1000;
  switch (g.q.t) {
    case 'hidden': return base + HIDDEN_EXTRA;
    case 'riddle': return RIDDLE_MS;
    case 'list': return LIST_MS;
    case 'double': return base + 5000;
    default: return base;
  }
}
function askQuestion(room) {
  const g = room.game, f = g.fight;
  const want = pickType(room);
  const src = pickQuestion(room, want.t);
  if (!src) { endGame(room, 'noquestions'); return; }
  const text = Worlds.voiced(f.voice, src.q);
  const q = { id: src.id, t: src.t, text, pack: src.pack, hint: src.h || null, finisher: !!want.finisher, asked: Date.now(), hints: {}, struck: [], timeUsed: false, done: false };
  const up = standing(g);
  switch (src.t) {
    case 'mc': {
      const idx = shuffle([0, 1, 2, 3]);
      q.opts = idx.map(i => src.a[i]); q.right = idx.indexOf(0); q.answers = {};
      break;
    }
    case 'double': {
      const idx = shuffle([0, 1, 2, 3]);
      q.opts = idx.map(i => src.a[i]); q.rights = [idx.indexOf(0), idx.indexOf(1)]; q.answers = {};
      break;
    }
    case 'hidden': {
      // The reader rotates through the standing party; everyone else holds one answer.
      const order = up.slice();
      q.reader = order[g.readerIdx % order.length]; g.readerIdx++;
      const holders = order.filter(id => id !== q.reader);
      const n = Math.max(3, Math.min(src.a.length, holders.length));
      const wrong = shuffle(src.a.slice(1)).slice(0, n - 1);
      q.opts = shuffle([src.a[0]].concat(wrong)); q.right = q.opts.indexOf(src.a[0]);
      q.holders = {};
      const slots = shuffle(q.opts.map((_, i) => i));
      holders.forEach((id, k) => { q.holders[id] = slots[k % slots.length]; });
      q.claims = []; q.out = [];
      break;
    }
    case 'list': {
      q.want = src.a.map(x => x.slice()); q.n = src.n || src.a.length; q.found = []; q.wrong = {}; q.tries = {};
      break;
    }
    case 'picture': {
      q.cards = shuffle(src.c.map(c => ({ e: c[0], label: c[1], truth: c[2] })));
      q.holders = {};
      const slots = shuffle(q.cards.map((_, i) => i));
      up.forEach((id, k) => { q.holders[id] = slots[k % slots.length]; });
      q.answers = {};
      break;
    }
    case 'tot': {
      q.o = src.o.slice(); q.words = shuffle(src.w.slice()).slice(0, 8); q.wi = 0; q.answers = {}; q.wordAt = Date.now(); q.gap = false;
      break;
    }
    case 'riddle': {
      q.accepted = src.a.slice(); q.answers = {};
      break;
    }
  }
  g.q = q; g.result = null;
  g.phase = 'question';
  g.questions++;
  fx(room, 'question', { t: q.t, finisher: q.finisher });
  if (q.t === 'tot') setClock(room, 'word', WORD_MS, true);
  else setClock(room, 'answer', questionMs(g), true);
}
function nextQuestion(room) {
  const g = room.game;
  g.q = null; g.result = null; g.strike = null;
  g.phase = 'between';
  setClock(room, 'enter', 700);
}

// Everyone who can answer has: a beat, then the reveal.
function maybeLock(room) {
  const g = room.game, q = g.q;
  if (!q || q.done || g.phase !== 'question' || q.t === 'tot' || q.t === 'list') return;
  const up = standing(g);
  let all;
  if (q.t === 'hidden') all = false;
  else all = up.every(id => q.answers[id] && !q.answers[id].retrying);
  if (all) { q.locked = true; setClock(room, 'answer', LOCK_MS); }
}

/* -------- answers */

const first = (q, id) => { const a = Object.values(q.answers || {}).filter(x => x.ok && !x.retried); return a.length === 1 && q.answers[id] === a[0]; };

function answer(room, p, m) {
  const g = room.game, q = g.q;
  if (!g || g.phase !== 'question' || !q || q.done) return;
  const me = P(g, p.id);
  if (!me || me.down || me.left) return;
  switch (q.t) {
    case 'mc': {
      const i = Number(m.i);
      if (!Number.isInteger(i) || i < 0 || i >= q.opts.length) return;
      if (q.answers[p.id] && !q.answers[p.id].retrying) return;
      if (q.struck.includes(i)) return;
      const ok = i === q.right;
      if (!ok && me.buffs.second && !(q.answers[p.id] && q.answers[p.id].retrying)) {
        delete me.buffs.second;
        q.answers[p.id] = { i, ok: false, at: Date.now(), retrying: true, struck: [i] };
        fx(room, 'second', { pid: p.id });
        return;
      }
      const prev = q.answers[p.id];
      q.answers[p.id] = { i, ok, at: Date.now(), retried: !!(prev && prev.retrying) };
      if (ok && first(q, p.id)) q.answers[p.id].first = true;
      break;
    }
    case 'double': {
      const picks = Array.isArray(m.picks) ? m.picks.map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < 4 && !q.struck.includes(i)) : [];
      if (new Set(picks).size !== 2) return;
      if (q.answers[p.id] && !q.answers[p.id].retrying) return;
      const hits = picks.filter(i => q.rights.includes(i)).length;
      if (hits < 2 && me.buffs.second && !(q.answers[p.id] && q.answers[p.id].retrying)) {
        delete me.buffs.second;
        q.answers[p.id] = { picks, hits, ok: false, at: Date.now(), retrying: true, struck: picks.filter(i => !q.rights.includes(i)) };
        fx(room, 'second', { pid: p.id });
        return;
      }
      const prev = q.answers[p.id];
      q.answers[p.id] = { picks, hits, ok: hits === 2, at: Date.now(), retried: !!(prev && prev.retrying) };
      if (hits === 2 && first(q, p.id)) q.answers[p.id].first = true;
      break;
    }
    case 'hidden': {
      if (q.holders[p.id] == null) return;
      const i = q.holders[p.id];
      if (q.claims.some(c => c.pid === p.id)) return;
      const ok = i === q.right;
      q.claims.push({ pid: p.id, i, ok, at: Date.now() });
      if (ok) { q.winner = p.id; stopClock(room); resolveQuestion(room); return; }
      q.out.push(i);
      fx(room, 'wrongClaim', { pid: p.id });
      // Wrong claim: it costs the claimer right away, so the room sees it.
      hurt(room, p.id, Math.round(g.fight.hurt * 0.8), 'claim');
      if (allDown(g)) { stopClock(room); resolveQuestion(room); }
      return;
    }
    case 'list': {
      const text = clean(m.text, 60);
      if (!text) return;
      q.tries[p.id] = (q.tries[p.id] || 0) + 1;
      if (q.tries[p.id] > 40) return;
      const k = q.want.findIndex(names => Q.matches(text, names));
      if (k < 0) { q.wrong[p.id] = (q.wrong[p.id] || 0) + 1; send(p.ws, { t: 'listed', text, ok: false }); hurt(room, p.id, 25, 'list'); if (allDown(g)) { stopClock(room); resolveQuestion(room); } return; }
      if (q.found.some(f => f.k === k)) { send(p.ws, { t: 'listed', text, ok: true, dup: true }); return; }
      q.found.push({ k, by: p.id, text: q.want[k][0], at: Date.now() });
      send(p.ws, { t: 'listed', text, ok: true });
      fx(room, 'found', { pid: p.id, k });
      if (q.found.length >= q.n) { stopClock(room); resolveQuestion(room); return; }
      break;
    }
    case 'picture': {
      if (q.holders[p.id] == null) return;
      if (q.answers[p.id] && !q.answers[p.id].retrying) return;
      const v = !!m.v, truth = q.cards[q.holders[p.id]].truth, ok = v === truth;
      if (!ok && me.buffs.second && !(q.answers[p.id] && q.answers[p.id].retrying)) {
        delete me.buffs.second;
        q.answers[p.id] = { v, ok: false, at: Date.now(), retrying: true };
        fx(room, 'second', { pid: p.id });
        return;
      }
      const prev = q.answers[p.id];
      q.answers[p.id] = { v, ok, at: Date.now(), retried: !!(prev && prev.retrying) };
      if (ok && first(q, p.id)) q.answers[p.id].first = true;
      break;
    }
    case 'tot': {
      if (q.gap) return;
      const i = Number(m.i);
      if (i !== 0 && i !== 1) return;
      const list = q.answers[p.id] || (q.answers[p.id] = []);
      if (list[q.wi] != null) return;
      list[q.wi] = i;
      // The word moves on as soon as everyone standing has tapped.
      if (standing(g).every(id => (q.answers[id] || [])[q.wi] != null)) { stopClock(room); nextWord(room); }
      return;
    }
    case 'riddle': {
      const text = clean(m.text, 60);
      if (!text) return;
      if (q.answers[p.id] && !q.answers[p.id].retrying) return;
      const ok = Q.matches(text, q.accepted);
      if (!ok && me.buffs.second && !(q.answers[p.id] && q.answers[p.id].retrying)) {
        delete me.buffs.second;
        q.answers[p.id] = { text, ok: false, at: Date.now(), retrying: true };
        fx(room, 'second', { pid: p.id });
        return;
      }
      const prev = q.answers[p.id];
      q.answers[p.id] = { text, ok, at: Date.now(), retried: !!(prev && prev.retrying) };
      if (ok && first(q, p.id)) q.answers[p.id].first = true;
      break;
    }
  }
  maybeLock(room);
}

// This or that: the word's time is up (or everyone tapped). Show it, then the next one.
function nextWord(room) {
  const g = room.game, q = g.q;
  if (!q || q.t !== 'tot' || q.done) return;
  if (!q.gap) {
    q.gap = true;
    setClock(room, 'word', WORD_GAP_MS, false);
    fx(room, 'word', { i: q.wi, right: q.words[q.wi][1] });
    return;
  }
  q.gap = false; q.wi++;
  if (q.wi >= q.words.length) { resolveQuestion(room); return; }
  q.wordAt = Date.now();
  setClock(room, 'word', WORD_MS, true);
}

/* -------- damage and gold */

function hurt(room, id, amount, why) {
  const g = room.game, p = P(g, id), h = heroOf(room.players.get(id));
  if (!p || p.down) return 0;
  if (h.id === 'robot') amount = Math.round(amount * 0.75);
  if (why === 'strike' && h.id === 'ghost' && chance(0.5)) { fx(room, 'phase', { pid: id }); return 0; }
  if (why === 'strike' && p.buffs.shield) { delete p.buffs.shield; fx(room, 'blocked', { pid: id }); return 0; }
  p.hp -= amount;
  p.stats.hits++;
  if (p.hp <= 0) {
    p.hp = 0;
    if (p.items.includes('revive')) {
      p.items.splice(p.items.indexOf('revive'), 1);
      p.hp = p.maxHp;
      log(room, pname(room, id) + ' goes down… and springs right back up. Auto-Revive!', 'revive');
      fx(room, 'autorevive', { pid: id });
    } else if (h.id === 'astronaut' && !p.oxygen) {
      p.oxygen = true; p.hp = Math.round(p.maxHp / 2);
      log(room, pname(room, id) + ' goes down… Oxygen Reserve kicks in. Back up at half health.', 'revive');
      fx(room, 'autorevive', { pid: id });
    } else {
      p.down = true; p.stats.downs++;
      log(room, pname(room, id) + ' is down!', 'down');
      fx(room, 'down', { pid: id });
    }
  }
  return amount;
}
function heal(room, id, amount) {
  const g = room.game, p = P(g, id);
  if (!p || p.down) return;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}
function hit(room, id, amount, kind) {
  const g = room.game, f = g.fight, p = P(g, id);
  if (!f) return 0;
  amount = Math.round(amount);
  f.hp = Math.max(0, f.hp - amount);
  p.stats.damage += amount;
  f.damageBy[id] = (f.damageBy[id] || 0) + amount;
  return amount;
}
function pay(room, id, amount) {
  const g = room.game, p = P(g, id), h = heroOf(room.players.get(id));
  if (g.fight && g.fight.boss && h.id === 'bounty') amount *= 2;
  amount = Math.round(amount);
  p.coins += amount; p.stats.gold += amount;
  return amount;
}
function attackOf(room, id, mult, firstHit) {
  const g = room.game, p = P(g, id), h = heroOf(room.players.get(id));
  let a = Heroes.ATTACK[h.attack] * (mult || 1);
  let notes = [];
  if (h.id === 'gunslinger' && firstHit) { a *= 2; notes.push('Quickdraw'); }
  if (p.buffs.double) { delete p.buffs.double; a *= 2; notes.push('Double-Damage Scroll'); }
  return { a, notes };
}
function rightAnswer(room, id, mult, goldMult, firstHit) {
  const g = room.game, p = P(g, id), h = heroOf(room.players.get(id));
  const { a, notes } = attackOf(room, id, mult, firstHit);
  const dmg = hit(room, id, a);
  const gold = pay(room, id, Heroes.GOLD[h.gold] * (goldMult || 1));
  p.stats.right++;
  if (firstHit) p.stats.firsts++;
  if (h.id === 'vampire') { heal(room, id, 60); notes.push('Drain'); }
  return { ok: true, dmg, gold, notes };
}
function wrongAnswer(room, id, mult, why) {
  const g = room.game, p = P(g, id);
  p.stats.wrong++;
  const dmg = hurt(room, id, Math.round(g.fight.hurt * (mult || 1)), why || 'wrong');
  return { ok: false, lost: dmg };
}

function resolveQuestion(room) {
  const g = room.game, q = g.q, f = g.fight;
  if (!q || q.done) return;
  q.done = true;
  stopClock(room);
  const up = standing(g);
  const res = { t: q.t, by: {}, hits: 0, text: '' };
  const firstOk = (() => { const a = Object.entries(q.answers || {}).filter(([, x]) => x.ok).sort((x, y) => x[1].at - y[1].at); return a.length ? a[0][0] : null; })();
  switch (q.t) {
    case 'mc': case 'picture': case 'riddle': {
      for (const id of up) {
        const a = q.answers[id];
        if (a && a.ok) res.by[id] = rightAnswer(room, id, q.t === 'riddle' ? 1.5 : 1, q.t === 'riddle' ? 1.5 : 1, firstOk === id);
        else res.by[id] = Object.assign(wrongAnswer(room, id, 1), { froze: !a });
      }
      res.reveal = q.t === 'mc' ? { right: q.right } : q.t === 'picture' ? { truths: q.cards.map(c => c.truth) } : { answer: q.accepted[0] };
      break;
    }
    case 'double': {
      for (const id of up) {
        const a = q.answers[id], hits = a ? a.hits : 0;
        if (hits === 2) res.by[id] = rightAnswer(room, id, 1.25, 1.25, firstOk === id);
        else if (hits === 1) { const r = rightAnswer(room, id, 0.5, 0.5, false); r.half = true; res.by[id] = r; }
        else res.by[id] = Object.assign(wrongAnswer(room, id, 1), { froze: !a });
      }
      res.reveal = { rights: q.rights };
      break;
    }
    case 'hidden': {
      if (q.winner) {
        // A team hit: everyone standing swings, the holder gets the glory.
        let total = 0;
        for (const id of up) {
          const { a, notes } = attackOf(room, id, 0.75, false);
          total += hit(room, id, a);
          const gold = pay(room, id, Heroes.GOLD[heroOf(room.players.get(id)).gold] * (id === q.winner ? 1 : 0.5));
          res.by[id] = { ok: true, dmg: Math.round(a), gold, notes, holder: id === q.winner };
          if (id === q.winner) P(g, id).stats.right++;
        }
        res.team = total;
      } else {
        for (const id of up) res.by[id] = Object.assign(wrongAnswer(room, id, 0.5, 'timeout'), { froze: true });
      }
      res.reveal = { right: q.right, winner: q.winner || null, question: q.text };
      break;
    }
    case 'list': {
      const complete = q.found.length >= q.n;
      for (const id of up) {
        const mine = q.found.filter(x => x.by === id).length;
        if (mine) { const r = rightAnswer(room, id, 0.5 * mine, 0.5 * mine, false); r.n = mine; res.by[id] = r; }
        else res.by[id] = { ok: false, n: 0 };
      }
      if (!complete) {
        res.incomplete = true;
        for (const id of up) { const lost = hurt(room, id, Math.round(f.hurt * 0.75), 'list'); if (res.by[id]) res.by[id].lost = lost; P(g, id).stats.wrong++; }
      }
      res.reveal = { all: q.want.map(x => x[0]), found: q.found.map(x => x.k) };
      break;
    }
    case 'tot': {
      for (const id of up) {
        const mine = q.answers[id] || [];
        let right = 0, wrong = 0;
        q.words.forEach((w, i) => { if (mine[i] === w[1]) right++; else wrong++; });
        const r = { right, wrong, ok: right > wrong };
        if (right) { const rr = rightAnswer(room, id, 0.3 * right, 0.25 * right, false); r.dmg = rr.dmg; r.gold = rr.gold; r.notes = rr.notes; P(g, id).stats.right += right - 1; }
        if (wrong) { r.lost = hurt(room, id, Math.round(f.hurt * 0.3 * wrong), 'tot'); P(g, id).stats.wrong += wrong; }
        res.by[id] = r;
      }
      res.reveal = { words: q.words };
      break;
    }
  }
  // Downed players still see what the answer was.
  for (const id of inParty(g)) if (!res.by[id]) res.by[id] = { out: true };
  res.hits = Object.values(res.by).reduce((n, r) => n + (r.dmg || 0), 0);
  g.result = res;
  g.phase = 'result';
  fx(room, 'result', { hits: res.hits, dead: f.hp <= 0 });
  if (f.hp <= 0) { log(room, f.name + ' takes ' + res.hits + ' and goes down!', 'kill'); }
  else if (res.hits) log(room, 'The party hits ' + f.name + ' for ' + res.hits + '.', 'hit');
  setClock(room, 'result', RESULT_MS);
}

function afterResult(room) {
  const g = room.game, f = g.fight;
  if (f.hp <= 0) { victory(room); return; }
  if (allDown(g)) { reviveWindow(room); return; }
  f.qCount++;
  const every = f.strike.every || 3;
  if (f.qCount % every === 0) { doStrike(room); return; }
  nextQuestion(room);
}
function reviveWindow(room) {
  const g = room.game;
  if (!canAnyoneRevive(room)) { wipe(room); return; }
  g.phase = 'revive';
  log(room, 'Everyone is down! Roll for your lives.', 'down');
  fx(room, 'allDown');
  setClock(room, 'revive', REVIVE_MS, true);
}
function canAnyoneRevive(room) {
  const g = room.game;
  return inParty(g).some(id => { const p = P(g, id); return p.down && p.coins >= reviveCost(g); });
}
function reviveCost(g) {
  // The Bard's Encore: cheaper while he's on his feet.
  const bard = standing(g).some(id => P(g, id).hero === 'bard');
  return REVIVE_COST - (bard ? 100 : 0);
}
function revive(room, p) {
  const g = room.game, me = P(g, p.id);
  if (!g || !me || !me.down || me.left) return;
  if (!['question', 'result', 'strike', 'revive', 'shop', 'enter', 'victory', 'fork', 'walk'].includes(g.phase)) return;
  const cost = reviveCost(g);
  if (me.coins < cost) { send(p.ws, { t: 'error', msg: 'You need ' + cost + ' gold to roll for your life.' }); return; }
  let roll = d20(), lucky = false;
  if (me.items.includes('lucky')) { me.items.splice(me.items.indexOf('lucky'), 1); roll = Math.max(roll, d20()); lucky = true; }
  me.coins -= cost; me.stats.spent += cost;
  let hp;
  if (roll === 20) { hp = me.maxHp; me.coins += cost; me.stats.spent -= cost; }
  else hp = Math.max(100, Math.round(me.maxHp * roll / 20));
  me.down = false; me.hp = hp; me.stats.revives++;
  log(room, pname(room, p.id) + ' rolls a ' + roll + (roll === 20 ? ' — a natural 20! Full health, and the dice pay the fee.' : ' and gets back up with ' + hp + ' health.'), 'revive');
  fx(room, 'revive', { pid: p.id, roll, hp, lucky, nat20: roll === 20 });
  if (g.phase === 'revive') { stopClock(room); nextQuestion(room); }
}

function doStrike(room) {
  const g = room.game, f = g.fight;
  let kind = f.strike.kind, amount = f.strike.amount;
  if (f.strike.alt && f.strikes % 2 === 1) { kind = f.strike.alt; amount = Math.round(f.strike.altAmount * DMG[g.strength]); }
  f.strikes++;
  const s = { kind, amount, by: {}, decoy: false, wall: null, heal: 0 };
  if (f.decoy) {
    f.decoy = false; s.decoy = true;
    log(room, f.name + ' strikes… the scarecrow. Straw everywhere.', 'strike');
  } else {
    const up = standing(g);
    if (kind === 'rob') {
      for (const id of up) { const p = P(g, id); const took = Math.min(p.coins, amount); p.coins -= took; s.by[id] = { coins: took }; }
      log(room, f.name + ' robs the party of up to ' + amount + ' gold each.', 'strike');
    } else {
      const dmg = kind === 'drain' ? Math.round(amount * 0.8) : amount;
      // Shield Wall: once per fight the Knight takes the weakest teammate's hit as well as his own.
      const knight = up.find(id => P(g, id).hero === 'knight' && !f.shieldWall);
      let shielded = null;
      if (knight && up.length > 1) {
        shielded = up.filter(id => id !== knight).sort((a, b) => P(g, a).hp - P(g, b).hp)[0];
        f.shieldWall = true; s.wall = { knight, for: shielded };
      }
      let total = 0;
      for (const id of up) {
        if (id === shielded) { s.by[id] = { hp: 0, shielded: true }; continue; }
        const lost = hurt(room, id, dmg, 'strike');
        total += lost;
        s.by[id] = { hp: lost };
      }
      if (shielded) { const extra = hurt(room, knight, dmg, 'strike'); s.by[knight].hp += extra; s.by[knight].wall = true; total += extra; }
      if (kind === 'drain') { s.heal = Math.round(total * 0.5); f.hp = Math.min(f.maxHp, f.hp + s.heal); }
      log(room, f.name + ' strikes the party for ' + dmg + '!' + (s.heal ? ' It drinks ' + s.heal + ' back.' : ''), 'strike');
    }
  }
  g.strike = s;
  g.phase = 'strike';
  fx(room, 'strike', { kind, decoy: s.decoy });
  setClock(room, 'strike', STRIKE_MS);
}
function afterStrike(room) {
  const g = room.game;
  g.strike = null;
  if (allDown(g)) { reviveWindow(room); return; }
  nextQuestion(room);
}

function victory(room) {
  const g = room.game, f = g.fight, w = worldOf(g);
  g.fightsWon++;
  if (f.boss) g.bossesWon++;
  const loot = { coins: f.boss ? (f.final ? 300 : 150) : 50, items: {} };
  for (const id of inParty(g)) {
    const p = P(g, id);
    if (p.down) continue;
    pay(room, id, loot.coins);
    if (f.boss && p.items.length < Heroes.MAX_ITEMS) { const it = pick(Heroes.ITEMS).id; p.items.push(it); loot.items[id] = it; }
    else if (!f.boss && chance(0.25) && p.items.length < Heroes.MAX_ITEMS) { const it = pick(Heroes.ITEMS.filter(i => i.price <= 150)).id; p.items.push(it); loot.items[id] = it; }
  }
  // The fallen get up for free when the fight is won, with a little health.
  for (const id of inParty(g)) { const p = P(g, id); if (p.down) { p.down = false; p.hp = 150; } }
  g.loot = loot;
  g.phase = 'victory';
  log(room, f.dead, 'win');
  fx(room, 'victory', { boss: f.boss, final: f.final });
  setClock(room, 'victory', VICTORY_MS);
}

function wipe(room) {
  const g = room.game;
  stopClock(room);
  g.phase = 'wipe';
  log(room, g.fight.name + ' stands over the whole party. ' + g.fight.taunt, 'wipe');
  fx(room, 'wipe');
}
function retryFight(room) {
  const g = room.game;
  if (!g || g.phase !== 'wipe') return;
  const f = g.fight;
  f.hp = f.maxHp; f.qCount = 0; f.strikes = 0; f.decoy = false; f.shieldWall = false; f.finisherDone = false; f.retry++;
  for (const id of inParty(g)) { const p = P(g, id); p.down = false; p.hp = Math.round(p.maxHp / 2); p.used = {}; }
  log(room, 'The party rises again. ' + f.name + ' is waiting.', 'enter');
  fx(room, 'retry');
  g.phase = 'enter';
  setClock(room, 'enter', ENTER_MS);
}

/* -------- items and abilities */

function applyPassive(g, p, item) { /* passives are read straight from the bag */ }

function useItem(room, p, m) {
  const g = room.game, me = P(g, p.id), q = g.q;
  if (!g || !me || me.left) return;
  const id = String(m.item || '');
  if (!me.items.includes(id)) return;
  const it = Heroes.item(id);
  if (!it) return;
  const h = heroOf(p);
  const take = () => me.items.splice(me.items.indexOf(id), 1);
  const inFight = ['question', 'result', 'strike', 'enter'].includes(g.phase);
  switch (id) {
    case 'heal': {
      if (me.down) return;
      take();
      const amt = h.id === 'witch' ? 600 : 300;
      heal(room, p.id, amt);
      log(room, pname(room, p.id) + ' drinks a Healing Potion. +' + amt + '.', 'heal');
      fx(room, 'drink', { pid: p.id, item: id });
      break;
    }
    case 'hint': {
      if (!q || g.phase !== 'question' || q.done || me.down) return;
      if (q.hints[p.id]) return;
      let hint = null;
      if (q.t === 'mc') {
        const wrong = q.opts.map((_, i) => i).filter(i => i !== q.right && !q.struck.includes(i) && !((q.answers[p.id] || {}).struck || []).includes(i));
        if (wrong.length) hint = { struck: pick(wrong) };
      } else if (q.t === 'double') {
        const wrong = q.opts.map((_, i) => i).filter(i => !q.rights.includes(i) && !q.struck.includes(i));
        if (wrong.length) hint = { struck: pick(wrong) };
      } else if (q.t === 'hidden' && q.holders[p.id] != null) {
        hint = { text: q.holders[p.id] === q.right ? 'Your answer is the one. Shout it!' : 'It isn’t yours. Sit tight.' };
      } else if (q.t === 'picture' && q.holders[p.id] != null) {
        hint = { text: q.hint || 'Trust your gut.' };
      } else if (q.t === 'riddle' || q.t === 'list') {
        hint = { text: q.hint || (q.t === 'riddle' ? 'Starts with “' + q.accepted[0].replace(/^(a|an|the) /i, '').charAt(0).toUpperCase() + '”.' : 'No hint for this one.') };
      } else return;
      if (!hint) return;
      take();
      q.hints[p.id] = hint;
      fx(room, 'drink', { pid: p.id, item: id });
      break;
    }
    case 'time': {
      if (!q || g.phase !== 'question' || q.done || q.timeUsed || q.t === 'tot') return;
      take();
      q.timeUsed = true;
      const left = g.clock ? Math.max(0, g.clock.at - Date.now()) : 0;
      setClock(room, 'answer', left * SPEED + 10000, true);
      log(room, pname(room, p.id) + ' bends time. Ten more seconds.', 'item');
      fx(room, 'time', { pid: p.id });
      break;
    }
    case 'decoy': {
      if (!g.fight || !inFight || g.fight.decoy) return;
      take();
      g.fight.decoy = true;
      log(room, pname(room, p.id) + ' plants a Scarecrow Decoy. The next strike hits straw.', 'item');
      fx(room, 'decoy', { pid: p.id });
      break;
    }
    case 'mystery': {
      if (me.down) return;
      take();
      const roll = crypto.randomInt(100);
      let said;
      if (roll < 18) { heal(room, p.id, 500); said = 'Delicious. +500 health.'; }
      else if (roll < 30) { me.hp = me.maxHp; said = 'Full health! Tastes like victory.'; }
      else if (roll < 45) { pay(room, p.id, 100); said = 'There were coins in it. +100 gold.'; }
      else if (roll < 58) { if (me.items.length < Heroes.MAX_ITEMS) { const it = pick(Heroes.ITEMS.filter(i => i.id !== 'mystery')).id; me.items.push(it); said = 'It turns into a ' + Heroes.item(it).name + '!'; } else said = 'It tried to become something, but your bag is full.'; }
      else if (roll < 70) { hurt(room, p.id, 120, 'mystery'); said = 'Ugh. −120 health. Tasted like a wet sock.'; }
      else if (roll < 80) { const took = Math.min(me.coins, 60); me.coins -= took; said = 'Your pockets feel lighter. −' + took + ' gold.'; }
      else if (roll < 88 && g.fight && g.fight.hp > 0) { g.fight.hp = Math.min(g.fight.maxHp, g.fight.hp + 200); said = 'Oops. The monster heals 200.'; }
      else if (roll < 95) { me.buffs.double = true; said = 'You feel strong. Your next right answer hits twice.'; }
      else said = 'Nothing happens. Grape.';
      log(room, pname(room, p.id) + ' drinks the Mystery Potion. ' + said, 'item');
      fx(room, 'mystery', { pid: p.id, said });
      break;
    }
    case 'double': { if (me.buffs.double) return; take(); me.buffs.double = true; fx(room, 'arm', { pid: p.id, item: id }); break; }
    case 'shield': { if (me.buffs.shield) return; take(); me.buffs.shield = true; fx(room, 'arm', { pid: p.id, item: id }); break; }
    case 'second': { if (me.buffs.second) return; take(); me.buffs.second = true; fx(room, 'arm', { pid: p.id, item: id }); break; }
    default: return;   // revive and lucky work from the bag
  }
}
function gift(room, p, m) {
  const g = room.game, me = P(g, p.id);
  if (!g || !me || me.left) return;
  const id = String(m.item || ''), to = String(m.to || ''), other = P(g, to);
  if (!me.items.includes(id) || !other || other.left || to === p.id) return;
  if (other.items.length >= Heroes.MAX_ITEMS) { send(p.ws, { t: 'error', msg: pname(room, to) + '’s bag is full.' }); return; }
  me.items.splice(me.items.indexOf(id), 1);
  other.items.push(id);
  me.stats.gifts++;
  log(room, pname(room, p.id) + ' gives ' + Heroes.item(id).name + ' to ' + pname(room, to) + '.', 'gift');
  fx(room, 'gift', { from: p.id, to, item: id });
}
function ability(room, p, m) {
  const g = room.game, me = P(g, p.id), q = g.q;
  if (!g || !me || me.down || me.left) return;
  const h = heroOf(p);
  if (h.id === 'mage') {
    if (!q || g.phase !== 'question' || q.done || me.used.clair) return;
    let wrong;
    if (q.t === 'mc') wrong = q.opts.map((_, i) => i).filter(i => i !== q.right && !q.struck.includes(i));
    else if (q.t === 'double') wrong = q.opts.map((_, i) => i).filter(i => !q.rights.includes(i) && !q.struck.includes(i));
    else if (q.t === 'hidden') wrong = q.opts.map((_, i) => i).filter(i => i !== q.right && !q.struck.includes(i) && !q.out.includes(i));
    else return;
    if (!wrong.length) return;
    me.used.clair = true;
    q.struck.push(pick(wrong));
    log(room, pname(room, p.id) + ' sees through the lies. One wrong answer vanishes for everyone.', 'item');
    fx(room, 'clair', { pid: p.id });
  }
}

/* -------- the shop */

function buy(room, p, m) {
  const g = room.game, me = P(g, p.id), s = g.shop;
  if (!g || g.phase !== 'shop' || !s || !me || me.left) return;
  const id = String(m.item || '');
  if (!s.items.includes(id)) return;
  const it = Heroes.item(id);
  if (me.coins < it.price) { send(p.ws, { t: 'error', msg: 'Not enough gold. ' + it.name + ' is ' + it.price + '.' }); return; }
  if (me.items.length >= Heroes.MAX_ITEMS) { send(p.ws, { t: 'error', msg: 'Your bag is full (' + Heroes.MAX_ITEMS + ' items).' }); return; }
  me.coins -= it.price; me.stats.spent += it.price; me.stats.bought++;
  me.items.push(id);
  s.bought.push({ pid: p.id, item: id });
  delete s.done[p.id];
  fx(room, 'buy', { pid: p.id, item: id });
}
function shopDone(room, p) {
  const g = room.game, s = g.shop;
  if (!g || g.phase !== 'shop' || !s) return;
  s.done[p.id] = true;
  const need = inParty(g).filter(id => room.players.get(id) && (room.players.get(id).connected || room.players.get(id).bot));
  if (need.every(id => s.done[id])) leaveNode(room);
}

/* -------- the end */

function endGame(room, why) {
  const g = room.game;
  stopClock(room);
  g.phase = 'gameOver'; g.why = why;
  g.played = Date.now() - g.started;
  g.legend = why === 'legend';
  g.awards = awards(room);
  if (why === 'legend') log(room, (g.final && isFinal(g) ? Worlds.FINAL.done : 'The run is complete. You are legends.'), 'win');
  else if (why === 'fell') log(room, 'The party falls. Their legend ends here… for tonight.', 'wipe');
  else if (why === 'early') log(room, 'The TV ends the run.', 'wipe');
  fx(room, 'gameOver', { why });
}
function awards(room) {
  const g = room.game;
  const rows = inParty(g).map(id => ({ id, name: pname(room, id), s: P(g, id).stats, p: P(g, id) }));
  const out = [];
  const top = (fn, min) => rows.map(r => ({ r, v: fn(r) })).filter(x => x.v >= min).sort((a, b) => b.v - a.v)[0];
  const mvp = top(r => r.s.damage, 1);
  if (mvp) out.push({ key: 'mvp', title: 'MONSTER SLAYER', id: mvp.r.id, name: mvp.r.name, note: mvp.v + ' damage' });
  const rich = top(r => r.s.gold, 1);
  if (rich) out.push({ key: 'rich', title: 'MONEYBAGS', id: rich.r.id, name: rich.r.name, note: rich.v + ' gold earned' });
  const sharp = top(r => (r.s.right + r.s.wrong >= 8 ? r.s.right / (r.s.right + r.s.wrong) : 0), 0.01);
  if (sharp) out.push({ key: 'sharp', title: 'SHARPSHOOTER', id: sharp.r.id, name: sharp.r.name, note: Math.round(sharp.v * 100) + '% right' });
  const quick = top(r => r.s.firsts, 2);
  if (quick) out.push({ key: 'quick', title: 'QUICK DRAW', id: quick.r.id, name: quick.r.name, note: 'first to the answer ' + quick.v + ' times' });
  const kind = top(r => r.s.gifts, 1);
  if (kind) out.push({ key: 'kind', title: 'TEAM PLAYER', id: kind.r.id, name: kind.r.name, note: kind.v + ' items given away' });
  const glass = top(r => r.s.downs, 2);
  if (glass) out.push({ key: 'glass', title: 'GLASS CANNON', id: glass.r.id, name: glass.r.name, note: 'down ' + glass.v + ' times' });
  const got = new Set(), spread = [];
  for (const a of out) if (!got.has(a.id)) { got.add(a.id); spread.push(a); }
  return spread.slice(0, 5);
}

/* -------- playing for a phone that isn't there */

function autoAct(room) { /* nothing is waited on by one player; dropped phones simply don't answer */ }

/* -------- private messages between two phones */

const chatKey = (a, b) => [a, b].sort().join('|');
function chat(room, p, m) {
  const to = String(m.to || ''), other = room.players.get(to);
  if (!other || other === p || other.bot) return;
  const text = clean(m.text, 240);
  if (!text) return;
  const k = chatKey(p.id, to);
  const list = room.chats[k] || (room.chats[k] = []);
  list.push({ from: p.id, text, at: Date.now() });
  if (list.length > 60) list.shift();
}
function chatsFor(room, pid) {
  const out = {};
  for (const k of Object.keys(room.chats)) {
    const [a, b] = k.split('|');
    if (a === pid || b === pid) out[a === pid ? b : a] = room.chats[k];
  }
  return out;
}

/* -------- bots */

function addBot(room) {
  if (seats(room).length >= MAX_PLAYERS) return;
  const used = new Set([...room.players.values()].map(p => p.name));
  const name = BOT_NAMES.find(n => !used.has(n)) || ('BOT ' + crypto.randomInt(100, 999));
  const p = { id: rid(6), token: rid(), name, hero: freeHero(room), bot: true, connected: true, ws: null, hold: 0, goneAt: 0 };
  room.players.set(p.id, p);
  room.order.push(p.id);
  if (room.game) { room.game.players[p.id] = newHero(room, p.id); room.game.order.push(p.id); log(room, name + ' jumps in!', 'join'); }
  fx(room, 'joined', { name: p.name, pid: p.id, bot: true });
}
const isBot = (room, id) => { const p = room.players.get(id); return !!(p && p.bot); };
const nerve = (id, salt) => (crypto.createHash('sha1').update(id + '|' + (salt || '')).digest()[0] / 255);

function botHasWork(room) {
  const g = room.game;
  if (!g || ['gameOver', 'wipe', 'intro', 'walk', 'enter', 'between', 'result', 'strike', 'victory', 'camp', 'treasure', 'worldDone'].includes(g.phase)) return false;
  return inParty(g).some(id => isBot(room, id));
}
function scheduleBots(room) {
  if (room.botTimer || !botHasWork(room)) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (rooms.get(room.code) !== room) return;
    let changed = false;
    try { changed = botTick(room); } catch (e) { console.error('bot error', e); }
    if (changed) pushAll(room); else scheduleBots(room);
  }, (BOT_MS + crypto.randomInt(1200)) / SPEED);
}
function botTick(room) {
  const g = room.game;
  let changed = false;
  for (const id of inParty(g)) {
    if (!isBot(room, id)) continue;
    const p = room.players.get(id), me = P(g, id);
    const skill = 0.5 + nerve(id, 'skill') * 0.3;   // 50–80% right
    if (me.down) {
      if (me.coins >= reviveCost(g) && ['question', 'result', 'strike', 'revive', 'shop'].includes(g.phase)) { revive(room, p); changed = true; }
      continue;
    }
    if (me.hp < me.maxHp * 0.35 && me.items.includes('heal') && g.phase !== 'result') { useItem(room, p, { item: 'heal' }); changed = true; }
    if (g.phase === 'fork' && g.fork && g.fork.votes[id] == null) {
      const want = g.fork.options.findIndex(o => o.kind === 'shop');
      vote(room, p, want >= 0 && me.coins >= 150 && me.items.length < 2 ? want : crypto.randomInt(2));
      changed = true; continue;
    }
    if (g.phase === 'shop' && g.shop && !g.shop.done[id]) {
      const afford = g.shop.items.filter(i => Heroes.item(i).price <= me.coins && me.items.length < Heroes.MAX_ITEMS);
      if (afford.length && chance(0.6) && me.items.length < 3) buy(room, p, { item: pick(afford) });
      else shopDone(room, p);
      changed = true; continue;
    }
    if (g.phase === 'question' && g.q && !g.q.done) {
      const q = g.q, d = Date.now() - q.asked;
      const ready = d > (1500 + nerve(id, q.id) * 4000) / SPEED;
      switch (q.t) {
        case 'mc': if (!q.answers[id] && ready) { const ok = chance(skill); const wrong = q.opts.map((_, i) => i).filter(i => i !== q.right && !q.struck.includes(i)); answer(room, p, { i: ok || !wrong.length ? q.right : pick(wrong) }); changed = true; } break;
        case 'double': if (!q.answers[id] && ready) { const wrong = q.opts.map((_, i) => i).filter(i => !q.rights.includes(i)); const picks = chance(skill) ? q.rights.slice() : chance(0.6) ? [q.rights[0], pick(wrong)] : wrong.slice(0, 2); answer(room, p, { picks }); changed = true; } break;
        case 'hidden': if (q.holders[id] != null && ready && !q.claims.some(c => c.pid === id)) { const mine = q.holders[id] === q.right; if (mine ? chance(0.85) : chance(0.04)) { answer(room, p, {}); changed = true; } } break;
        case 'picture': if (!q.answers[id] && ready && q.holders[id] != null) { const truth = q.cards[q.holders[id]].truth; answer(room, p, { v: chance(skill) ? truth : !truth }); changed = true; } break;
        case 'tot': if (!q.gap && (q.answers[id] || [])[q.wi] == null && Date.now() - q.wordAt > (600 + nerve(id, q.id + q.wi) * 1800) / SPEED) { const w = q.words[q.wi]; answer(room, p, { i: chance(skill) ? w[1] : 1 - w[1] }); changed = true; } break;
        case 'riddle': if (!q.answers[id] && d > (4000 + nerve(id, q.id) * 8000) / SPEED) { answer(room, p, { text: chance(skill * 0.7) ? q.accepted[0] : 'a horse' }); changed = true; } break;
        case 'list': {
          const mine = (q.tries[id] || 0), gap = (2500 + nerve(id, q.id + mine) * 2500) / SPEED;
          if (d > gap * (mine + 1) && mine < q.n) {
            const left = q.want.map((x, k) => k).filter(k => !q.found.some(f => f.k === k));
            if (left.length && chance(skill)) answer(room, p, { text: q.want[pick(left)][0] });
            else answer(room, p, { text: 'banana' + mine });
            changed = true;
          }
          break;
        }
      }
    }
  }
  return changed;
}

/* ----------------------------------------------------- lobby and TV actions */

function adminAction(room, m) {
  const g = room.game;
  switch (m.a) {
    case 'start': if (!g) startGame(room); return;
    case 'settings': if (!g) room.settings = cleanSettings(Object.assign({}, room.settings, m.settings || {})); return;
    case 'kick': { const x = room.players.get(m.id); if (x) dropPlayer(room, x, true); return; }
    case 'addBot': if (!g || g.phase !== 'gameOver') addBot(room); return;
    case 'removeBot': {
      if (g) return;
      const bots = seats(room).map(id => room.players.get(id)).filter(x => x.bot);
      const x = m.id ? room.players.get(m.id) : bots[bots.length - 1];
      if (x && x.bot) dropPlayer(room, x, true);
      return;
    }
    case 'lobby': if (g) { stopClock(room); room.game = null; fx(room, 'lobby'); } return;
    case 'endGame': if (g && g.phase !== 'gameOver') endGame(room, 'early'); return;
    case 'skipIntro': skipIntro(room); return;
    case 'lockPath': lockFork(room, Number(m.i)); return;
    case 'leaveShop': if (g && g.phase === 'shop') leaveNode(room); return;
    case 'retry': retryFight(room); return;
    case 'giveUp': if (g && g.phase === 'wipe') endGame(room, 'fell'); return;
    case 'skip': if (g && ['victory', 'camp', 'treasure', 'worldDone', 'result'].includes(g.phase) && g.clock) { const w = g.clock.what; stopClock(room); onClock(room, w); } return;
  }
}

/* ----------------------------------------------------------------- state */

function publicQ(g) {
  const q = g.q;
  if (!q) return null;
  const done = q.done;
  const out = { id: q.id, t: q.t, pack: q.pack, finisher: q.finisher, struck: q.struck, done, timeUsed: q.timeUsed, n: 0 };
  switch (q.t) {
    case 'mc': out.text = q.text; out.opts = q.opts; out.answered = Object.keys(q.answers).filter(id => !q.answers[id].retrying); if (done) out.right = q.right; break;
    case 'double': out.text = q.text; out.opts = q.opts; out.answered = Object.keys(q.answers).filter(id => !q.answers[id].retrying); if (done) out.rights = q.rights; break;
    case 'hidden':
      out.reader = q.reader; out.opts = q.opts; out.holders = q.holders; out.out = q.out; out.claims = q.claims.map(c => ({ pid: c.pid, i: c.i, ok: c.ok }));
      if (done) { out.text = q.text; out.right = q.right; out.winner = q.winner || null; }
      break;
    case 'list': out.text = q.text; out.n = q.n; out.total = q.want.length; out.found = q.found.map(f => ({ k: f.k, by: f.by, text: f.text })); if (done) out.all = q.want.map(x => x[0]); break;
    case 'picture': out.text = q.text; out.cards = q.cards.map(c => ({ e: c.e, label: c.label })); out.holders = q.holders; out.answered = Object.keys(q.answers).filter(id => !q.answers[id].retrying); if (done) out.truths = q.cards.map(c => c.truth); break;
    case 'tot': out.text = q.text; out.o = q.o; out.wi = q.wi; out.gap = q.gap; out.word = q.words[q.wi] ? q.words[q.wi][0] : null; out.count = q.words.length; out.tapped = Object.keys(q.answers).filter(id => (q.answers[id] || [])[q.wi] != null); if (q.gap || done) out.wordRight = q.words[Math.min(q.wi, q.words.length - 1)][1]; if (done) out.words = q.words; break;
    case 'riddle': out.text = q.text; out.answered = Object.keys(q.answers).filter(id => !q.answers[id].retrying); if (done) out.answer = q.accepted[0]; break;
  }
  if (done && q.answers && q.t !== 'tot') {
    out.picks = {};
    for (const id of Object.keys(q.answers)) { const a = q.answers[id]; if (!a.retrying) out.picks[id] = { i: a.i, picks: a.picks, v: a.v, text: a.text, ok: a.ok, first: !!a.first }; }
  }
  if (done && q.t === 'tot') { out.picks = {}; for (const id of Object.keys(q.answers)) out.picks[id] = { taps: q.answers[id] }; }
  return out;
}
function publicState(room) {
  const g = room.game;
  const pl = id => { const p = room.players.get(id); return p ? { id: p.id, name: p.name, on: p.connected, hero: p.hero, bot: !!p.bot } : null; };
  const s = {
    code: room.code, phase: g ? g.phase : 'lobby',
    players: (g ? g.order.filter(id => room.players.has(id)) : seats(room)).map(pl).filter(Boolean),
    captain: captainId(room), settings: room.settings,
    worlds: Worlds.WORLDS.map(w => ({ id: w.id, name: w.name, kicker: w.kicker, emoji: w.emoji, blurb: w.blurb })),
    minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS, fightChoices: FIGHT_CHOICES, strengthChoices: STRENGTH_CHOICES, qsecsChoices: QSECS_CHOICES,
    fx: room.fx, game: null
  };
  if (g) {
    const players = {};
    for (const id of g.order) {
      const p = g.players[id];
      if (!p) continue;
      players[id] = { hero: p.hero, hp: p.hp, maxHp: p.maxHp, coins: p.coins, down: p.down, left: p.left, items: p.items.length, buffs: Object.keys(p.buffs), stats: p.stats, used: p.used };
    }
    const w = worldOf(g);
    s.game = {
      run: g.run, wi: g.wi, world: g.world, level: g.level, fights: g.fights, final: g.final, strength: g.strength,
      worldInfo: { id: w.id, name: w.name, kicker: w.kicker, emoji: w.emoji, story: w.story, done: w.done, look: w.look, shop: w.shop, camp: w.camp, treasure: w.treasure },
      order: g.order.filter(id => g.players[id]), players,
      fork: g.fork ? { options: g.fork.options.map(o => ({ kind: o.kind, label: o.label, type: o.type || null, monster: o.monster || null })), votes: g.fork.votes, locked: g.fork.locked, chosen: g.fork.chosen } : null,
      node: g.node,
      fight: g.fight ? { id: g.fight.id, name: g.fight.name, emoji: g.fight.emoji, types: g.fight.types, hp: g.fight.hp, maxHp: g.fight.maxHp, boss: g.fight.boss, final: g.fight.final, intro: g.fight.intro, taunt: g.fight.taunt, dead: g.fight.dead, strike: g.fight.strike, qCount: g.fight.qCount, decoy: g.fight.decoy, voice: g.fight.voice, retry: g.fight.retry } : null,
      q: publicQ(g), result: g.result, strike: g.strike, shop: g.shop ? { items: g.shop.items, done: g.shop.done, line: g.shop.line, bought: g.shop.bought.slice(-12) } : null,
      treasure: g.treasure || null, loot: g.phase === 'victory' ? g.loot : null,
      reviveCost: reviveCost(g),
      clock: g.clock && g.clock.show ? { what: g.clock.what, left: Math.max(0, g.clock.at - Date.now()), len: g.clock.len } : null,
      elapsed: g.phase === 'gameOver' ? g.played : Date.now() - g.started,
      log: g.log.slice(-30), why: g.why, legend: !!g.legend, awards: g.awards || null, fightsWon: g.fightsWon, bossesWon: g.bossesWon, questions: g.questions
    };
  }
  return s;
}
function stateFor(room, pub, p) {
  const s = Object.assign({}, pub);
  const g = room.game;
  const playing = g ? !!(g.players[p.id] && !g.players[p.id].left) : room.order.includes(p.id);
  s.me = { id: p.id, name: p.name, hero: p.hero, isCaptain: pub.captain === p.id, playing };
  s.me.chats = chatsFor(room, p.id);
  if (g && playing) {
    const me = g.players[p.id], q = g.q;
    s.me.hp = me.hp; s.me.maxHp = me.maxHp; s.me.coins = me.coins; s.me.down = me.down; s.me.items = me.items; s.me.buffs = me.buffs; s.me.used = me.used; s.me.oxygen = me.oxygen;
    s.me.canRevive = me.down && me.coins >= reviveCost(g) && ['question', 'result', 'strike', 'revive', 'shop', 'enter', 'victory', 'fork', 'walk'].includes(g.phase);
    s.me.vote = g.fork ? g.fork.votes[p.id] : null;
    if (q && g.phase === 'question') {
      const mine = {};
      switch (q.t) {
        case 'mc': case 'double': case 'picture': case 'riddle': {
          const a = q.answers[p.id];
          mine.answered = !!(a && !a.retrying);
          mine.retrying = !!(a && a.retrying);
          if (a) { mine.i = a.i; mine.picks = a.picks; mine.v = a.v; mine.text = a.text; mine.struck = a.struck || []; }
          if (q.t === 'picture' && q.holders[p.id] != null) mine.card = q.cards[q.holders[p.id]] ? { e: q.cards[q.holders[p.id]].e, label: q.cards[q.holders[p.id]].label } : null;
          break;
        }
        case 'hidden':
          if (q.reader === p.id) mine.role = 'reader', mine.text = q.text;
          else if (q.holders[p.id] != null) { mine.role = 'holder'; mine.i = q.holders[p.id]; mine.option = q.opts[q.holders[p.id]]; mine.claimed = q.claims.some(c => c.pid === p.id); mine.struck = q.struck.includes(q.holders[p.id]); }
          else mine.role = 'watch';
          break;
        case 'list': mine.mine = q.found.filter(f => f.by === p.id).length; mine.wrong = q.wrong[p.id] || 0; break;
        case 'tot': mine.tapped = (q.answers[p.id] || [])[q.wi]; break;
      }
      mine.hint = q.hints[p.id] || null;
      s.me.q = mine;
    }
    if (g.result && g.result.by[p.id]) s.me.result = g.result.by[p.id];
    if (g.treasure && g.treasure.got[p.id]) s.me.treasure = g.treasure.got[p.id];
    if (g.phase === 'victory' && g.loot) s.me.loot = g.loot.items[p.id] || null;
  }
  return s;
}
function pushAll(room) {
  room.touched = Date.now();
  const pub = publicState(room);
  if (room.displays.size) {
    const d = JSON.stringify({ t: 'state', s: Object.assign({}, pub, { display: true }) });
    for (const ws of room.displays) if (ws.readyState === 1) ws.send(d);
  }
  for (const p of room.players.values()) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify({ t: 'state', s: stateFor(room, pub, p) }));
  }
  queueBackup(room);
  scheduleBots(room);
}

/* -------------------------------------------------------------- messages */

function dropPlayer(room, p, kicked) {
  const g = room.game;
  const i = room.order.indexOf(p.id);
  if (g && g.players[p.id] && !g.players[p.id].left && g.phase !== 'gameOver') {
    const me = g.players[p.id];
    me.left = true; me.down = true;
    log(room, pname(room, p.id) + ' leaves the party.', 'left');
    fx(room, 'leftGame', { pid: p.id });
    if (g.q && !g.q.done && g.phase === 'question') {
      if (g.q.t === 'hidden' && g.q.reader === p.id) { g.q.done = true; stopClock(room); nextQuestion(room); }
      else maybeLock(room);
    }
    if (!inParty(g).length) { stopClock(room); room.game = null; fx(room, 'lobby'); }
    else if (allDown(g) && ['question', 'result', 'strike'].includes(g.phase)) { stopClock(room); if (g.q && !g.q.done) g.q.done = true; reviveWindow(room); }
  }
  if (!g && i >= 0) room.order.splice(i, 1);
  if (!g || !g.players[p.id]) room.players.delete(p.id);
  else if (!p.bot) p.connected = false;
  if (p.ws) { send(p.ws, { t: 'left', kicked: !!kicked }); p.ws.room = null; p.ws.pid = null; p.ws = null; }
  if (g && room.game === g && !g.order.some(id => room.players.has(id) && !room.players.get(id).bot && !g.players[id].left)) { stopClock(room); room.game = null; fx(room, 'lobby'); }
}
function attach(ws, room, p) {
  if (p.ws && p.ws !== ws) {
    send(p.ws, { t: 'left', replaced: true });
    p.ws.room = null; p.ws.pid = null;
    try { p.ws.close(); } catch (e) { /* ignore */ }
  }
  p.ws = ws; p.connected = true; p.hold = 0; p.goneAt = 0; p.waitingFor = false;
  ws.room = room; ws.pid = p.id;
}
const justStarted = () => Date.now() - BOOT < RESTORE_WINDOW_MS;
function showOn(ws, room, admin) {
  if (ws.display && ws.room && ws.room !== room) ws.room.displays.delete(ws);
  ws.room = room; ws.display = true; ws.admin = admin;
  room.displays.add(ws);
}

function onMessage(ws, m) {
  if (!m || typeof m.t !== 'string') return;
  if (m.t === 'ping') return;

  if (m.t === 'create') {
    const room = newRoom();
    room.settings = cleanSettings(m.settings);
    showOn(ws, room, true);
    send(ws, { t: 'created', code: room.code, token: room.adminToken });
    return pushAll(room);
  }
  if (m.t === 'load') {
    if (typeof m.blob !== 'string' || m.blob.length > BACKUP_MAX) return send(ws, { t: 'error', msg: "That saved game can't be read." });
    const room = loadRoom(m.blob);
    if (!room) return send(ws, { t: 'error', msg: "That saved game can't be opened here. It was saved by a different server." });
    showOn(ws, room, true);
    send(ws, { t: 'created', code: room.code, token: room.adminToken, loaded: true });
    return pushAll(room);
  }
  if (m.t === 'watch' || m.t === 'restore') {
    const code = clean(m.code, 4).toUpperCase();
    let room = rooms.get(code), restored = false;
    if (!room && m.t === 'restore' && typeof m.blob === 'string' && m.blob.length <= BACKUP_MAX) { room = restoreRoom(m.blob, code, m.token, m.idle); restored = !!room; }
    if (!room) return send(ws, { t: 'error', code: 'noroom', msg: 'That game is no longer running.', wait: m.t === 'watch' && justStarted() });
    showOn(ws, room, m.token === room.adminToken);
    send(ws, { t: 'watching', code: room.code, admin: ws.admin, restored });
    return pushAll(room);
  }
  if (m.t === 'join') {
    const room = rooms.get(clean(m.code, 4).toUpperCase());
    if (!room) return send(ws, { t: 'error', code: 'noroom', msg: "Can't find that room. Check the 4-letter code on the TV.", wait: justStarted() });
    const name = clean(m.name, 12).toUpperCase();
    if (!name) return send(ws, { t: 'error', msg: 'Enter your name.' });
    let p = [...room.players.values()].find(x => x.name === name);
    const g = room.game;
    if (p) {
      if (p.bot) return send(ws, { t: 'error', msg: name + ' is a bot’s name. Pick another name.' });
      if (p.connected) return send(ws, { t: 'error', msg: 'Someone is already playing as ' + name + '. Pick another name.' });
      if (p.hold && Date.now() < p.hold) return send(ws, { t: 'error', msg: name + ' is still reconnecting. Try again in a few seconds, or pick another name.' });
      p.token = rid();
      if (g && g.players[p.id] && g.players[p.id].left && g.phase !== 'gameOver') {
        const me = g.players[p.id];
        me.left = false; me.down = false; me.hp = Math.max(150, Math.round(me.maxHp / 2));
        if (!room.order.includes(p.id)) room.order.push(p.id);
        log(room, name + ' returns to the party.', 'join');
      }
    } else {
      if (room.order.length >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'This room is full: ' + MAX_PLAYERS + ' heroes.' });
      if (g && g.phase === 'gameOver') return send(ws, { t: 'error', msg: 'That run just ended. Join the next one from the TV.' });
      const want = String(m.hero || '');
      const h = Heroes.heroById(want) && !heroTaken(room, want, null) ? want : freeHero(room);
      p = { id: rid(6), token: rid(), name, hero: h, connected: true, ws: null };
      room.players.set(p.id, p);
      room.order.push(p.id);
      if (g) {
        // Jumping into a run already on the road: a fresh hero, full health, empty pockets.
        g.players[p.id] = newHero(room, p.id); g.order.push(p.id);
        log(room, name + ' jumps in as ' + heroOf(p).name + '!', 'join');
      }
      fx(room, 'joined', { name: p.name, pid: p.id, late: !!g });
    }
    attach(ws, room, p);
    send(ws, { t: 'joined', code: room.code, token: p.token, id: p.id });
    return pushAll(room);
  }
  if (m.t === 'rejoin') {
    const room = rooms.get(clean(m.code, 4).toUpperCase());
    const p = room && [...room.players.values()].find(x => x.token === m.token);
    if (!p) return send(ws, { t: 'error', code: 'noroom', msg: 'That game has ended.', wait: !room && justStarted() });
    attach(ws, room, p);
    send(ws, { t: 'joined', code: room.code, token: p.token, id: p.id });
    return pushAll(room);
  }

  const room = ws.room;
  if (!room) return;
  if (ws.display) {
    if (!ws.admin) return;
    if (m.t === 'h') { adminAction(room, m); return pushAll(room); }
    if (m.t === 'save') {
      if (!room.game) return;
      try { room.game.played = Date.now() - room.game.started; send(ws, { t: 'saved', blob: packRoom(room, false, 'save'), info: saveInfo(room), label: clean(m.label, 30) }); } catch (e) { console.error('save error', e); }
      return;
    }
    return;
  }
  const p = room.players.get(ws.pid);
  if (!p) return;
  const g = room.game;
  switch (m.t) {
    case 'hero': {
      const h = String(m.h || '');
      if (!Heroes.heroById(h)) break;
      if (heroTaken(room, h, p)) { send(ws, { t: 'error', msg: 'Someone already has that hero.' }); break; }
      if (g && g.players[p.id]) {
        // Switching heroes mid-run keeps your health fraction and pockets.
        const me = g.players[p.id], nh = Heroes.heroById(h), frac = me.hp / me.maxHp;
        p.hero = h; me.hero = h; me.maxHp = Heroes.HEALTH[nh.health]; me.hp = Math.round(me.maxHp * frac);
        log(room, p.name + ' is now ' + nh.name + '.', 'join');
      } else p.hero = h;
      break;
    }
    case 'chat': chat(room, p, m); break;
    case 'h':
      if (captainId(room) !== p.id) break;
      if (['start', 'skipIntro', 'lockPath', 'leaveShop', 'retry', 'giveUp', 'skip'].includes(m.a) || (m.a === 'lobby' && g && g.phase === 'gameOver')) adminAction(room, m);
      break;
    case 'vote': if (g) vote(room, p, Number(m.i)); break;
    case 'answer': if (g) answer(room, p, m); break;
    case 'use': if (g) useItem(room, p, m); break;
    case 'gift': if (g) gift(room, p, m); break;
    case 'ability': if (g) ability(room, p, m); break;
    case 'buy': if (g) buy(room, p, m); break;
    case 'done': if (g) shopDone(room, p); break;
    case 'revive': if (g) revive(room, p); break;
    case 'leave': dropPlayer(room, p, false); break;
    default: return;
  }
  pushAll(room);
}
function onClose(ws) {
  const room = ws.room;
  if (!room) return;
  if (ws.display) { room.displays.delete(ws); return; }
  const p = room.players.get(ws.pid);
  if (p && p.ws === ws) {
    p.connected = false; p.ws = null; p.goneAt = Date.now();
    if (!room.game) { const i = room.order.indexOf(p.id); if (i >= 0) room.order.splice(i, 1); room.players.delete(p.id); }
    else { const g = room.game; if (g.phase === 'question') maybeLock(room); if (g.phase === 'shop') shopDone(room, p); if (g.phase === 'fork') checkVotes(room); }
    pushAll(room);
  }
}

/* ------------------------------------------------------------- websocket */

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 * 1024 });
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    try { onMessage(ws, m); } catch (e) { console.error('message error', e); }
  });
  ws.on('close', () => { try { onClose(ws); } catch (e) { console.error('close error', e); } });
  ws.on('error', () => {});
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  }
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.touched > ROOM_IDLE_MS) { clearTimer(room); clearTimeout(room.backupTimer); clearTimeout(room.tidyTimer); clearTimeout(room.botTimer); rooms.delete(code); }
  }
}, 30000).unref();
// The clock on the TV counts down on its own; a push every few seconds keeps every screen honest.
setInterval(() => {
  for (const room of rooms.values()) if (room.game && room.game.clock && room.game.clock.show && room.displays.size) {
    const d = JSON.stringify({ t: 'tick', left: Math.max(0, room.game.clock.at - Date.now()) });
    for (const ws of room.displays) if (ws.readyState === 1) ws.send(d);
  }
}, 5000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log('Legendary Friends on port ' + PORT + ' (' + Q.ALL.length + ' questions, build ' + BUILD + ')'));
}
module.exports = { server, rooms, packRoom, restoreRoom, _t: { Q, Heroes, Worlds } };
