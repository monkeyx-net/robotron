# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A native C11 / SDL2 port of Robotron: 2084 for Linux handhelds (aarch64:
ArkOS, ROCKNIX, muOS, Knulli) and x86_64 (Steam Deck, desktops), ported from
the web remake in this repo. **The plan, decisions and test plan live in
[SDL2_PORT_PLAN.md](SDL2_PORT_PLAN.md)**; read it before larger changes and
keep its phase table up to date.

Work happens on the `sdl2-port` branch, which holds only the C port. The web
remake (TypeScript, PixiJS) it was ported from lives on the `main` branch (last web commit `627ca56`).

## Ground Rules

- **The web build is the behaviour reference.** Read it from git, not from the
  tree: `git show main:js/enemies.ts`. Comments in `src/` that cite
  `js/...` files refer to that branch. Never port fixes back to `main` unasked.
- `sprites/` and `sounds/` are ROM-derived assets from the web build: don't
  hand-edit them; patch problems in C (e.g. synthesized glyphs in `gfx/font.c`).
- **All new code and tooling is C** (built with CMake). The one exception is
  MAME probe scripts, which must be Lua (MAME's scripting language); they only
  dump RAM to text files, and C or CMake does the comparing.
- New files go in `src/`, `CMakeLists.txt` or `SDL2_PORT_PLAN.md`. Ask before
  adding files elsewhere (for example `.github/`).
- **No ROM-derived data is compiled into the binary** (plan, decision 1). The
  game reads sprites, fonts, sounds and the ROM tables from `assets/` at run time.
- The user's ROM set lives in `robotron/` (git-ignored); never commit ROMs or
  zips, and never send them anywhere.

## Commands

```bash
cmake -S . -B build && cmake --build build -j     # build (extracts ROM tables if robotron/ exists)
ctest --test-dir build                            # all tests
ctest --test-dir build -L rom                     # tests needing the ROM set
ctest --test-dir build -L mame                    # tests needing MAME + the ROM set
build/robotron --windowed                         # run
SDL_VIDEODRIVER=dummy build/robotron --input src/tests/scripts/wave1.txt \
    --frames 600 --screenshot out.png             # headless replay + screenshot
build/robotron --extract robotron/ [assets_dir]   # ROM tables from a folder or robotron.zip
cmake --build build --target package_linux package_portmaster   # release archives
cmake -S . -B build-san -DROBOTRON_SANITIZE=ON    # ASan/UBSan build
```

Release builds: `-DROBOTRON_DEV_ASSETS=OFF` (no source-tree asset fallback).
The build dir is a runnable layout: `build/assets/` links to `sprites/` and
`sounds/` and holds the extracted `data/`.

## Layout (`src/`)

- `main.c` - SDL setup, fixed 60 Hz loop, mode switch (attract / play /
  initials entry / operator menu), `--frames`, `--screenshot`, `--input`, `--extract`
- `platform/` - the only code that includes SDL: `video.c` (292x240
  framebuffer, integer scale), `input.c` (pads, ABXY fire, quit = hold
  Select+Start 1 s, operator menu = Select+R1 / F2, 2P = L1+Start / key 2),
  `audio.c` (mixer with the web build's priorities and crossfades)
- `sim/` - pure C game simulation, no SDL, no drawing: `world.c` (all
  entities, collisions, scoring, wave/death/game-over flow, demo play, 2P),
  `pacing.c` (wave parameters, grunt pacing, mercy), `spawn.c` (ROM spawn
  positions), `prng.c` (the ROM's prng_update), `sound.h` (sound table)
- `gfx/` - draws into the framebuffer: `blit.c`, `font.c` (web BitmapFont
  rules + synthesized glyphs), `palette.c` (colour cycles), `play.c`,
  `title.c`, `story.c`, `heroes.c`
- `game/` - `attract.c` (title, story, heroes, demo cycle), `entry.c`
  (initials), `hiscore.c` (heroes tables), `opmenu.c` (GAME ADJUSTMENT),
  `storage.c` (saved settings and scores)
- `assets/` - `assets.c` (finds and loads `assets/`), `png.c`, `json.c`,
  `inflate.c`, `zip.c`, `rom.c` + `extract.c` (the only code reading the ROM)
- `tests/` - C tests, golden hashes, input scripts, MAME probes
- `packaging/` - release layout script, PortMaster launcher and metadata

## Conventions

- C11, `-Wall -Wextra`, no warnings. Builds must also pass in Ubuntu 20.04
  (GCC 9, SDL 2.0.10, the PortMaster base): use only the SDL 2.0.10 API.
- The sim is deterministic: step once per frame, no wall clock. Gameplay
  randomness uses the ROM PRNG in the web build's call order; the web's
  untraced `Math.random` gameplay uses `World.aux`; cosmetics use `World.fx`.
  Never draw randomness for cosmetics from the gameplay PRNG.
- `sim/` must not include SDL or touch the framebuffer; `gfx/` only reads sim state.
- Port behaviour from the web build faithfully (including its quirks), and cite
  the TS file or ROM address in a short comment where it helps.
- Match the surrounding code: comment density, naming, idiom.

## Testing

Every change keeps `ctest` green (plan section 3).

- `prng_golden`, `assets`, `hiscore` - always run
- `rom_extract`, `rom_zip_extract`, `world_flow`, `play_golden` - label `rom`
  (need `robotron/`); `rom_extract` checks the extracted tables against hashes
  recorded when they matched the web build's generated TS tables byte for byte
  (`src/tests/golden/extract.txt`)
- `mame_prng_golden` - label `mame`: MAME reproduces `src/tests/fixtures/prng_golden.txt`
- `play_golden` compares screenshot hashes of scripted runs
  (`src/tests/golden/play.txt`). After an intended behaviour change, regenerate:
  `cmake -DGAME=build/robotron -DSCRIPTS=src/tests/scripts -DGOLDEN=src/tests/golden/play.txt -DWORKDIR=build/golden -DUPDATE=1 -P src/tests/run_golden.cmake`
- Tests that run the game use their own save dir (`ROBOTRON_SAVE_DIR`); never
  write to the user's `~/.local/share/robotron`.

## Reference

- ROM: MAME `robotron` (Solid Blue); `prng_update` at `$D6CD`, direct page `$98`;
  table addresses are listed in `src/assets/extract.h`.
- MAME 0.289 runs it headless; see `src/tests/mame/run_probe.cmake` for the options.
- Reverse-engineering notes are in the sibling `robotron-re` repo (REVERSE.md
  Phase 21), cited by the web build's TS comments (on `main`).
