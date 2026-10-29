/*
 * The heroes, their stats and class abilities, the items in the shop, the question packs and
 * the question types. Used by the server (the rules) and by both pages (the words and pictures).
 * Works in Node and in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Heroes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Stars → numbers. A hero's attack is the damage one right answer does, health is how much
  // they can take, gold is what a right answer pays.
  var ATTACK = [0, 120, 170, 220];
  var HEALTH = [0, 500, 700, 900];
  var GOLD = [0, 40, 55, 70];

  // Ten heroes. Any number of players from 2 to 8 picks from the same roster, so there is
  // always a choice left. Each one has a class ability that works on its own unless it says to tap.
  var HEROES = [
    { id: 'knight', name: 'Sir Factalot', cls: 'Trivia Knight', emoji: '🛡️', pic: '🤺', attack: 1, health: 3, gold: 2, c1: '#8fb3ff', c2: '#2d4f9a',
      ability: 'Shield Wall', about: 'Once per fight he steps in front of the teammate with the least health and takes the monster’s strike for them.', kind: 'auto',
      tagline: 'Slow to answer, impossible to knock over.' },
    { id: 'mage', name: 'Morgana Quizwell', cls: 'Sage Mage', emoji: '🔮', pic: '🧙‍♀️', attack: 2, health: 1, gold: 3, c1: '#d8a9ff', c2: '#6b2fa8',
      ability: 'Clairvoyance', about: 'Once per fight, tap to strike one wrong answer off everyone’s phone.', kind: 'tap',
      tagline: 'Knows the answer. Can’t take a punch.' },
    { id: 'gunslinger', name: 'Duke Dredd', cls: 'Gunslinger', emoji: '🔫', pic: '🤠', attack: 3, health: 1, gold: 2, c1: '#ffb87a', c2: '#a8521a',
      ability: 'Quickdraw', about: 'When he is the first to lock in a right answer, it hits for double.', kind: 'auto',
      tagline: 'Fastest answer in the West.' },
    { id: 'astronaut', name: 'Cmdr. Nova Vega', cls: 'Astronaut', emoji: '🚀', pic: '👩‍🚀', attack: 2, health: 2, gold: 2, c1: '#bfe7ff', c2: '#1f6f9a',
      ability: 'Oxygen Reserve', about: 'The first time she goes down in a run, she gets back up on her own with half her health.', kind: 'auto',
      tagline: 'Steady hands. Spare air.' },
    { id: 'vampire', name: 'Count Smartula', cls: 'Vampire', emoji: '🩸', pic: '🧛', attack: 3, health: 2, gold: 1, c1: '#ff8a9a', c2: '#8a0f24',
      ability: 'Drain', about: 'Every right answer drinks 60 health back.', kind: 'auto',
      tagline: 'Looks AND books.' },
    { id: 'ghost', name: 'Boo', cls: 'Ghost', emoji: '👻', pic: '👻', attack: 1, health: 2, gold: 3, c1: '#f2f7ff', c2: '#7f8fb0',
      ability: 'Phase', about: 'Half of the monster’s strikes pass straight through.', kind: 'auto',
      tagline: 'Already dead. Not worried.' },
    { id: 'bounty', name: 'Calamity Jane-ius', cls: 'Bounty Hunter', emoji: '🪢', pic: '👩‍🌾', attack: 2, health: 2, gold: 3, c1: '#ffe08a', c2: '#a87a10',
      ability: 'Bounty', about: 'Bosses pay her double gold.', kind: 'auto',
      tagline: 'In it for the money.' },
    { id: 'robot', name: 'BIT-9000', cls: 'Robot', emoji: '⚙️', pic: '🤖', attack: 2, health: 3, gold: 1, c1: '#c9d6e3', c2: '#3f5366',
      ability: 'Armor Plating', about: 'Takes a quarter less damage from everything.', kind: 'auto',
      tagline: 'Does not compute "wrong".' },
    { id: 'witch', name: 'Hazel Hexley', cls: 'Witch', emoji: '🧹', pic: '🧙', attack: 2, health: 1, gold: 3, c1: '#b8ffb0', c2: '#2d7a2a',
      ability: 'Brew', about: 'Potions she drinks are twice as strong.', kind: 'auto',
      tagline: 'Double, double, trivia trouble.' },
    { id: 'bard', name: 'Barnaby Twang', cls: 'Bard', emoji: '🪕', pic: '🧑‍🎤', attack: 1, health: 2, gold: 3, c1: '#ffc4e0', c2: '#a8306a',
      ability: 'Encore', about: 'While he is standing, everyone’s revive roll costs 100 less.', kind: 'auto',
      tagline: 'Can’t fight. Can rhyme.' }
  ];
  var byId = {};
  HEROES.forEach(function (h) { byId[h.id] = h; });
  function heroById(id) { return byId[id] || null; }

  /* ---- items ---- */
  // use: 'any' (tap any time), 'question' (tap while a question is up), 'passive' (works on its own).
  var ITEMS = [
    { id: 'heal', name: 'Healing Potion', emoji: '🧪', price: 125, use: 'any', about: 'Drink to get 300 health back.' },
    { id: 'hint', name: 'Hint Potion', emoji: '💡', price: 125, use: 'question', about: 'Drink during a question for a hint: a wrong answer struck off, or a clue for a typed answer.' },
    { id: 'revive', name: 'Auto-Revive', emoji: '🪽', price: 200, use: 'passive', about: 'The next time you go down, you spring right back up at full health. No roll, no fee.' },
    { id: 'shield', name: 'Shield', emoji: '🛡️', price: 100, use: 'passive', about: 'Blocks the next monster strike that would hit you.' },
    { id: 'decoy', name: 'Scarecrow Decoy', emoji: '🎃', price: 175, use: 'any', about: 'Plant it and the monster’s next strike hits the scarecrow instead of the party.' },
    { id: 'double', name: 'Double-Damage Scroll', emoji: '📜', price: 150, use: 'passive', about: 'Your next right answer hits twice.' },
    { id: 'lucky', name: 'Lucky Dice', emoji: '🎲', price: 100, use: 'passive', about: 'Your next revive roll is rolled twice and keeps the better one.' },
    { id: 'second', name: 'Second Chance', emoji: '🔁', price: 175, use: 'passive', about: 'If your next answer is wrong, you find out at once and get one more pick.' },
    { id: 'time', name: 'Time Warp', emoji: '⏳', price: 100, use: 'question', about: 'Adds 10 seconds to the clock for everyone.' },
    { id: 'mystery', name: 'Mystery Potion', emoji: '🍶', price: 75, use: 'any', about: 'Could be wonderful. Could be grape. Could be worse.' }
  ];
  var itemById = {};
  ITEMS.forEach(function (i) { itemById[i.id] = i; });
  function item(id) { return itemById[id] || null; }
  var MAX_ITEMS = 6;         // in a bag

  /* ---- question packs (the TV turns them on and off) ---- */
  var PACKS = [
    { id: 'general', name: 'General', blurb: 'A bit of everything' },
    { id: 'sports', name: 'Sports', blurb: 'Games people play' },
    { id: 'screen', name: 'Movies, TV & Music', blurb: 'Screens and speakers' },
    { id: 'food', name: 'Food & Drink', blurb: 'What’s on the table' },
    { id: 'science', name: 'Science & Nature', blurb: 'The way things work' },
    { id: 'history', name: 'History & Geography', blurb: 'Then and where' },
    { id: 'pop', name: 'Pop Culture & Tech', blurb: 'Phones, games, memes' },
    { id: 'words', name: 'Words', blurb: 'Language and letters' },
    { id: 'latenight', name: 'Late Night', blurb: 'Adults only', adult: true }
  ];

  /* ---- question types: how a monster asks ---- */
  var TYPES = {
    mc: { name: 'Multiple Choice', short: 'Multiple choice', emoji: '🔢', blurb: 'Four answers, one is right. Everyone picks.' },
    double: { name: 'Double Answer', short: 'Two right answers', emoji: '✌️', blurb: 'Four answers, two are right. Pick both.' },
    hidden: { name: 'Hidden Question', short: 'Hidden question', emoji: '🤫', blurb: 'One phone gets the question and reads it out. The rest of you each hold one answer. Whoever has the right one, shout it.' },
    list: { name: 'List It', short: 'List it', emoji: '📋', blurb: 'Fill the whole list before the clock runs out. Type what you know.' },
    picture: { name: 'Picture Round', short: 'Picture round', emoji: '🖼️', blurb: 'Six pictures, one on each phone. Is yours true or false?' },
    tot: { name: 'This or That', short: 'This or that', emoji: '⚡', blurb: 'Rapid fire. One word at a time: which of the two is it?' },
    riddle: { name: 'Riddle', short: 'Riddle', emoji: '🧩', blurb: 'Type the answer. Riddles hit harder when you get them.' }
  };

  return { ATTACK: ATTACK, HEALTH: HEALTH, GOLD: GOLD, HEROES: HEROES, heroById: heroById, ITEMS: ITEMS, item: item, MAX_ITEMS: MAX_ITEMS, PACKS: PACKS, TYPES: TYPES };
});
