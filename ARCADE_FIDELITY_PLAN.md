# Release 3.0 — Arcade Fidelity Gap-Closure Plan

Goal: continue closing the gap between the web port and the original Robotron: 2084
ROM (Williams 6809), using `~/dev/robotron-re/REVERSE.md` as ground truth and MAME
(`robotron-re/snap/robotron/`, 180 reference frames) for verification.

Status baseline (branch `release-3.0`, 2026-07-12): Phases 1–5 of the original plan
complete. Playfield boundary confinement done (`cef3829`). Initials screen clears
the battlefield (`1559435`). Remaining gaps are grouped into six milestones below,
ordered by player-visible impact. Each milestone ends with a MAME side-by-side
check and a commit; nothing ships without on-screen verification via Playwright.

**Standing constraints (do not violate):**
- NEVER rebuild `sprites/atlas.{png,json}` — it is pinned and hand-remapped
  (blitter source addresses are nondeterministic per capture run).
- `index.html` entry script stays relative (`./js/main.ts`).
- Entity loops use `isEntityGone()`; PIXI v8 throws on destroyed-sprite access.
- `npm run build` is vite-only by design; verify via `npm run preview` + Playwright.

---

## M1 — Verification foundation + known defects — DONE 2026-10-11

1. **PRNG golden test.**
   - robotron-re `tools/prng_probe.lua` captured DP $84/$85/$86 after the first 1000 calls
     of `prng_update` ($D6CD) from a cold boot (seed $A55A). That's
     `tests/fixtures/prng_golden.txt`, checked by `npm test` (`tests/prng-golden.test.mts`).
   - **It found a real bug.** `Prng.ts` rotated the wrong feedback bit into $85 (bit 1 of
     `($86>>3)^$86` instead of bit 0) and added that bit where the ROM adds the carry from
     `ADDB <$86`.
   - Every one of the 1000 calls differed, and the old generator repeated after 8,064
     calls instead of the ROM's 114,674. Fixed; the test passes.
2. **Scoring ledger.** The figures listed here were old misreads; the ROM's `score_update`
   table (REVERSE.md Phase 21) is the reference. Shooting one of each in the browser gives:

   | Target | Points |
   |---|---|
   | grunt | 100 |
   | enforcer | 150 |
   | brain | 500 |
   | prog | 100 |
   | spheroid | 1000 |
   | quark | 1000 |
   | tank | 200 |
   | spark, cruise missile, tank shell | 25 each |
   | hulk | 0 |

   All match.
3. **Stray block at the canvas top-left.** Fixed in M4: the Milestone 3 self-test's
   entities.
4. **Grunt cadence.** Ported from the ROM and checked in MAME with
   `tools/grunt_probe.lua` (Phase 21, `fb0d989`).

---

## M2 — Animation fidelity (4-direction facing) — DONE 2026-10-11

Everything that walks now faces the way it moves, using the ROM's own direction
tables (robotron-re REVERSE.md Phase 21, "Sprite facing"). The atlas keeps the ROM's
frame order (left 0–2, right 3–5, down 6–8, up 9–11; hulks are reordered, see below).

1. ~~**Grunt 4-direction walk.**~~ Not needed: grunts have only 3 frames (one
   facing), stepped once per move as in the ROM. $5EAB, once thought to be the grunt
   walker, is the prog's update routine.
2. **Humans** ($425F/$4312, which Ph19 had mislabelled as hulk code):
   - One step every 8 frames from one of 8 [frame, dx, dy] tables: 4 sides and 4
     diagonals, which use the side frames. Steps are 2/1 px across and 1 line down or up.
   - They rehome after (rand & $7F)+1 steps, or on hitting an electrode or the wall.
   - This replaces the random-target wander (`humans.ts`).
3. **Player** ($6FFC–$7030):
   - Faces the *move* stick. Diagonals face sideways, and the pose steps every other
     frame while moving.
   - The fire stick never changes the pose. The old note here, "face the shoot vector",
     was wrong: Ph11 had misread the walker as fire-driven.
   - The game starts on frame 6 (standing, facing down).
4. **Enforcer atlas sprite.** Fixed in M3 (2026-10-11). The atlas `enforcer` family is not the
   enforcer; the ROM's records ($18D2–$18E6) are `enforcer_spawn_1`…`5` (materializing)
   and `enforcer_spawn_0`.
5. **Brains** ($5C58): sideways frames when stepping sideways, else up or down; one frame
   per step.
6. **Hulks** ($4030/$4106):
   - Left/right tables step 3/4 px and up/down tables step 2 lines; up reuses the down
     frames.
   - They rehome on the other axis toward a target fixed at spawn: the player if rand >
     $C0, else a human round-robin, and the player once that human dies.
   - The atlas index is [0,1,2,6,7,8,3,4,5][record].

**Verified:**
- **MAME** (robotron-re `tools/facing_probe.lua`, wave 2, real stick inputs):
  - Player frames match the move stick in all four directions. Firing right while
    standing, left + fire up, and up + fire left all keep the move-stick pose.
  - Human and hulk frames match their direction of travel, and their step sizes match
    the tables.
- **Browser:** the same sequences for the player, humans, hulks and brains, with no
  errors.

---

## M3 — Combat authenticity — DONE 2026-10-11

All from the ROM (robotron-re REVERSE.md Phase 21, "Enforcers and sparks" and "Cruise
missiles"):

1. **Shootable enemy shots.** Player fire destroys enforcer sparks ($54DC), brain cruise
   missiles ($6119) and tank shells ($8FD5), each worth 25 points (`score_update` $0025).
2. **Tank shells.** The old "115 pts ($5483)" note was a misread: $5483 is the enforcer's
   death, worth 150. Shells are worth 25, like the other shots.
3. **Enforcers.**
   - They use the ROM sprite, materializing through 5 frames over 40 frames.
   - Every 3 frames they ease toward the player plus random −16..15: velocity = distance ×
     2/256 per frame, re-aimed every (rand & 31) passes.
   - A spark every prng_le($BE5F) passes, at most 20 live.
4. **Sparks.**
   - They spin through the 4 atlas `spark` frames.
   - Velocity is distance × 4/256 per frame toward the player plus random −16..15.
   - A fixed random impulse every 4 frames makes them curve.
   - They fizzle after 80–140 frames and slide along walls, using the ROM mover ($DD09).
5. ~~**Spheroid child-spawn pacing.**~~ Done (`96a110d`); re-checked in MAME 2026-10-11 at
   difficulty 0 and 10.
6. ~~**Hulk human-seeking.**~~ Done in M2 (`01a1c77`).

**Verified in the browser** (wave 4):
- Enforcer frames 1–5 at 8-frame steps, then the enforcer, 10 × 11.
- Spark lifetimes 80–140 frames; sparks curve and slide along the side walls.
- Shooting a spark scores 25. No errors.
- Not done: the exit criterion's side-by-side volley count against MAME. The timers it
  depends on were MAME-checked in `96a110d`.

**Not ported:** tank shells that bank off a wall point ($8ED4), and per-shot sound samples
for sparks and missiles. All three shot deaths play `sub_quark_pop`; the ROM's shell-death
sound is $4B1E.

---

## M4 — Presentation & game flow — DONE 2026-10-11 (heroes layout left)

Checked against MAME snapshots (robotron-re `tools/gameover_probe.lua`; REVERSE.md Phase
21, "Player death, game over and the HUD"):

1. **Game over.**
   - The DOM "PLAY AGAIN?" box is gone.
   - The last man flashes and fades on the frozen playfield. GAME OVER then shows at the
     ROM position and colour for 120 frames, then initials entry if the score qualifies,
     then the heroes table for 580 frames, then the attract cycle.
   - START begins a new game from any attract screen, as before.
   - Not ported: the rectangle wipe before the heroes table when the score doesn't qualify.
2. **Wave-complete flash.** Not needed. The ROM routine this item cited ($9E60) is the
   player death; the wave-clear sequence (`WaveTransition.ts`, already timed in MAME)
   has no player flash.
3. **Player death** (`core/DeathBeat.ts`):
   - No explosion. The playfield freezes.
   - The man is a solid silhouette in entry 9, then flashes entries 0/1/3/7 every 6 frames,
     10 times, then fades through $FF…$09 at 4 frames a step.
   - At frame 104 the man is taken. The wave is re-laid from what survives: grunts,
     electrodes, family, hulks, brains, spheroids and quarks get fresh ROM spawn positions
     and beam in. Enforcers, tanks, progs and shots are gone.
4. **Heroes separator.**
   - The ROM uses ')' (MAME), not '>': the ROM's '>' glyph is an up-arrow. BitmapFont now
     synthesizes ')'.
   - Left: the arcade table is in the tall font, in two columns (1–5, 6–10), plus ALL TIME
     HEROES; the port shows one column.
5. **HUD, both players** (`core/ArcadeHud.ts`):
   - Scores in the tall font, ending at x 82 / 210. The current player's score cycles in
     palette entry A, and the waiting player's is red; a zero score shows as "00".
   - The ROM life icon from x 86 / 214.
   - The bottom "P1-wave WAVE P2-wave" line in entry A.
   - Glyphs are drawn with no extra gap, as in MAME.
6. ~~**Richer per-wave electrode shapes.**~~ Done in `1d43a7c` (ROM bitmaps for every wave).

**Also fixed:** the Milestone 3 self-test left its test entities visible at the stage
origin (a small square in the top-left corner on every screen).

**Verified in the browser:**
- **Death:** freeze, re-lay with new positions, play resumes after 170 frames (MAME: 184).
- **Game over:** GAME OVER at frame 122 at (118, 121), initials at 238, heroes at 242
  (MAME: 240), demo 580 frames later.
- **HUD:** P1 and P2 positions match the MAME measurements.
- No errors.

---

## M5 — Systems polish (stretch)

1. **Sound priority values.** Our single-channel priority scheme exists; align the
   actual priority numbers with the ROM track table (e.g. quark death $77, spheroid
   death $70, high-score $EF — Ph20) so preemption decisions match.
2. **Attract cutscenes.** Alt-font story screens between attract phases.
3. **Waves 13+ policy.** ROM wave table was captured for waves 1–12; decide and
   document the wrap rule for 13+ (arcade repeats late-wave configs) and implement.
4. **Demo-play input.** ROM attract uses scripted demo input (DP[$52]); replace the
   current AI demo player with something closer to the ROM's feel if observable.

**Exit criteria:** each item verified against MAME where observable; explicitly
documented as intentional deviation where not.

---

## M6 — Release 3.0

1. Update README.md + CLAUDE.md with Release 3.0 notes (atlas pipeline, arcade
   systems, verification results). Fold this plan's outcomes into the docs.
2. `npm version major` → v3.0; tag; push branch + tags; merge to main per repo flow.
3. `npm run deploy` (gh-pages) and verify the live demo end-to-end.
4. GitHub release with before/after screenshots vs MAME.

**Exit criteria:** live demo at shatch.github.io/robotron plays a full credit
correctly; tag `v3.0` published.

---

## Verification method (applies to every milestone)

- **MAME side-by-side:** `robotron-re/snap/robotron/*.png` (0001 = clean wave 1)
  plus fresh captures via the existing Lua tooling when RAM values are needed.
  Remember: probe scripts that `dofile(capture_gameplay.lua)` overwrite
  `gfx/blit_log_gameplay.csv`.
- **Web:** `npm run build && npm run preview` (:4173), Playwright with
  `window.__game`; invulnerability via `gameState.playerInvulnerableTime`.
  Restart the Playwright browser before trusting "frozen game" symptoms.
- Per-frame bounds/behavior audits in-page (pattern established in the
  boundary-fix session) beat eyeballing for anything quantitative.
