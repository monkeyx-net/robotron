# Operator Settings Plan (arcade "GAME ADJUSTMENT" menu)

Status: **steps 1–3 committed (`62d5a8f`); step 4 done 2026-10-11 (uncommitted); step 5 optional.** Branch: `release-3.0`.

Goal: add the original ROM's operator adjustments that matter to gameplay,
and skip those that only make sense on physical cabinet hardware.

## Ground truth (captured from the ROM in MAME)

The arcade menu is reached with ADVANCE while the AUTO-UP/MANUAL-DOWN switch is
set (bookkeeping first, then GAME ADJUSTMENT). Every value range and label below
comes from stepping each item with FIRE DOWN/UP in MAME. The cursor skips the
indented pricing sub-items.

| ROM item | Values → on-screen label (factory default **bold**) |
|---|---|
| EXTRA MAN EVERY | 0 NO EXTRA MEN · 20000 LIBERAL · **25000 RECOMMENDED** · 30000 CONSERVATIVE · 50000 EXTRA CONSERVATIVE |
| TURNS PER PLAYER | 1–20 · 2 HIGH VOLUME ARCADES · **3 RECOMMENDED** · 4 FOR WEAKER PLAYERS (others unlabeled) |
| DIFFICULTY OF PLAY | 0–2 EXTRA LIBERAL · 3–4 LIBERAL · **5 RECOMMENDED** · 6–7 CONSERVATIVE · 8–10 EXTRA CONSERVATIVE |
| LETTERS FOR HIGHEST SCORE NAME | 3–20 · **3 RECOMMENDED** |
| FANCY ATTRACT MODE | **YES** / NO |
| RESTORE FACTORY SETTINGS | NO / YES |
| HIGH SCORE TABLE RESET | NO / YES |

Screen layout: title "GAME ADJUSTMENT", green rows in the ROM font, a `->` cursor,
value column plus label column, and footer lines "USE -MOVE- TO SELECT ADJUSTMENT",
"USE -FIRE- LEVER TO CHANGE THE VALUE", "PRESS ADVANCE TO EXIT" (yellow).

Note: the robotron-re MAME `nvram/` has non-factory settings (20 turns, difficulty 0,
extra man 20000). For probes, use an isolated copy: `-nvram_directory <scratch copy>`.

## Decisions (from Steve)

1. **Opening the menu:** `F2` (MAME's service key), `?` (match `e.key === '?'` so it
   works on any keyboard layout), and gamepad **Select+Start** (buttons 8+9), from the
   title/attract screens only. None of these keys are bound anywhere else today
   (checked `js/` and `InputManager` bindings).
2. **Difficulty:** the arcade's 0–10 DIFFICULTY OF PLAY **replaces** the existing
   adaptive system. Retire `js/core/DifficultyManager.ts` (and the stray
   `DifficultyManager 2.ts`, `DifficultyManager.test.ts`) and the
   `GameSettings.difficulty: 'easy'|'normal'|'hard'` field in `core/SaveSystem.ts`.
   None of them are wired into the legacy game loop, so removal changes no behavior.
   Update CLAUDE.md's references to them.

## Out of scope (cabinet hardware only)

Pricing selection and the slot/credit unit settings; coin bookkeeping and CLEAR
BOOKKEEPING TOTALS; ROM/RAM/sound-line/color/CRT diagnostics; AUTO CYCLE; tilt; the
physical high-score-reset switch; SET ATTRACT MODE MESSAGE and SET HIGHEST SCORE NAME
(operator branding text).

## Steps

1. **DONE 2026-10-10 — what difficulty changes.** Answer: neither a multiplier nor
   per-level tables. The ROM wave-init (CPU $2B7C) nudges 12 per-wave speed/timer
   params ($BE5C–$BE67: grunt step bound, hulk/brain step timers, enforcer shot
   rate/speed, spheroid timers, quark fire scale…) by
   `round(v·|d−5|·k/256)` and clamps them. Enemy **counts never change**. Difficulty
   below 5 snaps to 5 from wave 14, or from wave 5 while lives ≥ 3. Ported as
   `js/core/WaveParams.ts` (generated from the ROM; matched MAME on 186/186 waves
   at difficulties 0/2/3/5/7/8/10). Details: robotron-re REVERSE.md Phase 21.
   Step 4 therefore means replacing the port's hard-coded timers (grunt 3-frame
   step, hulk 8-frame step, enforcer/spheroid/tank timings) with `getWaveParams()`.

   Original research notes:
   With isolated NVRAM, set difficulty to 0, 5 and 10 through the menu (script pattern:
   AUTO-UP=1, ADVANCE, ADVANCE, MOVE DOWN×4, FIRE DOWN×12, FIRE UP×n; step every ≥30
   frames or ADVANCE falls through into the RAM test). Then run the gameplay bot and
   dump the per-wave parameter RAM (`$BE5E–$BE71`: speed/timer params plus counts) at
   each wave start, waves 1–12. Compare the three runs to see which values scale. The
   result decides whether difficulty is a multiplier on `js/waveTable.ts` or
   per-level tables.
2. **DONE — settings store** (`js/core/OperatorSettings.ts`). A versioned localStorage object (e.g. `robotronOperatorSettings`)
   with the factory defaults above, loaded at game start. Wire in:
   - turns per player → `resetGameVariables()` in `js/gameLogic.ts` (replaces
     `GameConfig.INITIAL_LIVES`); applies to both players in 2P (`core/TwoPlayer.ts`).
   - extra man every → `checkForExtraLife()`; **0 = no extra lives**.
   - letters for score name → `core/HighScoreEntry.ts`. As in the arcade, it applies
     only to a new #1 score ("HIGHEST SCORE NAME"); other entries stay 3 initials.
   - high score table reset → clear `robotronHighScoreTable`.
   - restore factory settings.
3. **DONE — menu screen** (`js/core/OperatorMenu.ts`, state `OPERATOR_MENU`; exits on
   key/button *release* so the held key can't start a game). A replica of GAME ADJUSTMENT in the ROM font (`core/BitmapFont.ts`),
   with the layout above. Move up/down selects, fire up/down changes the value, and
   ADVANCE (Enter / Esc / F2 / gamepad Start) saves and exits. Keyboard and gamepad
   both work, with edge-triggered pad polling as in `HighScoreEntry.ts`. New game
   state, e.g. `'OPERATOR_MENU'`.
4. **DONE 2026-10-11 — difficulty and enemy pacing** (`js/core/WavePacing.ts`).
   - Pre-work (MAME, robotron-re `tools/grunt_probe.lua`, REVERSE.md Phase 21) found that the
     real grunt is the flat-ROM `$79CE` routine, not the Ph12 object the port had copied:
     - The process runs every 4 frames; each grunt steps after 1..$BE5C passes (uniform).
     - Steps are diagonal: 4 px in X and 4 lines in Y.
     - Each grunt death multiplies the bound by 0.875, floored at $BE5D.
     - A ramp tick after 270 frames, then every 225, lowers floor/bound by 1/2 if the player
       scored since the last tick, else 2/4.
     - A death restores the floor.
     - A mercy table eases waves 1–4 after losing men.
   - Wired:
     - Grunts follow the ROM model exactly, with the walk frame advancing per step.
     - The hulk step timer is $BE61 per wave.
     - Enforcer shot delay, spheroid spawn delay, brain speed and tank-shell speed take the
       ratio value(difficulty)/value(5). At difficulty 5 those keep their current tuning.
     - `addScore()` in gameLogic feeds the ramp's "scored" flag.
   - Retired DifficultyManager (+ copy, test, test page) and `GameSettings.difficulty`.
     CLAUDE.md and the README were updated.
   - Verified in the browser:
     - Wave 1: 20/9 at difficulty 5 and 15/7 at difficulty 10.
     - Steps are 4 px diagonal at multiples of 4 frames.
     - Kills ×0.875; the ramp ticks at 270/225 frames; mercy 30/15 after a wave 1 death.
     - Waves 2–5 play with no console errors.
   - Follow-ups:
     - Trace the remaining params to replace the ratios with ROM-exact use (per-wave
       progression too): $BE5E/$BE62/$BE64/$BE66 spheroid/child, $BE5F/$BE60 enforcer fire,
       $BE63 brain step size, $BE65/$BE67 quark.
     - Reconcile `waveTable.ts` counts with the ROM count tables (see REVERSE.md).
5. **Optional:** FANCY ATTRACT MODE toggle; a statistics page (extra men earned, play
   time, men played — non-coin bookkeeping); a controller test screen (the web version
   of the switch test).

Verification for each step: a Playwright test that changes the setting, starts a game
and checks the effect (lives shown, extra-life threshold, initials length, cleared
table). `npx tsc --noEmit` and `npm run build` must pass. Restart Vite after editing
`main.ts`/core modules before driving the page (HMR creates duplicate module instances).
