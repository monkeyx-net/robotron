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

## M1 — Verification foundation + known defects

*Why first: everything after this is judged against these tools.*

1. **PRNG golden test.** Capture 1,000 consecutive outputs of the ROM PRNG ($D6CD)
   in MAME Lua (read DP[$85:$86] per call), commit as a fixture, and assert
   `js/core/Prng.ts` reproduces the sequence exactly from seed $A55A (the ROM's
   startup seed per REVERSE.md Ph23). Wire it as a browser-console test now;
   port to Vitest when a test runner lands.
2. **Scoring ledger check.** One scripted MAME session + one web session killing the
   same enemy types; compare per-event awards against the RE ground truth:
   grunt 100, flat-grunt 110, quark bullet 115, prog 120 (quark 120 BCD $0120),
   brain 150, side-enemy/spheroid 210 BCD, spark/enforcer bullet 25.
   Fix any web-side mismatch.
3. **Stray blue pixel-block at canvas top-left** (outside the arena). Reproduce on a
   fresh load, identify the orphan sprite/graphics via stage traversal, remove.
4. **Grunt cadence spot check.** Film 10 s of wave 1 in MAME and web; compare
   grunt step rhythm (ROM: stepped moves, timer=3 frames per behavior tick,
   re-home when PRNG[$84]>$F8 or PRNG[$86]>$E4 — Ph12).

**Exit criteria:** PRNG test green; scoring table matches RE values; no stray
pixels outside the arena; grunt cadence visually indistinguishable at 10 s.

---

## M2 — Animation fidelity (4-direction facing)

*The single most visible remaining gap. The atlas keeps the ROM's frame order (left 0–2,
right 3–5, down 6–8, up 9–11). The player and humans always use the left-facing walk
(frames 0–2); hulks and brains cycle through every frame whichever way they move. Progs
already pick their direction's frames (`humans.ts`).*

1. ~~**Grunt 4-direction walk.**~~ Not needed: grunts have only 3 frames (one
   facing), stepped once per move as in the ROM. $5EAB, once thought to be the grunt
   walker, is the prog's update routine.
2. **Human family 4-direction walk.** mommy/daddy/mikey each have 12 frames
   (3 walk × 4 dirs). Same selection rule.
3. **Player 4-direction walk + fire-direction poses.** ROM has a fire-direction
   sprite walker ($6FFC–$7030, sprite records $35EB+) that overrides the walk pose
   while firing: face the shoot vector, not the move vector. Implement pose
   priority: firing > walking > idle.
4. **Enforcer atlas sprite.** Replace the placeholder with the atlas family
   ($52C6–$53B6) if the pinned atlas frames are usable; otherwise leave procedural
   and note why (atlas must not be rebuilt).
5. **Brain 4-direction animation** (ROM tables L/R/U/D — Ph15) if atlas frames allow.

**Exit criteria:** side-by-side against MAME snap frames: entity facing matches
movement/fire direction for player, humans, hulks and brains on waves 1–5.

---

## M3 — Combat authenticity

1. **Shootable enforcer sparks.** ROM: enforcer bullets die to player fire and award
   25 pts ($54DC — Ph16). Also enforce the ROM's cap of 8 live sparks (DP[$8E] — Ph21)
   and electrode spark death award of 25 pts ($6119).
2. **Shootable tank shells.** ROM sub-bullet on-hit awards 115 pts ($5483 — Ph18).
3. **Enforcer fire throttling.** Match per-wave spawn params ($BE5F/$BE60) and the
   aim model: PRNG[$85]>>3 + clamped homing delta ×4 → velocity (Ph16), replacing
   any smooth-aim approximation.
4. **Spheroid child-spawn pacing.** Period from $BE66, throttle while quark count
   ($BE71) < 20 (Ph17) — verify current spawn cadence against these rules.
5. **Hulk human-seeking.** ROM hulks target the next human (circular scan of the
   human pointer table, falling back to player — Ph19 $4237/$4106), not random
   wander. Verify/port; keep bullet-nudge (already done).

**Exit criteria:** sparks/shells killable for the RE point values; enforcer volley
density comparable to MAME at waves 3–5; hulks visibly hunt humans.

---

## M4 — Presentation & game flow

1. **Arcade game-over flow.** Replace the DOM "PLAY AGAIN?" button with the ROM
   sequence ($B9AF — Ph14): game over → high-score entry (if qualifying) → heroes
   table → attract cycle. Enter/start inserts a new game from any attract screen.
   (Initials-screen field clear already done.)
2. **Wave-complete flash.** ROM flashes the player sprite during the wave-complete
   countdown before clearing non-priority objects ($9E60–$9EA9 — Ph14). Add the
   flash-then-transition beat.
3. **Player-death beat.** ROM: death music track + free objects + wave respawn
   ($70EF). Verify our death sequence matches (timing + entity re-scatter).
4. **Heroes table separator.** Use '>' as the ROM does (parens are not in the ROM
   charset; currently '.').
5. **2P dual-score HUD.** Position both scores per the ROM video rows ($150E/$550E
   row $0E — Ph7); P2 score visible during 2P games.
6. **Richer per-wave electrode shapes.** Extend the procedural electrode variants
   to match per-wave shapes observed in the MAME snapshots.

**Exit criteria:** a full credit (insert → play → die → initials → heroes → attract)
matches the arcade sequence with no DOM chrome; screenshots match MAME reference
frames for HUD layout and wave transitions.

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
