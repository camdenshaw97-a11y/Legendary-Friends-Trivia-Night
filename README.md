# Legendary Friends: Trivia Night

A co-op trivia RPG for a TV and your phones, in the spirit of Jackbox's *Legends of Trivia*. Pick a hero, pick a path, and answer trivia together to take down the monsters of four worlds: Hollow Hill (Halloween), Dry Gulch (Wild West), The Shattered Spire (dragons & wizards) and Station Omega (deep space), then the Quizmaster in the Hall of Legends.

Built the same way as Friend Feud, Friend Jeopardy, Friend Wheel, Friend Monopoly and Friend Clue: one Node server, a TV page, a phone page, a 4-letter room code or QR to join, and a game that survives a server restart.

## Running it

```
npm install
npm start          # http://localhost:3000 (phones) and http://localhost:3000/tv (the TV)
npm test           # plays scripted and bot-only runs against a real server
```

On Render: a free Node web service from this repo, build `npm install`, start `node server.js` (there's a `render.yaml`). The TV page is `YOUR-SITE/tv`; phones use `YOUR-SITE` and the room code.

## How it plays

- **2 to 8 heroes**, one phone each. Ten heroes with attack / health / gold stars and a class ability. The first person in is the captain (starts the run, can lock in path votes, leave the shop early, retry a wipe).
- **The TV sets the run**: which worlds and in what order (any of the four, repeats allowed), fights per world (2/3/4), a final boss on or off, monster strength, the answer clock, and which question packs are on. Nine packs, 597 questions: General, Sports, Movies/TV/Music, Food & Drink, Science & Nature, History & Geography, Pop Culture & Tech, Words, and Late Night (18+).
- **The road**: each world is a series of forks — fight (labeled with how the monster asks), shop, rest, treasure — then a shop-or-rest stop, then the world's boss. Everyone votes on their phone; most votes wins, the captain breaks ties.
- **Fights**: every right answer hits the monster and earns gold; every wrong answer costs you health. The monster strikes the whole party every few questions (some rob gold, some drain health). Seven ways a monster asks: multiple choice, double answer, hidden question (one phone reads it out, everyone else holds an answer), list it, picture round (six pictures, one per phone, true or false), this or that (rapid fire), riddles. Some monsters speak ogre. Bosses unleash a rapid-fire finisher under 30% health.
- **Going down**: at zero health you're out until you roll a d20 to revive (250 gold, 150 while the Bard is standing; the higher the roll the more health; a natural 20 is free and full). The fallen get up for free when the fight is won or the party rests. If everyone's down and nobody can pay, the party wipes: rise again at half health and retry the fight, or end the run.
- **Shop**: Healing Potion, Hint Potion, Auto-Revive, Shield, Scarecrow Decoy, Double-Damage Scroll, Lucky Dice, Second Chance, Time Warp, Mystery Potion. Bags hold six. Items can be given to teammates any time.
- **Also**: bots the TV can add, private chat, jump in mid-run with a new name, leave and come back with the same name, save & resume across nights, restart survival, awards at the end.

## Files

- `server.js` — the whole game: rooms, the road, fights, every question type, items, bots, save/restore.
- `questions.js` + `questions/*.js` — the question bank, one file per pack. The format is documented at the top of `questions.js`; `npm test` checks every entry.
- `heroes.js` — heroes, abilities, items, packs, question types (shared with the pages).
- `worlds.js` — the worlds, their monsters and bosses, shopkeepers, scenery, ogre-speak.
- `tv.html`, `index.html`, `common.js`, `style.css` — the TV, the phone, and what they share.
- `test/play.js` — the test suite.

## Adding questions

Each pack is a plain array in `questions/<pack>.js`. For a multiple-choice question the first answer is the right one (the game shuffles); for a double answer the first two are. Run `npm test` after editing: it fails loudly on a malformed entry.
