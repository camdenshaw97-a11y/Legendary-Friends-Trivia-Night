# Changelog

## 1.2.1 — Oct 30, 2026
From the second play test.

- This or That: each word now stays up for 6 seconds (was 4.2) — the table found it too quick.
- Tests: the Healing Potion check waited on a stale phone state; it now waits for the potion to leave the bag.

## 1.2 — Oct 29, 2026
The fight is a battle, not a form — the TV's fight screen rebuilt from Camden's "Stonehall Fight Scene" design.

- The party plates are gone during a fight. Heroes stand on a battlefield as sprites (hex portrait, stone name tab with a health bar, gold and bag) along a staggered diagonal in front of the monster; five to eight heroes form two ranks. A ground line and floor gradient give them somewhere to stand. CAPTAIN / READER tabs and the lock marks sit above each sprite.
- The question panel is a smaller slab at the top-left; the monster stands tall at the right with its strike counter, name and health bar.
- Every round plays out: the reveal, then a battle strip ("THE PARTY HITS FOR 780", or "NOBODY HAD IT"), then each hero who hit charges across the field in turn — slash, recoil, stage shake, a damage number, the monster's bar dropping — while heroes who missed flinch and lose health on the spot. If the blow was fatal, the monster goes grey and the strip calls it.
- The monster's turn is its own beat: "THE RATTLING BONES STRIKES BACK" (or ROBS THE PARTY), a lunge across the field, a red flash, every hero flinching with their loss, SHIELD WALL / BLOCKED / DODGED where it applies, "STRAW!" when it hits the scarecrow. "NEXT QUESTION" bridges into the next round.
- Down heroes grey out and tilt; offline players fade.
- The server gives the result phase enough time for every charge to land before the monster's turn.
- World scenery is hidden during fights so the moon doesn't sit behind the monster.
- Tests: the "DEE goes down" check now forces a multiple-choice question first.

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
