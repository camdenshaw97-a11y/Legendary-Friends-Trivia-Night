'use strict';
/*
 * The question bank: every pack in questions/ loaded, checked and given an id. Server only (the
 * phones and the TV are sent one question at a time, never the bank).
 *
 * Formats (t = type):
 *   mc       { q, a: [right, wrong, wrong, wrong], h }           four answers, the first is right
 *   double   { q, a: [right, right, wrong, wrong], h }           four answers, the first two are right
 *   hidden   { q, a: [right, wrong × 7] }                        one phone reads it; each other phone holds one answer
 *   list     { q, a: [[name, alias…], …], n?, h }                 fill every entry (or n of them) before the clock
 *   picture  { q, c: [[emoji, label, trueOrFalse] × 6] }         six pictures, one per phone, true or false
 *   tot      { q, o: [this, that], w: [[word, 0|1] × 8] }        rapid fire, one word at a time
 *   riddle   { q, a: [answer, alias…], h }                        typed answer
 * h is the hint a Hint Potion reveals (a struck-off wrong answer is used instead where there is one).
 */
const path = require('path');

const PACK_FILES = ['general', 'sports', 'screen', 'food', 'science', 'history', 'pop', 'words', 'latenight'];
const TYPES = ['mc', 'double', 'hidden', 'list', 'picture', 'tot', 'riddle'];

function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

// Loose matching for typed answers: case, accents, punctuation, articles and plurals don't matter,
// and a one-letter slip in a longer word is forgiven.
function norm(s) {
  return clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function depl(s) { return s.replace(/(ies)\b/g, 'y').replace(/(sses|shes|ches|xes)\b/g, m => m.slice(0, -2)).replace(/s\b/g, ''); }
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
function same(typed, want) {
  const t = norm(typed) || clean(typed).toLowerCase(), w = norm(want) || clean(want).toLowerCase();
  if (!t || !w) return false;
  if (t === w) return true;
  const dt = depl(t), dw = depl(w);
  if (dt === dw) return true;
  const len = Math.max(dt.length, dw.length);
  if (len >= 5 && lev(dt, dw) <= (len >= 9 ? 2 : 1)) return true;
  // "lake superior" for "superior", "mount everest" for "everest": the typed answer contains the whole wanted one as words
  if (dw.length >= 4 && (' ' + dt + ' ').includes(' ' + dw + ' ')) return true;
  return false;
}
// Does the typed answer match any of the accepted spellings?
function matches(typed, accepted) { return (accepted || []).some(x => same(typed, x)); }

function check(q, where) {
  const bad = msg => { throw new Error(where + ': ' + msg + ' — ' + JSON.stringify(q).slice(0, 80)); };
  if (!TYPES.includes(q.t)) bad('unknown type ' + q.t);
  if (!clean(q.q)) bad('no question text');
  switch (q.t) {
    case 'mc': if (!Array.isArray(q.a) || q.a.length !== 4) bad('needs 4 answers'); break;
    case 'double': if (!Array.isArray(q.a) || q.a.length !== 4) bad('needs 4 answers'); break;
    case 'hidden': if (!Array.isArray(q.a) || q.a.length < 6) bad('needs at least 6 answers'); break;
    case 'list':
      if (!Array.isArray(q.a) || q.a.length < 3 || !q.a.every(x => Array.isArray(x) && x.length)) bad('needs a list of [name, aliases…]');
      if (q.n && (q.n < 2 || q.n > q.a.length)) bad('n out of range');
      break;
    case 'picture':
      if (!Array.isArray(q.c) || q.c.length !== 6 || !q.c.every(c => Array.isArray(c) && c.length === 3 && typeof c[2] === 'boolean')) bad('needs 6 cards [emoji, label, bool]');
      if (!q.c.some(c => c[2]) || q.c.every(c => c[2])) bad('cards must have both true and false');
      break;
    case 'tot':
      if (!Array.isArray(q.o) || q.o.length !== 2) bad('needs two options');
      if (!Array.isArray(q.w) || q.w.length < 6 || !q.w.every(w => Array.isArray(w) && (w[1] === 0 || w[1] === 1))) bad('needs 6+ [word, 0|1]');
      break;
    case 'riddle': if (!Array.isArray(q.a) || !q.a.length) bad('needs answers'); break;
  }
  if (q.t === 'mc' || q.t === 'double' || q.t === 'hidden') {
    const seen = new Set();
    for (const x of q.a) { const k = clean(x).toLowerCase(); if (seen.has(k)) bad('duplicate answer ' + x); seen.add(k); }
  }
}

const ALL = [];
for (const pack of PACK_FILES) {
  const list = require(path.join(__dirname, 'questions', pack + '.js'));
  list.forEach((q, i) => {
    check(q, pack + '[' + i + ']');
    ALL.push(Object.assign({ id: pack + ':' + q.t + ':' + i, pack }, q));
  });
}
const byId = new Map(ALL.map(q => [q.id, q]));

function count() {
  const out = { total: ALL.length, packs: {}, types: {} };
  for (const q of ALL) { out.packs[q.pack] = (out.packs[q.pack] || 0) + 1; out.types[q.t] = (out.types[q.t] || 0) + 1; }
  return out;
}

module.exports = { ALL, byId: id => byId.get(id) || null, TYPES, PACKS: PACK_FILES, matches, same, norm, count };
