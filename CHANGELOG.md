# Changelog

## 1.1 — Oct 29, 2026
The "Stonehall" restyle, from Camden's design handoff (Claude Design).

- Every TV and phone screen re-cut in carved stone: chamfered slabs with a gold inlay line, no rounded corners anywhere, hexagonal hero medallions, diamond letter badges, ingot-shaped buttons and bars, an octagonal iron clock, stone pillars at the TV's edges, an ember glow at the bottom of every screen.
- Type: Cinzel (600/800) for headings and labels, Crimson Pro (400/600, italic) for body, questions and story; self-hosted woff2 next to the pages. Anton and Baskerville are gone.
- Monsters sit in a hexagonal stone frame over a pulsing ember aura; bosses get the red frame, skull crown and a "BOSS OF <WORLD>" label. Party plates are octagon slabs with trapezoid CAPTAIN / READER / READY tabs and diamond lock marks. The question panel shows the medallions of everyone who has locked in.
- Hero stat stars became gold ◆◇ diamonds. The logo is a gold hexagon with a carved question mark.
- World scenery is kept but faded well back so it doesn't fight the monster frame.
- Tests: three timing-flaky checks made deterministic.
- Hero and monster art is still emoji; the slots are in place for real art later.


## 1.0 — Oct 29, 2026
Named "Legendary Friends: Quest for Trivia".
First version, built for the Halloween party.

- Four worlds (Hollow Hill, Dry Gulch, The Shattered Spire, Station Omega) with eight monsters and a boss each, plus the Quizmaster as the final boss. The TV picks the road, fights per world, strength, clock and question packs.
- Ten heroes with attack/health/gold stars and a class ability each (Shield Wall, Clairvoyance, Quickdraw, Oxygen Reserve, Drain, Phase, Bounty, Armor Plating, Brew, Encore).
- Seven question types: multiple choice, double answer, hidden question, list it, picture round, this or that, riddle. 597 questions in nine packs including Late Night (18+).
- Path forks with phone voting, shops, rests and treasure; d20 revives; party wipes with a retry; ten items including gifting between heroes; bots; private chat; jump in mid-run; save & resume; restart survival; awards.
- `npm test` plays a scripted run (every mechanic) and a bot-only run through all four worlds and the final boss.

Known gaps for later: picture rounds use emoji (real image upload is planned), no write-your-own questions yet, monsters are emoji rather than drawn art, no walkthrough video page.
