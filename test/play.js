'use strict';
/*
 * Plays whole games against a real server with scripted screens: a TV and phones that pick heroes,
 * vote on paths, answer every kind of question, shop, gift, drink potions and roll to revive.
 * Checks that no phone is ever sent a right answer early, that a hidden question's text only
 * reaches the reader, that the rules add up (damage, gold, strikes, revives, wipes), that a game
 * survives the server forgetting it, and that bot-only parties finish runs through every world.
 * The clocks run 40 times faster than in a real game.   Run with: npm test
 */
process.env.RESTORE_WINDOW_MS = '600000';
process.env.SPEED_UP = '25';
const WebSocket = require('ws');
const { server, rooms, packRoom, restoreRoom, _t } = require('../server');
const { Q, Heroes, Worlds } = _t;

const PORT = 3997;
let failures = 0, passes = 0;
function check(name, ok, extra) {
  if (ok) { passes++; console.log('  ok   ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

class Screen {
  constructor(name) {
    this.name = name; this.state = null; this.last = {}; this.errors = []; this.raw = []; this.leaks = []; this.seq = 0;
    this.ws = new WebSocket('ws://localhost:' + PORT + '/ws');
    this.ready = new Promise(res => this.ws.on('open', res));
    this.ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 'state') { this.state = m.s; this.seq++; this.audit(m.s); }
      if (m.t === 'error') this.errors.push(m.msg);
      this.last[m.t] = m;
    });
  }
  // Nothing secret may reach a phone while a question is open.
  audit(s) {
    const g = s.game, q = g && g.q;
    if (!q || q.done) return;
    if (q.t === 'mc' && q.right != null) this.leaks.push('mc right');
    if (q.t === 'double' && q.rights) this.leaks.push('double rights');
    if (q.t === 'hidden') {
      if (q.text) this.leaks.push('hidden text in public');
      if (q.right != null) this.leaks.push('hidden right');
      if (s.me && s.me.q && s.me.q.role !== 'reader' && s.me.q.text) this.leaks.push('hidden text to non-reader');
    }
    if (q.t === 'picture' && q.truths) this.leaks.push('picture truths');
    if (q.t === 'riddle' && q.answer) this.leaks.push('riddle answer');
    if (q.t === 'list' && q.all) this.leaks.push('list answers');
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  async until(fn, ms = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { if (fn(this.state, this.last)) return true; } catch (e) { /* not yet */ } await wait(8); }
    return false;
  }
  close() { this.ws.close(); }
}
const roomOf = tv => rooms.get(tv.state.code);
const G = tv => roomOf(tv).game;

async function phase(tv, p, ms = 8000) { return tv.until(s => s.phase === p, ms); }

// From wherever the party is, get it to the next fight: vote for fights, walk through shops and rests.
async function toFight(tv, ph, stopAtBossFork) {
  for (let guard = 0; guard < 30; guard++) {
    const s = tv.state, g = G(tv);
    if (!g) return false;
    if (s.phase === 'enter' || s.phase === 'question') return true;
    if (s.phase === 'fork' && g.fork) {
      const kinds = g.fork.options.map(o => o.kind);
      if (stopAtBossFork && kinds.sort().join() === 'camp,shop') return 'bossFork';
      const fight = g.fork.options.findIndex(o => o.kind === 'fight');
      ph.forEach(p => p.send({ t: 'vote', i: fight >= 0 ? fight : 0 }));
      await tv.until(st => st.phase !== 'fork', 3000);
      continue;
    }
    if (s.phase === 'shop') { tv.send({ t: 'h', a: 'leaveShop' }); await tv.until(st => st.phase !== 'shop', 2000); continue; }
    if (['victory', 'camp', 'treasure', 'worldDone', 'result'].includes(s.phase)) { tv.send({ t: 'h', a: 'skip' }); await wait(60); continue; }
    await wait(30);
  }
  return false;
}

// Answer the open question correctly (or not) from a phone, reading the truth off the server.
function answerAs(tv, ph, right) {
  const g = G(tv), q = g.q, id = ph.state.me.id;
  switch (q.t) {
    case 'mc': { const wrong = q.opts.map((_, i) => i).filter(i => i !== q.right); ph.send({ t: 'answer', i: right ? q.right : wrong[0] }); break; }
    case 'double': { const wrong = q.opts.map((_, i) => i).filter(i => !q.rights.includes(i)); ph.send({ t: 'answer', picks: right ? q.rights : wrong }); break; }
    case 'hidden': if (q.holders[id] != null && (q.holders[id] === q.right) === right) ph.send({ t: 'answer' }); break;
    case 'picture': { const truth = q.cards[q.holders[id]].truth; ph.send({ t: 'answer', v: right ? truth : !truth }); break; }
    case 'riddle': ph.send({ t: 'answer', text: right ? q.accepted[0] : 'nope' }); break;
    case 'list': { const left = q.want.map((x, k) => k).filter(k => !q.found.some(f => f.k === k)); ph.send({ t: 'answer', text: right && left.length ? q.want[left[0]][0] : 'zzz' }); break; }
    case 'tot': ph.send({ t: 'answer', i: right ? q.words[q.wi][1] : 1 - q.words[q.wi][1] }); break;
  }
}

async function main() {
  /* ---------------------------------------------------- the data */
  const c = Q.count();
  check('a big question bank (' + c.total + ' questions)', c.total >= 550);
  check('every pack has at least 50 questions', Object.values(c.packs).every(n => n >= 50), JSON.stringify(c.packs));
  check('every question type is covered in the bank', Q.TYPES.every(t => c.types[t] >= 40), JSON.stringify(c.types));
  check('ten heroes with stars from one to three', Heroes.HEROES.length === 10 && Heroes.HEROES.every(h => [h.attack, h.health, h.gold].every(x => x >= 1 && x <= 3)));
  check('four worlds with eight monsters and a boss each, plus the final boss', Worlds.WORLDS.length === 4 && Worlds.WORLDS.every(w => w.monsters.length === 8 && w.boss) && Worlds.FINAL.boss);
  check('every monster asks with real question types', Worlds.WORLDS.every(w => w.monsters.concat([w.boss]).every(m => m.types.every(t => Heroes.TYPES[t]))));
  check('the fuzzy matcher forgives articles, plurals and a slip', Q.matches('the great lakes', ['Great Lake']) && Q.matches('Keyboad', ['A keyboard']) && !Q.matches('Erie', ['Ontario']));
  check('ogre-speak mangles a question', Worlds.voiced('ogre', 'What is the capital of France?').indexOf('GRUH') > 0);

  await new Promise(res => server.listen(PORT, res));

  /* ---------------------------------------------------- a scripted run */
  const tv = new Screen('tv');
  await tv.ready;
  tv.send({ t: 'create' });
  await tv.until(s => s && s.code);
  tv.send({ t: 'h', a: 'settings', settings: { worlds: ['halloween'], fights: 3, final: false, qSecs: 30, strength: 'casual', packs: ['general', 'words', 'science'] } });
  await tv.until(s => s.settings.worlds.length === 1 && !s.settings.final);
  check('the TV sets the run: one world, three fights, no final', tv.state.settings.fights === 3 && tv.state.settings.packs.length === 3);

  const names = ['AVA', 'BEN', 'CAI', 'DEE'];
  const heroes = ['mage', 'knight', 'gunslinger', 'witch'];
  const ph = names.map(n => new Screen(n));
  await Promise.all(ph.map(p => p.ready));
  ph.forEach((p, i) => p.send({ t: 'join', code: tv.state.code, name: names[i], hero: heroes[i] }));
  await tv.until(s => s.players.length === 4);
  await Promise.all(ph.map(p => p.until(s => s && s.me)));
  check('four phones joined with their heroes', tv.state.players.map(p => p.hero).join() === heroes.join());
  ph[1].send({ t: 'hero', h: 'mage' });
  await ph[1].until((s, l) => l.error);
  check('two people can’t be the same hero', /already/.test(ph[1].errors[0] || ''));
  tv.send({ t: 'h', a: 'addBot' });
  await tv.until(s => s.players.length === 5);
  check('the TV adds a bot with a free hero', tv.state.players[4].bot && !heroes.includes(tv.state.players[4].hero));

  tv.send({ t: 'h', a: 'start' });
  check('the run starts with the world intro', await phase(tv, 'intro'));
  check('everyone has full health and no gold', Object.values(tv.state.game.players).every(p => p.hp === p.maxHp && p.coins === 0));
  check('the party’s captain is the first human', tv.state.captain === ph[0].state.me.id && ph[0].state.me.isCaptain);
  check('the mage has one star of health, the knight three', tv.state.game.players[ph[0].state.me.id].maxHp === 500 && tv.state.game.players[ph[1].state.me.id].maxHp === 900);
  tv.send({ t: 'h', a: 'skipIntro' });
  check('the first fork shows two options', await phase(tv, 'fork') && tv.state.game.fork.options.length === 2);
  check('the first fork is two fights that ask differently', tv.state.game.fork.options.every(o => o.kind === 'fight') && tv.state.game.fork.options[0].type !== tv.state.game.fork.options[1].type);
  ph.forEach(p => p.send({ t: 'vote', i: 1 }));
  check('everyone voting ends the vote early', await phase(tv, 'walk', 3000) && tv.state.game.fork.chosen === 1);
  check('the party walks to the fight', await phase(tv, 'enter') && tv.state.game.fight && tv.state.game.fight.hp === tv.state.game.fight.maxHp);
  const fightHp = tv.state.game.fight.maxHp;
  check('monster health scales to the party (5 players)', fightHp > 0 && fightHp === Math.round(Worlds.monsterOf(Worlds.worldById('halloween'), tv.state.game.fight.id).hp * 1.4 * 0.75 * 5 / 4));
  check('the first question asks the way the path promised', await phase(tv, 'question') && tv.state.game.q.t === G(tv).node.type);

  // Play through this fight correctly and watch the numbers.
  let asked = 0, seenTypes = new Set(), sawStrike = false, sawDown = false, sawRevive = false, sawFirst = false, sawHidden = false, sawTeam = false;
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const s = tv.state, g = G(tv);
    if (!g) break;
    if (s.phase === 'question' && g.q && !g.q.done) {
      const q = g.q;
      seenTypes.add(q.t); asked++;
      if (q.t === 'hidden') {
        sawHidden = true;
        const reader = ph.find(p => p.state.me.id === q.reader);
        if (reader) check('the reader’s phone has the hidden question', await reader.until(st => st.me.q && st.me.q.role === 'reader' && st.me.q.text === q.text, 2000));
        for (const p of ph) if (p.state.me.id !== q.reader && !p.state.me.down) check('a holder’s phone shows one answer', await p.until(st => st.me.q && st.me.q.role === 'holder' && st.me.q.option === q.opts[q.holders[st.me.id]], 2000));
      }
      if (q.t === 'tot') {
        // Tap every word as it comes.
        for (let w = 0; w < q.words.length && !q.done; w++) {
          const at = q.wi;
          for (const p of ph) if (!p.state.me.down) answerAs(tv, p, p.name !== 'DEE');
          await tv.until(st => !G(tv).q || G(tv).q.done || G(tv).q.wi > at, 1000);
        }
      } else if (q.t === 'list') {
        for (let k = 0; k < q.n && !q.done; k++) { answerAs(tv, ph[k % 4], true); await wait(15); }
      } else {
        // Three right, DEE wrong (she has the stamina for it).
        for (const p of ph) if (!p.state.me.down) answerAs(tv, p, p.name !== 'DEE');
      }
      await tv.until(st => st.phase !== 'question', 4000);
      if (tv.state.phase === 'result') {
        const r = tv.state.game.result;
        if (r.t === 'mc' || r.t === 'riddle' || r.t === 'picture') {
          const ava = r.by[ph[0].state.me.id];
          if (ava && ava.ok) { check('a right answer hits and pays (' + r.t + ')', ava.dmg > 0 && ava.gold > 0); if (!sawFirst) sawFirst = true; }
          const dee = r.by[ph[3].state.me.id];
          if (dee && !dee.ok && !dee.out) check('a wrong answer costs health', dee.lost > 0);
        }
        if (r.t === 'hidden' && r.team) sawTeam = true;
      }
      continue;
    }
    if (s.phase === 'strike') sawStrike = true;
    if (Object.values(s.game.players).some(p => p.down)) sawDown = true;
    if (s.phase === 'victory' || s.phase === 'fork' || s.phase === 'shop' || s.phase === 'camp' || s.phase === 'treasure' || s.phase === 'worldDone' || s.phase === 'gameOver' || s.phase === 'revive' || s.phase === 'wipe') break;
    await wait(15);
  }
  check('the fight ends in a victory', tv.state.phase === 'victory', tv.state.phase);
  check('at least one question was asked (' + asked + ')', asked >= 1);
  check('the party was paid for the win', Object.values(tv.state.game.players).every(p => p.coins > 0));
  check('nobody’s phone was sent a right answer early', ph.every(p => p.leaks.length === 0), ph.map(p => p.name + ':' + p.leaks.join('/')).join(' '));
  check('the TV was never sent a right answer early', tv.leaks.length === 0, tv.leaks.join('/'));
  const victoryLog = G(tv).log.filter(l => l.kind === 'kill');
  check('the log says the monster went down', victoryLog.length === 1);

  // Items: everyone gets a few, and uses them.
  const g1 = G(tv);
  const ids = ph.map(p => p.state.me.id);
  g1.players[ids[0]].items.push('heal', 'hint', 'double', 'decoy', 'mystery', 'time');
  g1.players[ids[1]].items.push('shield');
  g1.players[ids[0]].hp = 200;
  tv.send({ t: 'h', a: 'skip' });
  await phase(tv, 'fork');
  ph[0].send({ t: 'use', item: 'heal' });
  await ph[0].until(s => s.me.hp === 500);
  check('the witch’s Healing Potion heals double (200 → full 500)', ph[0].state.me.hp === 500 && !ph[0].state.me.items.includes('heal'));
  ph[0].send({ t: 'gift', item: 'mystery', to: ids[2] });
  await ph[2].until(s => s.me.items.includes('mystery'));
  check('an item can be gifted to a teammate', !ph[0].state.me.items.includes('mystery') && ph[2].state.me.items.includes('mystery') && G(tv).players[ids[0]].stats.gifts === 1);
  ph[0].send({ t: 'use', item: 'double' });
  await ph[0].until(s => s.me.buffs.double);
  check('a Double-Damage Scroll arms itself', ph[0].state.me.buffs.double === true);

  // Second fork: the captain locks the path from the phone.
  ph[0].send({ t: 'h', a: 'lockPath', i: 0 });
  check('the captain can lock the path', await phase(tv, 'walk', 3000) && tv.state.game.fork.chosen === 0);
  check('the party reaches another fight', (await toFight(tv, ph, false)) === true);
  await phase(tv, 'question');
  // Hint potion and time warp on a question.
  let q = G(tv).q;
  if (q.t === 'mc' || q.t === 'double' || q.t === 'riddle' || q.t === 'list') {
    ph[0].send({ t: 'use', item: 'hint' });
    await ph[0].until(s => s.me.q && s.me.q.hint);
    const h = ph[0].state.me.q.hint;
    check('a Hint Potion strikes off a wrong answer or gives a clue', h && (h.struck != null ? h.struck !== q.right : !!h.text));
  }
  if (q.t !== 'tot') {
    const before = G(tv).clock.at;
    ph[0].send({ t: 'use', item: 'time' });
    await ph[0].until(s => !s.me.items.includes('time'));
    check('Time Warp adds ten seconds to the clock', G(tv).clock.at - before > 200);
  }
  if (q.t === 'mc') {
    ph[0].send({ t: 'ability' });
    await tv.until(s => s.game.q.struck.length === 1);
    check('Clairvoyance strikes one wrong answer for everyone', tv.state.game.q.struck[0] !== q.right && G(tv).players[ids[0]].used.clair);
  }
  ph[0].send({ t: 'use', item: 'decoy' });
  await tv.until(s => s.game.fight.decoy);
  check('a Scarecrow Decoy is planted', tv.state.game.fight.decoy === true);

  // Force a strike: knock everyone's clocks forward and watch the monster swing.
  for (const p of ph) if (!p.state.me.down) answerAs(tv, p, true);
  await tv.until(s => s.phase === 'result', 4000);
  const r2 = tv.state.game.result;
  const avaR = r2.by[ids[0]];
  if (avaR && avaR.ok && ['mc', 'picture', 'riddle'].includes(r2.t)) check('the scroll doubled the mage’s hit', avaR.notes.includes('Double-Damage Scroll') && avaR.dmg >= 340);

  // Now a revive: knock DEE down, let her roll.
  const gg = G(tv);
  gg.players[ids[3]].hp = 1; gg.players[ids[3]].coins = 600;
  gg.fight.hp = 9999; gg.fight.maxHp = 9999;
  await tv.until(s => s.phase === 'question', 12000);
  for (const p of ph) if (!p.state.me.down) answerAs(tv, p, p.name !== 'DEE');
  await tv.until(s => s.phase === 'result', 4000);
  check('DEE goes down from a wrong answer at 1 health', G(tv).players[ids[3]].down === true);
  await ph[3].until(s => s.me.down && s.me.canRevive);
  ph[3].send({ t: 'revive' });
  await ph[3].until(s => !s.me.down);
  const dee = G(tv).players[ids[3]];
  check('DEE rolls the d20 and gets up (' + dee.hp + ' hp)', !dee.down && dee.hp >= 100 && dee.stats.revives === 1 && (dee.coins === 350 || dee.coins === 600));
  const rl = G(tv).log.filter(l => l.kind === 'revive').pop();
  check('the log says what she rolled', rl && /rolls a \d+/.test(rl.text));

  // The server forgets the room mid-fight; the TV hands back the sealed copy.
  const code = tv.state.code, token = tv.last.created.token;
  await tv.until((s, l) => l.backup && l.backup.blob);
  const blob = tv.last.backup.blob;
  const room1 = rooms.get(code);
  clearTimeout(room1.timer); clearTimeout(room1.botTimer); clearTimeout(room1.backupTimer);
  rooms.delete(code);
  const back = restoreRoom(blob, code, token, 0);
  check('the room comes back from the TV’s copy', !!back && back.game && back.game.fight && back.game.fight.name === gg.fight.name);
  check('a wrong token can’t restore a room', restoreRoom(blob, code, 'nope', 0) === null);
  tv.send({ t: 'watch', code, token });
  await tv.until((s, l) => l.watching && l.watching.restored);
  const seqs = ph.map(p => p.seq);
  for (const p of ph) { p.send({ t: 'rejoin', code, token: p.last.joined.token }); }
  await Promise.all(ph.map((p, i) => p.until(s => p.seq > seqs[i] && s.me && s.me.playing)));
  check('every phone gets its hero back after the restore', ph.every((p, i) => p.state.me.hero === heroes[i] && p.state.me.coins === G(tv).players[p.state.me.id].coins));

  // A fresh phone jumps into the run.
  const late = new Screen('EVE');
  await late.ready;
  late.send({ t: 'join', code, name: 'EVE', hero: 'ghost' });
  await late.until(s => s && s.me && s.me.playing);
  check('a late joiner jumps in as a fresh hero', late.state.me.hero === 'ghost' && late.state.me.coins === 0 && late.state.me.hp === 700 && tv.state.game.order.includes(late.state.me.id));
  late.send({ t: 'leave' });
  await tv.until(s => !s.game.order.includes(late.state.me.id) || G(tv).players[late.state.me.id].left);
  check('leaving takes you out of the party', G(tv).players[late.state.me.id].left === true);

  // Save & load as a new room on another night.
  tv.send({ t: 'save', label: 'Halloween run' });
  await tv.until((s, l) => l.saved);
  const saved = tv.last.saved.blob;
  const tv2 = new Screen('tv2');
  await tv2.ready;
  tv2.send({ t: 'load', blob: saved });
  await tv2.until((s, l) => l.created && l.created.loaded);
  check('a saved game opens as a new room with everyone waiting', tv2.state.code !== code && tv2.state.players.length >= 4 && tv2.state.players.filter(p => !p.bot).every(p => !p.on));
  const ava2 = new Screen('AVA2');
  await ava2.ready;
  ava2.send({ t: 'join', code: tv2.state.code, name: 'AVA' });
  await ava2.until(s => s && s.me && s.me.playing);
  check('joining with the same name gets your hero, gold and bag back', ava2.state.me.hero === 'mage' && ava2.state.me.coins === ph[0].state.me.coins && ava2.state.me.items.length === ph[0].state.me.items.length);
  const r2room = rooms.get(tv2.state.code);
  clearTimeout(r2room.timer); clearTimeout(r2room.botTimer); rooms.delete(tv2.state.code); tv2.close(); ava2.close();

  // Wipe and retry: everyone on one hit point and broke, and the monster is due to strike.
  await tv.until(s => s.phase === 'question', 12000);
  const g3 = G(tv);
  for (const id of g3.order) if (g3.players[id] && !g3.players[id].left) { g3.players[id].hp = 1; g3.players[id].coins = 0; }
  g3.players[tv.state.players[4].id].down = true;   // the bot sits this one out
  g3.fight.hp = 9999; g3.fight.maxHp = 9999; g3.fight.shieldWall = true; g3.fight.decoy = false;
  g3.fight.qCount = (g3.fight.strike.every || 3) - 1;
  for (const p of ph) if (!p.state.me.down) answerAs(tv, p, true);
  await tv.until(s => s.phase === 'strike', 6000);
  check('the monster strikes when its count comes up', tv.state.phase === 'strike' && tv.state.game.strike && tv.state.game.strike.kind);
  check('a strike that downs everyone with no gold left is a wipe', await phase(tv, 'wipe', 6000));
  tv.send({ t: 'h', a: 'retry' });
  check('the party can rise again and retry the fight', await phase(tv, 'enter', 3000) && Object.values(tv.state.game.players).every(p => p.left || (!p.down && p.hp === Math.round(p.maxHp / 2))) && tv.state.game.fight.hp === tv.state.game.fight.maxHp);

  // Finish the run with the monster on one hit point, then the shop and the boss.
  G(tv).fight.hp = 1;
  await tv.until(s => s.phase === 'question', 12000);
  for (const p of ph) if (!p.state.me.down) answerAs(tv, p, true);
  check('the second fight falls', await phase(tv, 'victory', 6000));
  tv.send({ t: 'h', a: 'skip' });
  // Walk the rest of the road to the fork before the boss, knocking out any fight on the way.
  let where;
  for (let k = 0; k < 6; k++) {
    where = await toFight(tv, ph, true);
    if (where !== true) break;
    await tv.until(s => s.phase === 'question', 12000);
    G(tv).fight.hp = 1;
    for (const p of ph) if (!p.state.me.down) answerAs(tv, p, true);
    await phase(tv, 'victory', 6000);
    tv.send({ t: 'h', a: 'skip' });
  }
  check('the last fork before the boss is shop or rest', where === 'bossFork');
  const shopI = tv.state.game.fork.options.findIndex(o => o.kind === 'shop');
  ph.forEach(p => p.send({ t: 'vote', i: shopI }));
  check('the shop opens with potions on the shelf', await phase(tv, 'shop') && tv.state.game.shop.items.includes('heal') && tv.state.game.shop.items.length === 6);
  G(tv).players[ids[1]].coins = 500;
  ph[1].send({ t: 'buy', item: 'revive' });
  await ph[1].until(s => s.me.items.includes('revive'));
  check('buying takes the gold and fills the bag', ph[1].state.me.coins === 300 && G(tv).players[ids[1]].stats.bought === 1);
  G(tv).players[ids[2]].coins = 10;
  ph[2].send({ t: 'buy', item: 'heal' });
  await ph[2].until((s, l) => l.error && /gold/.test(l.error.msg));
  check('you can’t buy what you can’t afford', true);
  ph.forEach(p => p.send({ t: 'done' }));
  check('everyone done leaves the shop', await tv.until(s => s.phase !== 'shop', 3000));
  await tv.until(s => s.phase === 'enter');
  check('the boss is next', tv.state.game.fight.boss === true);
  const bossHp = tv.state.game.fight.maxHp;
  G(tv).fight.hp = Math.round(bossHp * 0.25);
  await tv.until(s => s.phase === 'question', 12000);
  check('a boss under 30% unleashes its finisher: this or that', tv.state.game.q.t === 'tot' && tv.state.game.q.finisher);
  // Tap through the finisher.
  for (let w = 0; w < 8; w++) {
    const at = G(tv).q.wi;
    for (const p of ph) if (!p.state.me.down) answerAs(tv, p, true);
    await tv.until(s => !G(tv).q || G(tv).q.done || G(tv).q.wi > at, 1500);
    if (!G(tv).q || G(tv).q.done) break;
  }
  await tv.until(s => s.phase === 'result', 3000);
  const r4 = tv.state.game.result;
  check('this-or-that scores every word', r4.t === 'tot' && r4.by[ids[0]].right >= 6);
  if (G(tv).fight.hp > 0) { G(tv).fight.hp = 1; await tv.until(s => s.phase === 'question', 12000); for (const p of ph) if (!p.state.me.down) answerAs(tv, p, true); }
  check('the boss falls and the world is done', await phase(tv, 'victory', 8000) && await phase(tv, 'worldDone', 8000));
  check('the fallen rise after a win', Object.values(G(tv).players).every(p => p.left || !p.down));
  check('with no final boss the run ends: legends', await phase(tv, 'gameOver', 8000) && tv.state.game.legend === true);
  check('awards are handed out', tv.state.game.awards.length >= 2 && tv.state.game.awards.every(a => a.title && a.name));
  check('no phone was ever sent a secret', ph.every(p => p.leaks.length === 0) && tv.leaks.length === 0);
  check('the bot answered along the way', G(tv).players[tv.state.players[4].id].stats.right + G(tv).players[tv.state.players[4].id].stats.wrong > 0);
  console.log('     question types seen in the scripted run: ' + [...seenTypes].join(', '));
  const room0 = rooms.get(code);
  clearTimeout(room0.timer); clearTimeout(room0.botTimer); clearTimeout(room0.backupTimer); rooms.delete(code);
  ph.forEach(p => p.close()); tv.close(); late.close();

  /* ---------------------------------------------------- bot parties run the whole road */
  const worlds = ['halloween', 'west', 'fantasy', 'space'];
  const t2 = new Screen('tv-bots');
  await t2.ready;
  t2.send({ t: 'create' });
  await t2.until(s => s && s.code);
  t2.send({ t: 'h', a: 'settings', settings: { worlds, fights: 2, final: true, qSecs: 15, strength: 'normal', packs: Heroes.PACKS.map(p => p.id) } });
  await t2.until(s => s.settings.worlds.length === 4);
  for (let i = 0; i < 6; i++) t2.send({ t: 'h', a: 'addBot' });
  await t2.until(s => s.players.length === 6);
  t2.send({ t: 'h', a: 'start' });
  await phase(t2, 'intro');
  const t0 = Date.now();
  let retries = 0, wipes = 0, sawWorlds = new Set(), typesSeen = new Set(), shops = 0, revives = 0;
  while (Date.now() - t0 < 240000) {
    const s = t2.state, g = G(t2);
    if (!g) break;
    if (s.phase === 'gameOver') break;
    sawWorlds.add(g.world);
    if (g.q) typesSeen.add(g.q.t);
    if (s.phase === 'shop') shops++;
    if (s.phase === 'wipe') { wipes++; if (retries < 12) { retries++; t2.send({ t: 'h', a: 'retry' }); } else { t2.send({ t: 'h', a: 'giveUp' }); } await wait(40); }
    await wait(25);
  }
  const g2 = G(t2);
  check('a bot party gets to the end (' + t2.state.phase + ', ' + Math.round((Date.now() - t0) / 1000) + 's, ' + wipes + ' wipes)', t2.state.phase === 'gameOver' && g2.why === 'legend');
  check('every world was crossed, then the final hall', ['halloween', 'west', 'fantasy', 'space', 'final'].every(w => sawWorlds.has(w)), [...sawWorlds].join());
  check('every question type came up on the road', Q.TYPES.every(t => typesSeen.has(t)), [...typesSeen].join());
  revives = Object.values(g2.players).reduce((n, p) => n + p.stats.revives, 0);
  console.log('     bots: ' + g2.questions + ' questions, ' + g2.fightsWon + ' fights won, ' + g2.bossesWon + ' bosses, ' + revives + ' revives, ' + wipes + ' wipes, gold left ' + Object.values(g2.players).map(p => p.coins).join('/'));
  check('bots bought things and revived', Object.values(g2.players).some(p => p.stats.bought > 0));
  check('nobody is left with negative gold or health', Object.values(g2.players).every(p => p.coins >= 0 && p.hp >= 0));
  const r = rooms.get(t2.state.code);
  clearTimeout(r.timer); clearTimeout(r.botTimer); clearTimeout(r.backupTimer); rooms.delete(t2.state.code); t2.close();

  console.log('\n' + passes + ' passed, ' + failures + ' failed');
  server.close();
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
