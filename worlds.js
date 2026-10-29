/*
 * The worlds: how each one looks, who runs its shop, the monsters that live there and the boss at
 * the end of it, plus the final arena where the last boss waits. Used by the server (the fights)
 * and by both pages (the scenery and the words). Works in Node and in the browser.
 *
 * Monster numbers are for a party of four; the server scales them to the party. hp is how much
 * answering it takes, hurt is what a wrong answer costs you, strike is what the monster does to
 * everyone every `every` questions: 'hit' for damage, 'rob' to steal gold, 'drain' to hit and heal
 * itself. types are the ways it asks (weighted by repeats). voice 'ogre' mangles its questions.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Worlds = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WORLDS = [
    {
      id: 'halloween', name: 'Hollow Hill', kicker: 'A HALLOWEEN WORLD', emoji: '🎃',
      blurb: 'Pumpkins, graveyards and things that go bump. The scariest world is the one with your friends in it.',
      story: 'The fog rolls off the graveyard at Hollow Hill, and every lantern on the lane has gone out at once. Something in the dark has been collecting trivia from travelers, one wrong answer at a time. Tonight it’s your turn to walk the hill.',
      done: 'The pumpkins go dark, the fog lifts, and Hollow Hill is quiet again. You keep walking.',
      look: { bg: ['#140a1e', '#2a1140', '#0a0612'], accent: '#ff8c1a', accent2: '#8d4bff', panel: '#1b0f2b', scene: 'graveyard' },
      shop: { name: 'Granny Grimm', emoji: '🧓', title: 'Granny Grimm’s Curiosities',
        lines: ['Everything’s half-dead and full price, dearie.', 'Potions are in the back. Mind the cat. The cat minds you.', 'Buy something or I put you in the window.'] },
      camp: { name: 'the lantern-lit porch', emoji: '🏚️', line: 'A porch with one working lantern. You rest, and nothing eats you. A good night.' },
      treasure: { name: 'a trick-or-treat bucket', emoji: '🪣', line: 'Somebody left a full bucket on the step. You take it. That’s the rule.' },
      monsters: [
        { id: 'pumpkin', name: 'Jack the Lantern', emoji: '🎃', hp: 1300, hurt: 100, strike: { kind: 'hit', amount: 150, every: 3 }, types: ['mc', 'mc', 'picture'], voice: 'normal',
          intro: 'A grinning pumpkin head floats out of the fog. It has questions and no neck.', taunt: 'Carve this one up, if you can.', dead: 'Jack the Lantern gutters out. Pumpkin spice everywhere.' },
        { id: 'skeleton', name: 'The Rattling Bones', emoji: '💀', hp: 1500, hurt: 110, strike: { kind: 'hit', amount: 170, every: 3 }, types: ['mc', 'tot', 'double'], voice: 'normal',
          intro: 'A skeleton clatters out of the crypt, shaking a bag of dice that are also bones.', taunt: 'I feel it in my bones. You don’t know this.', dead: 'The Rattling Bones fall into a tidy pile. Somebody should put those back.' },
        { id: 'ghost', name: 'The Whispering Widow', emoji: '👻', hp: 1500, hurt: 110, strike: { kind: 'hit', amount: 160, every: 3 }, types: ['hidden', 'hidden', 'mc'], voice: 'normal',
          intro: 'A whisper you can’t quite hear. She only asks her questions in one ear at a time.', taunt: 'Say it louder. I can’t hear the dead over the living.', dead: 'The Widow sighs and drifts back into the house. At peace, mostly.' },
        { id: 'spider', name: 'The Attic Spider', emoji: '🕷️', hp: 1700, hurt: 120, strike: { kind: 'hit', amount: 180, every: 2 }, types: ['list', 'list', 'mc'], voice: 'normal',
          intro: 'Eight legs, eight eyes, and a web with a list written in it. Fill the web.', taunt: 'Every strand you miss is one more for the web.', dead: 'The Attic Spider curls up. Nobody is sweeping that.' },
        { id: 'zombie', name: 'Gary from Accounts', emoji: '🧟', hp: 1600, hurt: 120, strike: { kind: 'hit', amount: 160, every: 3 }, types: ['mc', 'mc', 'double', 'riddle'], voice: 'ogre',
          intro: 'A zombie in a lanyard shambles over. He died in a meeting and never left it.', taunt: 'Braaains. Also, per my last email.', dead: 'Gary from Accounts finally logs off.' },
        { id: 'bat', name: 'The Belfry Bats', emoji: '🦇', hp: 1400, hurt: 100, strike: { kind: 'hit', amount: 140, every: 2 }, types: ['tot', 'tot', 'picture'], voice: 'normal',
          intro: 'A thousand bats pour out of the church tower, screeching questions far too fast.', taunt: 'Faster. FASTER.', dead: 'The bats scatter into the night. The belfry is yours.' },
        { id: 'werewolf', name: 'Howler', emoji: '🐺', hp: 1900, hurt: 130, strike: { kind: 'hit', amount: 210, every: 2 }, types: ['mc', 'double', 'tot'], voice: 'normal',
          intro: 'The moon comes out. So does Howler. He was a trivia host before the bite and it shows.', taunt: 'Wrong! AWOOOO. Sorry. Wrong.', dead: 'Howler shrinks back into a mild man named Terrence, who apologizes.' },
        { id: 'mummy', name: 'The Unwrapped', emoji: '🧻', hp: 1700, hurt: 120, strike: { kind: 'rob', amount: 60, every: 3 }, types: ['riddle', 'mc', 'list'], voice: 'normal',
          intro: 'A mummy unspools out of a sarcophagus. It has been waiting four thousand years to ask you a riddle.', taunt: 'Your gold funds my re-wrapping.', dead: 'The Unwrapped comes fully unwrapped. Awkward for everyone.' }
      ],
      boss: { id: 'headless', name: 'The Headless Horseman', emoji: '🐎', hp: 3800, hurt: 150, strike: { kind: 'hit', amount: 220, every: 2 }, types: ['mc', 'hidden', 'double', 'list', 'picture', 'riddle'], voice: 'normal',
        intro: 'Hooves on the bridge. The Headless Horseman rides out of the mist holding a jack-o’-lantern that is, somehow, reading questions.', taunt: 'I lost my head. You’re about to lose yours.', dead: 'The Horseman’s pumpkin goes out. The horse looks relieved.', finisher: 'tot' }
    },
    {
      id: 'west', name: 'Dry Gulch', kicker: 'A WILD WEST WORLD', emoji: '🤠',
      blurb: 'Saloons, outlaws, rattlesnakes and a sheriff who asks hard questions. Draw.',
      story: 'The noon train never came to Dry Gulch. Neither did the sheriff. The Dalton gang has been running the town on trivia: answer right and you drink free, answer wrong and you leave in a box. You tie up your horses and walk down Main Street.',
      done: 'The gang is run out of town and the saloon piano starts up again. Dry Gulch is free.',
      look: { bg: ['#3a1f0c', '#7a4a1e', '#1d0f06'], accent: '#ffb347', accent2: '#e35d2b', panel: '#2b170a', scene: 'desert' },
      shop: { name: 'Doc Pickens', emoji: '🧑‍⚕️', title: 'Doc Pickens’ General Store & Dentistry',
        lines: ['Tonics, bullets, and I pull teeth on Tuesdays.', 'Cash only. Gold also. Mostly gold.', 'You look like you need a potion and a bath. I only sell one of those.'] },
      camp: { name: 'the campfire', emoji: '🔥', line: 'You boil coffee that could strip paint and sleep under more stars than seems fair.' },
      treasure: { name: 'a stagecoach strongbox', emoji: '🧳', line: 'The lock’s already shot off. Whoever did it left in a hurry. Finders keepers.' },
      monsters: [
        { id: 'rattler', name: 'The Rattlesnake', emoji: '🐍', hp: 1300, hurt: 110, strike: { kind: 'hit', amount: 160, every: 3 }, types: ['tot', 'tot', 'mc'], voice: 'normal',
          intro: 'A rattle in the brush. It strikes fast and asks faster.', taunt: 'Ssstill thinking?', dead: 'The rattler slithers off to bother a different town.' },
        { id: 'bandit', name: 'One-Eyed Earl', emoji: '🦹', hp: 1500, hurt: 110, strike: { kind: 'rob', amount: 70, every: 2 }, types: ['mc', 'mc', 'double'], voice: 'normal',
          intro: 'A bandit steps out from behind the water tower, hand on his holster, eye on your gold.', taunt: 'Your money or your answer. I’ll take both.', dead: 'Earl drops his gun and runs. He forgot the gold. Lucky you.' },
        { id: 'scorpion', name: 'The Scorpion', emoji: '🦂', hp: 1500, hurt: 130, strike: { kind: 'hit', amount: 170, every: 3 }, types: ['picture', 'picture', 'mc'], voice: 'normal',
          intro: 'Something in your boot. It’s a scorpion, and it brought pictures.', taunt: 'Look closer. It’s in the details.', dead: 'The scorpion scuttles under a rock, which is where it should have stayed.' },
        { id: 'vulture', name: 'The Buzzards', emoji: '🦅', hp: 1400, hurt: 100, strike: { kind: 'drain', amount: 140, every: 2 }, types: ['list', 'mc', 'hidden'], voice: 'normal',
          intro: 'Buzzards circle overhead, waiting for someone to answer wrong.', taunt: 'We can wait. We’re very good at waiting.', dead: 'The buzzards find somebody else to circle.' },
        { id: 'prospector', name: 'Mad Gus', emoji: '🧔', hp: 1600, hurt: 120, strike: { kind: 'hit', amount: 160, every: 3 }, types: ['riddle', 'riddle', 'mc'], voice: 'ogre',
          intro: 'An old prospector with one tooth and a thousand riddles. He has been alone too long.', taunt: 'Gold’s in the riddle, pardner. Dig.', dead: 'Gus wanders off muttering about a vein that was never there.' },
        { id: 'cattle', name: 'The Stampede', emoji: '🐂', hp: 1800, hurt: 120, strike: { kind: 'hit', amount: 200, every: 2 }, types: ['tot', 'mc', 'double'], voice: 'normal',
          intro: 'The ground shakes. Three hundred head of cattle, and every one of them has a question.', taunt: 'MOO-ve faster.', dead: 'The herd thunders past. Someone will have to round them up. Not you.' },
        { id: 'sheriff', name: 'Sheriff Stone', emoji: '🧑‍✈️', hp: 1800, hurt: 130, strike: { kind: 'hit', amount: 190, every: 2 }, types: ['hidden', 'mc', 'list'], voice: 'normal',
          intro: 'The sheriff finally shows up, and he thinks you’re the gang. Convince him.', taunt: 'Wrong answer, outlaw.', dead: 'Sheriff Stone tips his hat. He believes you. Mostly.' },
        { id: 'ghosttown', name: 'The Saloon Ghost', emoji: '🍺', hp: 1600, hurt: 110, strike: { kind: 'rob', amount: 50, every: 3 }, types: ['hidden', 'double', 'picture'], voice: 'normal',
          intro: 'The piano plays itself. The ghost of a card sharp who died with a full house and a grudge.', taunt: 'Dead man’s hand. Read ’em and weep.', dead: 'The piano stops. The chair at the card table finally stops rocking.' }
      ],
      boss: { id: 'dalton', name: 'Big Jim Dalton', emoji: '🤠', hp: 4000, hurt: 150, strike: { kind: 'rob', amount: 80, every: 2 }, types: ['mc', 'hidden', 'double', 'list', 'picture', 'riddle'], voice: 'normal',
        intro: 'The saloon doors swing open. Big Jim Dalton, two guns, one question at a time, and a bounty on every one of you.', taunt: 'This town ain’t big enough for the eight of you.', dead: 'Big Jim Dalton rides out of Dry Gulch for good. The piano starts up again.', finisher: 'tot' }
    },
    {
      id: 'fantasy', name: 'The Shattered Spire', kicker: 'A DRAGONS & WIZARDS WORLD', emoji: '🐉',
      blurb: 'Wizards, goblins, trolls under bridges, and a dragon who hoards knowledge instead of gold.',
      story: 'The Archmage of the Spire locked every answer in the realm inside his tower and set a dragon to guard it. Now nobody in the kingdom can finish a sentence. You cross the drawbridge with a sword, a spellbook, and a group chat.',
      done: 'The Spire’s doors swing open and the answers flood back out over the kingdom. Sentences everywhere are finished.',
      look: { bg: ['#0b1a3a', '#1f3f7a', '#06101f'], accent: '#5ad1ff', accent2: '#ffd36b', panel: '#0f2144', scene: 'castle' },
      shop: { name: 'Wizzle the Merchant', emoji: '🧙‍♂️', title: 'Wizzle’s Enchanted Emporium',
        lines: ['Everything in here is cursed, lightly, for flavor.', 'No refunds on potions. Where would you even put it back?', 'The dragon shops here too. He pays in menace.'] },
      camp: { name: 'the roadside inn', emoji: '🏰', line: 'Stew, a fire, a bard who only knows one song. You sleep anyway.' },
      treasure: { name: 'a dragon’s side hoard', emoji: '💎', line: 'A small pile of gold the dragon forgot about. He has a lot of piles.' },
      monsters: [
        { id: 'goblin', name: 'Snib the Goblin', emoji: '👺', hp: 1300, hurt: 100, strike: { kind: 'rob', amount: 50, every: 2 }, types: ['mc', 'mc', 'tot'], voice: 'ogre',
          intro: 'A goblin leaps from the drawbridge chains, already going through your pockets.', taunt: 'Shiny! Wrong! Shiny!', dead: 'Snib drops everything he stole and runs, which is a lot.' },
        { id: 'troll', name: 'The Bridge Troll', emoji: '🧌', hp: 1800, hurt: 130, strike: { kind: 'hit', amount: 200, every: 3 }, types: ['riddle', 'riddle', 'mc'], voice: 'ogre',
          intro: 'A troll rises from under the bridge. By ancient law he must ask you riddles. He is not good at them.', taunt: 'TROLL RIDDLE. YOU NO KNOW.', dead: 'The troll sits down heavily. Bridge is open. Bridge is bent.' },
        { id: 'wizard', name: 'The Apprentice', emoji: '🧙', hp: 1500, hurt: 120, strike: { kind: 'hit', amount: 170, every: 3 }, types: ['hidden', 'hidden', 'double'], voice: 'normal',
          intro: 'An apprentice wizard, three spells and all of them whispered.', taunt: 'A whispered spell is still a spell.', dead: 'The apprentice’s hat falls over his eyes and he gives up.' },
        { id: 'slime', name: 'The Gelatinous Blob', emoji: '🟢', hp: 1500, hurt: 110, strike: { kind: 'hit', amount: 150, every: 2 }, types: ['list', 'list', 'picture'], voice: 'normal',
          intro: 'A blob oozes down the stairs with a list of things dissolving inside it.', taunt: 'Glorp. Incomplete. Glorp.', dead: 'The blob loses structural integrity. So does the carpet.' },
        { id: 'knight', name: 'The Black Knight', emoji: '🛡️', hp: 1900, hurt: 140, strike: { kind: 'hit', amount: 210, every: 2 }, types: ['mc', 'double', 'hidden'], voice: 'normal',
          intro: 'A knight in black armor bars the stair. None shall pass without the answer.', taunt: 'Tis but a wrong answer.', dead: 'The Black Knight concedes, which he says never happens.' },
        { id: 'fairy', name: 'The Pixie Swarm', emoji: '🧚', hp: 1400, hurt: 100, strike: { kind: 'rob', amount: 40, every: 2 }, types: ['tot', 'tot', 'picture'], voice: 'normal',
          intro: 'A swarm of pixies, each with one word, none of them waiting their turn.', taunt: 'Thisthatthisthatthis!', dead: 'The pixies get bored and leave in a glittering huff.' },
        { id: 'basilisk', name: 'The Basilisk', emoji: '🦎', hp: 1700, hurt: 140, strike: { kind: 'hit', amount: 190, every: 3 }, types: ['picture', 'mc', 'riddle'], voice: 'normal',
          intro: 'Don’t look it in the eye. Look at the pictures instead.', taunt: 'Look closer. Closer.', dead: 'The basilisk turns itself to stone in a mirror. Classic basilisk.' },
        { id: 'lich', name: 'The Librarian', emoji: '📚', hp: 1800, hurt: 130, strike: { kind: 'drain', amount: 160, every: 2 }, types: ['list', 'hidden', 'mc'], voice: 'normal',
          intro: 'The Spire’s undead librarian. Overdue since the third age.', taunt: 'Shhh. Wrong.', dead: 'The Librarian re-shelves herself.' }
      ],
      boss: { id: 'dragon', name: 'Pyraxis the Knowing', emoji: '🐉', hp: 4200, hurt: 160, strike: { kind: 'hit', amount: 240, every: 2 }, types: ['mc', 'hidden', 'double', 'list', 'picture', 'riddle'], voice: 'normal',
        intro: 'The top of the Spire. Pyraxis the Knowing uncoils from a hoard of every answer ever given, and asks you for one more.', taunt: 'I have eaten scholars for less.', dead: 'Pyraxis bows his great head. The answers are free again.', finisher: 'tot' }
    },
    {
      id: 'space', name: 'Station Omega', kicker: 'A DEEP SPACE WORLD', emoji: '🚀',
      blurb: 'Aliens, rogue AIs, a space kraken and a lot of airlocks. In space nobody can hear you answer wrong.',
      story: 'Station Omega went dark three days out from Jupiter. The last transmission was a trivia question with no answer. Your ship docks at a silent airlock. The lights come on one at a time, and something starts asking.',
      done: 'The station’s lights come back all at once. Omega is yours. Set a course home.',
      look: { bg: ['#060a1c', '#101a40', '#02040c'], accent: '#43e8d8', accent2: '#ff4f9a', panel: '#0a1030', scene: 'space' },
      shop: { name: 'VEND-R', emoji: '🤖', title: 'VEND-R Automated Outfitter',
        lines: ['PLEASE INSERT GOLD. GOLD ACCEPTED. HAVE A DAY.', 'ITEM DISPENSED. ITEM DISPENSED. ITEM DISPENSED. ERROR.', 'THANK YOU FOR CHOOSING VEND-R. YOU HAD NO CHOICE.'] },
      camp: { name: 'the cryo bay', emoji: '🛌', line: 'Twenty minutes in a cryo pod. You wake up rested and slightly younger.' },
      treasure: { name: 'an unmarked cargo pod', emoji: '📦', line: 'Cargo pod. No manifest. Full of gold. Nobody’s asking.' },
      monsters: [
        { id: 'drone', name: 'The Security Drones', emoji: '🛸', hp: 1300, hurt: 100, strike: { kind: 'hit', amount: 150, every: 3 }, types: ['tot', 'tot', 'mc'], voice: 'normal',
          intro: 'Three drones drop from the ceiling, scanning you one word at a time.', taunt: 'SCANNING. INCORRECT. SCANNING.', dead: 'The drones power down and clatter to the deck.' },
        { id: 'alien', name: 'The Greys', emoji: '👽', hp: 1500, hurt: 110, strike: { kind: 'hit', amount: 160, every: 3 }, types: ['hidden', 'hidden', 'picture'], voice: 'normal',
          intro: 'Three small grey visitors. They only speak to one of you at a time, and they want to know things.', taunt: 'Tell the others. We cannot.', dead: 'The Greys beam out. They took the coffee machine.' },
        { id: 'ai', name: 'HAL-9', emoji: '🔴', hp: 1700, hurt: 130, strike: { kind: 'hit', amount: 180, every: 2 }, types: ['mc', 'double', 'riddle'], voice: 'normal',
          intro: 'The station computer wakes up. It’s very calm. It’s very sure you’re wrong.', taunt: 'I’m afraid that’s incorrect.', dead: 'HAL-9 sings a slow little song as it shuts down.' },
        { id: 'kraken', name: 'The Void Kraken', emoji: '🦑', hp: 1900, hurt: 130, strike: { kind: 'hit', amount: 200, every: 2 }, types: ['list', 'list', 'mc'], voice: 'normal',
          intro: 'Tentacles across every porthole. Each one is holding part of a list.', taunt: 'Eight arms. You’ve filled two.', dead: 'The kraken lets go of the station and drifts off toward Saturn.' },
        { id: 'pirate', name: 'Captain Nebula', emoji: '🏴‍☠️', hp: 1600, hurt: 120, strike: { kind: 'rob', amount: 70, every: 2 }, types: ['mc', 'double', 'tot'], voice: 'normal',
          intro: 'A space pirate kicks open the airlock. She’s here for the gold and she asks nicely once.', taunt: 'Wrong answer. Right pockets.', dead: 'Captain Nebula salutes and jets off, poorer.' },
        { id: 'asteroid', name: 'The Asteroid Swarm', emoji: '☄️', hp: 1400, hurt: 110, strike: { kind: 'hit', amount: 170, every: 2 }, types: ['picture', 'picture', 'tot'], voice: 'normal',
          intro: 'Rocks, hundreds of them, each with a picture scratched into it. Shields up.', taunt: 'Impact in three. Two.', dead: 'The swarm passes. The hull is dented. The hull was always dented.' },
        { id: 'clone', name: 'The Clones', emoji: '👯', hp: 1600, hurt: 120, strike: { kind: 'drain', amount: 150, every: 2 }, types: ['double', 'double', 'hidden'], voice: 'normal',
          intro: 'Two of everything, including the answers.', taunt: 'There are two of us. Pick two.', dead: 'The clones argue over who gets to leave first, then both do.' },
        { id: 'blob', name: 'The Spore Colony', emoji: '🦠', hp: 1500, hurt: 110, strike: { kind: 'hit', amount: 150, every: 3 }, types: ['riddle', 'list', 'mc'], voice: 'ogre',
          intro: 'Something grew in the hydroponics bay and it has learned to talk, sort of.', taunt: 'GROW. WRONG. GROW.', dead: 'The colony withers under the grow lights. Good riddance.' }
      ],
      boss: { id: 'overmind', name: 'The Overmind', emoji: '🧠', hp: 4400, hurt: 160, strike: { kind: 'hit', amount: 240, every: 2 }, types: ['mc', 'hidden', 'double', 'list', 'picture', 'riddle'], voice: 'normal',
        intro: 'The station’s core. A brain the size of a bus, floating in a tank, hooked into everything. It took Omega with questions. It’s been waiting for yours.', taunt: 'I have run this simulation. You lose.', dead: 'The Overmind’s tank cracks and the station exhales. Omega is yours.', finisher: 'tot' }
    }
  ];

  // Where the last fight happens, after the last world.
  var FINAL = {
    id: 'final', name: 'The Hall of Legends', kicker: 'THE FINAL BATTLE', emoji: '👑',
    story: 'The road ends at a hall older than any world you crossed. Every trivia night ever played is written on its walls. At the far end sits the one who wrote them.',
    done: 'The Hall falls silent. Your names go up on the wall. You are legends now.',
    look: { bg: ['#1a0a0a', '#3a1414', '#0a0404'], accent: '#ffd700', accent2: '#ff3d3d', panel: '#240c0c', scene: 'hall' },
    boss: { id: 'quizmaster', name: 'The Quizmaster', emoji: '🎩', hp: 6500, hurt: 170, strike: { kind: 'hit', amount: 230, every: 2, alt: 'rob', altAmount: 90 }, types: ['mc', 'hidden', 'double', 'list', 'picture', 'riddle'], voice: 'normal',
      intro: 'The Quizmaster. Top hat, no face, a scroll that never ends. He has asked every question there is and he has never once been beaten.', taunt: 'Nobody leaves my hall a legend.', dead: 'The Quizmaster’s hat rolls across the floor. For the first time, the scroll is blank.', finisher: 'tot' }
  };

  var byId = {};
  WORLDS.forEach(function (w) { byId[w.id] = w; });
  byId.final = FINAL;
  function worldById(id) { return byId[id] || null; }
  function monsterOf(world, id) {
    if (!world) return null;
    if (world.boss && world.boss.id === id) return world.boss;
    return (world.monsters || []).filter(function (m) { return m.id === id; })[0] || null;
  }

  /* ---- the scenery behind a fight, as one SVG that fills the TV ---- */
  function scene(id, accent) {
    var a = accent || '#fff';
    switch (id) {
      case 'graveyard':
        return '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
          '<circle cx="1500" cy="220" r="120" fill="#f3e3b0" opacity=".9"/><circle cx="1460" cy="200" r="24" fill="#d9c58f" opacity=".5"/><circle cx="1540" cy="260" r="16" fill="#d9c58f" opacity=".5"/>' +
          '<path d="M0 820 Q300 700 600 790 T1200 760 T1920 800 V1080 H0z" fill="#0b0512"/>' +
          '<path d="M0 880 Q400 820 800 870 T1920 860 V1080 H0z" fill="#07030c"/>' +
          '<g fill="#120a1c" stroke="#1d1030" stroke-width="4"><path d="M300 800 v-90 a30 30 0 0 1 60 0 v90z"/><path d="M420 790 v-70 h40 v70z"/><path d="M700 820 v-110 a35 35 0 0 1 70 0 v110z"/><path d="M1000 790 v-80 h50 v80z"/><path d="M1380 810 v-95 a32 32 0 0 1 64 0 v95z"/><path d="M1620 820 v-70 h46 v70z"/></g>' +
          '<g stroke="#0b0512" stroke-width="14" fill="none" stroke-linecap="round"><path d="M180 820 v-260 M180 640 l-90 -80 M180 600 l80 -110 M90 560 l-30 -70"/><path d="M1760 830 v-300 M1760 650 l100 -90 M1760 600 l-90 -120"/></g>' +
          '<path d="M860 780 l60 -120 l60 120z M880 780 l40 -70 l40 70z" fill="#170b24"/>' +
          '<ellipse cx="960" cy="1000" rx="900" ry="120" fill="' + a + '" opacity=".05"/></svg>';
      case 'desert':
        return '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
          '<circle cx="1550" cy="240" r="130" fill="#ffd27a" opacity=".95"/>' +
          '<path d="M0 700 L200 560 L380 640 L520 500 L700 610 L900 540 L1100 650 L1300 520 L1500 640 L1700 560 L1920 660 V1080 H0z" fill="#4a2a12"/>' +
          '<path d="M0 820 Q400 760 900 810 T1920 790 V1080 H0z" fill="#2e1808"/>' +
          '<g fill="#1d0f06"><rect x="150" y="620" width="40" height="220" rx="18"/><rect x="110" y="660" width="34" height="90" rx="16"/><rect x="190" y="690" width="34" height="70" rx="16"/><rect x="1650" y="650" width="44" height="200" rx="20"/><rect x="1610" y="700" width="30" height="80" rx="14"/></g>' +
          '<g fill="#1d0f06"><rect x="1250" y="690" width="260" height="150"/><path d="M1240 690 h280 l-20 -40 h-240z"/><rect x="1350" y="760" width="40" height="80" fill="#5a3214"/></g>' +
          '<circle cx="400" cy="400" r="2" fill="#fff"/><ellipse cx="960" cy="1000" rx="900" ry="120" fill="' + a + '" opacity=".06"/></svg>';
      case 'castle':
        return '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
          '<circle cx="360" cy="200" r="90" fill="#dbe9ff" opacity=".8"/>' +
          '<g fill="#fff" opacity=".7"><circle cx="800" cy="120" r="2"/><circle cx="1200" cy="220" r="2"/><circle cx="1500" cy="90" r="3"/><circle cx="1700" cy="300" r="2"/><circle cx="600" cy="320" r="2"/><circle cx="1000" cy="380" r="2"/></g>' +
          '<path d="M0 760 Q300 640 600 720 T1200 690 T1920 740 V1080 H0z" fill="#07132a"/>' +
          '<g fill="#050d1e"><rect x="1300" y="380" width="80" height="420"/><rect x="1290" y="360" width="100" height="24"/><path d="M1290 360 h20 v-20 h20 v20 h20 v-20 h20 v20 h20 v-20 h20 v20z"/><rect x="1400" y="470" width="220" height="330"/><path d="M1400 470 h30 v-22 h30 v22 h30 v-22 h30 v22 h30 v-22 h30 v22 h40z"/><rect x="1640" y="300" width="100" height="500"/><path d="M1640 300 h20 v-22 h20 v22 h20 v-22 h20 v22 h20z"/><path d="M1690 180 l-50 120 h100z"/><path d="M1340 280 l-40 100 h80z"/></g>' +
          '<g fill="#ffd36b" opacity=".8"><rect x="1330" y="520" width="14" height="24"/><rect x="1680" y="420" width="14" height="24"/><rect x="1470" y="600" width="14" height="24"/></g>' +
          '<path d="M0 880 Q500 830 1000 880 T1920 870 V1080 H0z" fill="#040a18"/>' +
          '<ellipse cx="960" cy="1000" rx="900" ry="120" fill="' + a + '" opacity=".06"/></svg>';
      case 'space':
        return '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
          '<g fill="#fff"><circle cx="100" cy="100" r="2"/><circle cx="300" cy="400" r="1.5"/><circle cx="520" cy="150" r="2.5"/><circle cx="700" cy="300" r="1.5"/><circle cx="900" cy="80" r="2"/><circle cx="1100" cy="250" r="1.5"/><circle cx="1300" cy="120" r="2"/><circle cx="1500" cy="330" r="2.5"/><circle cx="1750" cy="180" r="1.5"/><circle cx="1850" cy="420" r="2"/><circle cx="200" cy="600" r="1.5"/><circle cx="1650" cy="560" r="2"/><circle cx="820" cy="520" r="1.5"/><circle cx="1400" cy="640" r="1.5"/><circle cx="60" cy="800" r="2"/><circle cx="1880" cy="760" r="1.5"/></g>' +
          '<circle cx="1550" cy="260" r="150" fill="#d9975c"/><ellipse cx="1550" cy="260" rx="260" ry="40" fill="none" stroke="#f0c48c" stroke-width="14" opacity=".8" transform="rotate(-18 1550 260)"/>' +
          '<circle cx="300" cy="220" r="60" fill="#5a7fb0"/>' +
          '<path d="M0 900 Q500 820 960 900 T1920 880 V1080 H0z" fill="#070b22"/>' +
          '<g fill="#0d1440" stroke="#1d2a6a" stroke-width="3"><rect x="620" y="700" width="680" height="200" rx="20"/><rect x="560" y="760" width="90" height="80" rx="10"/><rect x="1270" y="760" width="90" height="80" rx="10"/></g>' +
          '<g fill="' + a + '" opacity=".8"><rect x="680" y="760" width="30" height="16" rx="4"/><rect x="740" y="760" width="30" height="16" rx="4"/><rect x="800" y="760" width="30" height="16" rx="4"/><rect x="1120" y="760" width="30" height="16" rx="4"/></g>' +
          '<ellipse cx="960" cy="1000" rx="900" ry="120" fill="' + a + '" opacity=".06"/></svg>';
      case 'hall':
        return '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
          '<g fill="#2a0e0e"><rect x="120" y="120" width="90" height="800"/><rect x="420" y="120" width="90" height="800"/><rect x="1410" y="120" width="90" height="800"/><rect x="1710" y="120" width="90" height="800"/></g>' +
          '<g fill="#3a1414"><rect x="100" y="100" width="130" height="30"/><rect x="400" y="100" width="130" height="30"/><rect x="1390" y="100" width="130" height="30"/><rect x="1690" y="100" width="130" height="30"/></g>' +
          '<g fill="' + a + '" opacity=".75"><ellipse cx="300" cy="420" rx="14" ry="22"/><ellipse cx="1620" cy="420" rx="14" ry="22"/></g>' +
          '<path d="M0 880 H1920 V1080 H0z" fill="#0d0404"/><path d="M700 880 L1220 880 L1300 1080 L620 1080z" fill="#ffd700" opacity=".12"/>' +
          '<ellipse cx="960" cy="1000" rx="900" ry="120" fill="' + a + '" opacity=".06"/></svg>';
    }
    return '';
  }

  /* ---- a monster's question in its own voice ---- */
  function ogre(text) {
    var t = String(text || '');
    t = t.replace(/\b(the|a|an)\s+/gi, '')
      .replace(/\bWhat is\b/gi, 'What be').replace(/\bWhat was\b/gi, 'What was').replace(/\bWhich of these\b/gi, 'Which one')
      .replace(/\bWho is\b/gi, 'Who be').replace(/\bWho was\b/gi, 'Who was').replace(/\bWhich\b/g, 'Which one').replace(/\bwhich\b/g, 'which one')
      .replace(/\bare\b/g, 'am').replace(/\bis\b/g, 'be').replace(/\byour\b/g, 'you').replace(/\byou are\b/gi, 'you am')
      .replace(/\?/g, '? GRUH.').replace(/\.$/, '. GRUH.');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function voiced(voice, text) { return voice === 'ogre' ? ogre(text) : text; }

  return { WORLDS: WORLDS, FINAL: FINAL, worldById: worldById, monsterOf: monsterOf, scene: scene, voiced: voiced };
});
