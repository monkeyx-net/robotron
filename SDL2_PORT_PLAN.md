# SDL2 Handheld Port Plan (aarch64 + x86_64 Linux)

Goal: run Robotron: 2084 natively on Linux handhelds (ArkOS/dArkOS, ROCKNIX,
muOS, Knulli, AmberELEC; RK3326, RK3566, H700 class SoCs) and x86_64 Linux
(Steam Deck, Legion Go/ROG Ally on Linux, desktops) using SDL2, with the same
arcade fidelity as the web build (v3.1.0).

## 1. Evaluation

### What the codebase is today

| Measure | Value |
|---|---|
| TS files reachable from `js/main.ts` | 70 files, ~23.5k lines (~2k of them manual test modules) |
| Files importing PixiJS | 37 |
| Browser API use | `window.` 77 hits, `document.` 38, `addEventListener` 44, `localStorage` 43 (6 files), `navigator.getGamepads` 7, `performance.now` 22 |
| Audio | Howler, 1 file (`soundManager.ts`), 26 WAVs (9.4 MB incl. 1.1 MB `sounds/backup`) |
| Rendering features actually used | sprites from one atlas, bitmap-font glyph sprites, `tint`, `alpha`, filled rects/`Graphics`, two `generateTexture` calls; no shaders or filters in the game path |
| Timing | Split across `GameEngine` callbacks *and* ~8 independent `PIXI.Ticker` callbacks (ColorCycles, ArcadeHud, WaveTransition, DeathBeat, HeroesScreen, AttractStory, ui game-over) that use variable `deltaTime` |
| Determinism | ROM PRNG exists (`core/Prng.ts`, golden-tested) but 68 `Math.random` calls remain, several in gameplay (`enemies.ts`, `enemiesClasses.ts`, `humans.ts`, `Human.ts`) |
| Sim/render separation | None: entities hold `sprite` and `position` and write `sprite.x/y` inline (e.g. `enemies.ts:51`, `:409`) |

The parts that are actually valuable, the ROM-derived data and behaviour, are
small and portable: `Prng.ts`, `waveTable.ts`, `WaveParams.ts`,
`ElectrodeShapes.ts`, `SpawnPlacement.ts`, `ColorCycles.ts`, `WavePacing.ts`,
`DeathBeat.ts`, the enemy AI in `enemies.ts`, scoring and wave flow in
`gameLogic.ts`, the HUD/heroes layouts, and the atlas and fonts. A large share of
the rest (GameEngine, RenderSystem, RenderIntegration, SaveSystem/SaveLoadManager,
ErrorHandler, VisualEffects, CollisionIntegration, the dual GameObject classes) is
refactoring scaffolding, and a handheld build does not need it.

### Options considered

**A. Native C11 rewrite on SDL2 (recommended).**
A single small binary with no runtime besides SDL2, which every handheld CFW
already ships with KMSDRM/Mali patches. It renders in software into a 292x240
framebuffer that SDL upscales: about 70k pixels per frame, trivial even on a
Cortex-A35 (RK3326), and it works the same on GLES2, KMSDRM, X11 and Wayland.
It fits PortMaster packaging directly. The cost is re-implementing about 6-9k
lines of game logic, and the risk is fidelity drift. The test plan's
reference captures from the arcade in MAME address that risk.

**B. Keep the TS: embed QuickJS-ng in a C/SDL2 host with a "mini-PIXI" shim.**
This keeps one source tree. But the shim would have to cover Container/Sprite/
Graphics/Texture/Ticker/Assets plus DOM, localStorage and gamepad stand-ins, and
the code would still need untangling from PIXI.Ticker timing. On A35/A53 cores,
interpreted JS plus GC pauses during heavy waves (100+ entities, sparks,
explosions) is a real risk of dropped frames. Rejected as the primary path. It is
worth revisiting only if keeping a single codebase outweighs handheld performance.

**C. Node/Electron/WebView or `@kmamal/sdl` bindings.**
Rejected. Most handheld CFWs have no browser stack or window manager, and Node
adds about 40-80 MB of runtime, slow startup on SD cards, a bundled SDL that
bypasses the device's patched SDL, and glibc-compatibility trouble.

### Recommendation

Do option A in C11 with SDL2 only (no SDL2_mixer/SDL2_image; use a small custom
mixer, and embed or `stb_image` the atlas). The web build stays untouched:
fidelity is checked against the arcade itself, by capturing reference data
from the user's ROM set running in MAME (section 3.0).

### Decisions (2026-10-17)

1. **Asset distribution: both routes.** The binary never embeds ROM-derived
   data. It loads assets at run time from an `assets/` directory (atlas,
   fonts, tables, sounds), which can be filled in either of two ways:
   - **Full release** (self-hosted GitHub release tarballs per arch): the
     binary plus `assets/` copied from this repo's `sprites/`, `sounds/` and
     generated tables, shipped with the same `NOTICE` as the web build.
   - **PortMaster / ROM-supplied**: the binary only. On first run, if
     `assets/` is missing, `robotron --extract <robotron.zip>` (also run
     automatically by the launcher when it finds the zip in the port folder)
     builds the atlas, fonts and tables from the player's own ROM set. The
     extractors are ports of the robotron-re tools. Sounds have to be rendered
     from the sound-board ROM, which needs a small 6808 + DAC emulator, so
     that is its own work item (P5b). Until then the PortMaster build plays
     without sound if no WAVs are present.
   Both builds load the same `assets/` layout, and CI checks that the
   extractor's output matches the full release's files byte for byte.
   Implemented so far (`src/assets/rom.c`, `extract.c`): the extractor
   reads ROM tables at their documented CPU addresses and writes plain
   text to `assets/data/` (`heroes.txt` from `$E495`, `waves.txt` from
   `$2E24`); the game reads only those files. Development builds run it
   after every build when `robotron/` holds the ROM set, and the `rom`
   CTest label cross-checks the output against the web build's
   `js/waveTable.ts`.
2. **Select+Start**: hold 1 s = quit to the frontend; Select+R1 = operator menu
   (both rebindable).
3. **No right stick**: ABXY = fire up/right/down/left, two buttons together =
   diagonal, optional fire-lock (hold R1). See 2.4.
4. **Location**: the C code lives in `src/` in this repo, with tests in
   `src/tests/`. The web build stays in `js/`.

### Remaining risks

1. **glibc floor.** ArkOS is still on glibc 2.30. Build in an old-glibc
   container and link everything except SDL2/libc statically.
2. **Two codebases** after the port. Mitigation: ROM tables get a C emitter in
   the same generators (`robotron-re/tools/gen_*`), and the golden-trace suite
   fails CI when the two drift.
3. **Sound extraction** (decision 1) is the largest unknown. If the 6808
   emulator is too much work, fall back to documenting a MAME capture script
   the player runs themselves.

## 2. Design

### 2.1 Layout

```
CMakeLists.txt              # repo root; targets: robotron, robotron_tests
cmake/toolchain-aarch64.cmake
src/
  main.c                    # SDL init, fixed 60 Hz loop, platform glue
  platform/{video,audio,input,storage}.c   # only files that include SDL
  sim/                      # pure C, no SDL: deterministic game simulation
    prng.c  wave.c  pacing.c  spawn.c  player.c  enemies.c  humans.c
    projectiles.c  collision.c  scoring.c  twoplayer.c  operator.c
  gfx/                      # draws the sim state into uint32 fb[240][292]
    fb.c  blit.c  font.c  hud.c  heroes.c  attract.c  deathbeat.c  colorcycle.c
  assets/                   # run-time loader for assets/ + the ROM extractor
  tests/                    # see section 3
packaging/portmaster/  packaging/linux/
```

ROM-derived data (wave tables, electrodes, atlas, fonts, sounds) is loaded at
run time from `assets/`, never compiled in, so the binary itself carries no
ROM material (decision 1).

Rule: `sim/` never includes SDL or touches the framebuffer, and `gfx/` only
reads sim state. That makes the sim headless-testable and replayable.

### 2.2 Loop and timing
- Fixed 60 Hz sim step (`sim_step(&state, inputs)`), accumulator in `main.c`,
  vsync on. The panel refresh is 59.x-60.x Hz on most handhelds. If drift is
  > 1 frame per second, repeat or skip a step rather than interpolate (arcade
  logic is frame-quantised).
- Every PIXI.Ticker effect (colour cycles, wave transition, death beat, wipes,
  typing text) becomes a frame-counter inside the sim state, advanced by
  `sim_step`, never by wall time.

### 2.3 Video
- Software framebuffer 292x240 ARGB8888 → `SDL_UpdateTexture` → `SDL_RenderCopy`
  with nearest scaling, integer scale by default (640x480 → 2x = 584x480;
  720x720 → 2x letterboxed; 1280x800 → 3x = 876x720), optional "fit" and
  scanline overlay settings.
- `SDL_WINDOW_FULLSCREEN_DESKTOP`; honour `SDL_VIDEODRIVER` (kmsdrm, wayland, x11).
- Tint/alpha are done in the blitter, which is also where palette colour cycling
  happens, as on the arcade.

### 2.4 Input
- `SDL_GameController`, loading `SDL_GAMECONTROLLERCONFIG` / `gamecontrollerdb.txt`
  (PortMaster provides it), keyboard fallback with the same bindings as the web.
- Move: left stick or D-pad. Fire: right stick, 8-way with the ROM's dead
  zones. Without a right stick: ABXY = fire up/right/down/left, two buttons
  together = diagonal, plus an optional "fire-lock" mode (hold R1 to lock fire
  direction to move direction).
- Select = coin, Start = 1P start (Start held with coin = 2P), hold
  Select+Start 1 s = quit, Select+R1 = operator menu (decision 2). Bindings
  live in a config file.

### 2.5 Audio
- One `SDL_AudioDevice` at 48 kHz/s16 stereo, 512-sample buffer. WAVs are
  loaded with `SDL_LoadWAV` and converted once at load with `SDL_AudioStream`.
- Small mixer that reproduces the web build's ROM sound priorities (a
  higher-priority sound pre-empts lower ones on the same channel, as on the
  sound board). Sounds are muted in demo play, as `canPlaySound()` does today.
- Drop `sounds/backup/` from the package.

### 2.6 Storage
`localStorage` keys map to INI/JSON files in `$PORT_DIR/conf/` (PortMaster) or
`$XDG_DATA_HOME/robotron/`: high scores (`HighScoreEntry`), operator settings,
key bindings. Writes go to a temp file followed by `rename` (handhelds get
powered off mid-write).

### 2.7 Build and packaging
- CMake; `-O2`, `-ffast-math` off (the sim must stay exact).
- aarch64: Docker `debian:buster` (glibc 2.28, SDL 2.0.9 headers), native on
  GitHub `ubuntu-24.04-arm` runners. x86_64: same base image. Stick to the
  SDL 2.0.9 API (newer calls only through `SDL_VERSION_ATLEAST` + runtime
  checks). CI checks `objdump -T | grep GLIBC_` ≤ 2.30.
- Two artifacts per release (decision 1):
  - `robotron-<ver>-portmaster.zip`: `Robotron 2084.sh` (sources
    `control.txt`, sets `SDL_GAMECONTROLLERCONFIG`, runs the extractor if
    `assets/` is missing and `robotron.zip` is present, then runs
    `robotron.${DEVICE_ARCH}`), `robotron/` with both binaries, `port.json`,
    `gameinfo.xml`, screenshot, README with "put robotron.zip here" steps. No
    ROM-derived files.
  - `robotron-<ver>-linux-{x86_64,aarch64}.tar.gz`: binary + `assets/` +
    `NOTICE` + `.desktop` file, self-hosted on GitHub Releases. Works on
    desktops, as a Steam Deck non-Steam game under gamescope, and on handhelds
    by hand.

## 3. Test plan

### 3.0 Ground rules and references (decided 2026-10-17)
- The web project (`js/`, `package.json`, assets) is not modified. All new
  code and tooling is C, built with CMake. The one exception is MAME probe
  scripts, which have to be Lua (MAME's scripting language). They only dump
  RAM to text files; all comparison happens in C or CMake.
- **Reference = the arcade.** Probes in `src/tests/mame/*.lua` run the
  user's ROM set headless in MAME (0.227+, tested with 0.289) and write
  fixtures in `tests/fixtures/`. CTest runs them (label `mame`) when `mame`
  and `ROBOTRON_ROM_DIR` (default `./robotron/`, git-ignored) are present,
  and skips them otherwise. CMake links old 1996 file names to MAME's names
  under `build/mame/roms/`.
- ROM revision: `robotron` (Solid Blue), all 15 SHA-1s matching MAME's set.
  `prng_update` at `$D6CD`, direct page `$98`.
- First probe done: `prng_probe.lua` reproduces `tests/fixtures/prng_golden.txt`
  byte for byte (CTest `mame_prng_golden`).
- Probes still to write: per-frame state dumps (object lists, positions,
  wave/score/lives, PRNG) for attract/demo and scripted play, with inputs
  driven through MAME's ioports from the same Lua probe; wave-start spawn
  positions; grunt/hulk/brain step cadence; electrode/palette per wave;
  sound-board command log (writes to the sound PIA).

### 3.1 Unit tests (C, `ctest`, run on x86_64 and aarch64 in CI)
| Test | Pass criterion |
|---|---|
| PRNG golden | C `prng` matches `tests/fixtures/prng_golden.txt` (1000 MAME outputs); `mame_prng_golden` re-captures it from the ROM |
| ROM tables | C tables (wave counts ×40, wave params ×difficulty 0-10, electrode bitmaps/palettes, spawn boxes) match the bytes read from the ROM at their documented addresses |
| Pacing | `prng_le` timer draws and grunt cadence/mercy table match MAME captures for waves 1-40 × difficulty 0, 5, 10 |
| Collision | Boundary cases (touching, 1-px overlap, playfield edges) behave as in MAME captures |
| Storage | Round-trip, corrupt file → defaults, power-cut simulation (kill during write) leaves the previous file valid |
| Input mapping | Synthetic SDL events → expected 8-way move/fire vectors, combos, dead zones, Select+Start quits only after 1 s |
| Extractor | `--extract` on a ROM set gives `assets/` byte-identical to the full release; wrong/missing ROM files give a clear error and leave no partial `assets/` (local only, since CI has no ROM) |
| Asset loader | Both packages start; with `assets/` missing and no ROM the game shows an instructions screen instead of crashing |

### 3.2 Simulation traces
- `robotron --trace out.txt --inputs rec.txt --frames F` (headless with
  `SDL_VIDEODRIVER=dummy`) writes one line per frame: frame, PRNG bytes, wave,
  score, lives, and a sorted object list with a hash.
- **Against the arcade:** for behaviour the ROM defines exactly (PRNG, spawn
  positions, step cadences, timers, scoring), the C trace must match the MAME
  capture for the same inputs; the first divergent frame and object are
  reported. Comparisons are per behaviour rather than whole-frame, because
  the arcade's object lists and the port's are laid out differently.
- **Regression goldens:** the C port's own traces for a fixed corpus are
  committed and must stay byte-identical unless a change is meant to alter
  behaviour.
- Corpus: wave 1-10 scripted runs, a wave 40 wrap-around, death on every enemy
  type, human rescue/prog conversion, brain cruise missiles, 2-player
  alternation, extra life, game over → initials entry, every difficulty
  setting, 30 min of attract/demo loop.

### 3.3 Rendering goldens
- The C build writes its framebuffer to PNG at chosen frames (`gfx/` is pure C).
- References are MAME snapshots of the arcade (292x240, the same resolution)
  at the same frames: title, attract pages, heroes screen and wipe, wave
  1/5/10 start, each electrode palette, death beat, HUD in 1P/2P, operator
  menu. Pixel-exact where the arcade is deterministic; colour-cycling frames
  are compared at fixed frame numbers. The story pages written for the web
  build have no arcade equivalent and are checked by eye.

### 3.4 Audio
- Automated: the C sim logs sound commands (frame, id, priority, pre-empted)
  and compares them with the MAME capture of writes to the sound PIA.
- Manual: listen-through checklist per sound, latency check (shot press →
  sound < 50 ms, measured with a phone camera at 240 fps on one device),
  and no crackle at 512 samples on RK3326.

### 3.5 Performance and stability (on device)
| Test | Target |
|---|---|
| Frame time on worst device (RK3326 R36S / RG351, H700 RG35XX) with wave 7+ (max brains/progs), 2 min, logged | p99 sim+render < 6 ms, 0 missed vsyncs |
| Startup from SD card | < 2 s to title |
| 2 h attract soak + 1 h play | RSS flat (±1 MB), no audio drift or desync |
| ASan/UBSan + Valgrind (x86_64 CI) over the trace corpus | clean |
| Fuzz: random input streams for 1M frames (libFuzzer or loop) | no crash, no invariant violation (entity counts, bounds) |

### 3.6 Device and OS matrix (manual, per release)
| Device | SoC / arch | Screen | CFW |
|---|---|---|---|
| R36S or RG351V | RK3326 aarch64 | 640x480 | ArkOS / dArkOS |
| RG353V/M | RK3566 aarch64 | 640x480 | ROCKNIX |
| RG35XX H or Plus | H700 aarch64 | 640x480 | muOS, Knulli |
| RG CubeXX (or other 1:1 screen) | H700 aarch64 | 720x720 | muOS / Knulli |
| Steam Deck | x86_64 | 1280x800 | SteamOS game mode (gamescope) |
| x86_64 desktop | x86_64 | any | X11 and Wayland |

Per-device checklist: installs via PortMaster (or tarball), launches to title,
correct scale and no tearing, all controls including the no-right-stick
scheme, coin/start/2P, operator menu opens/saves, quit combo returns to the
frontend, high scores and settings persist across reboot, sleep/resume does not
desync audio, volume keys work, and battery draw is noted (should be below the
emulator running the same game).

### 3.7 CI
GitHub Actions matrix {x86_64, aarch64 (native arm runner)}: build → unit →
golden traces → render goldens → sanitizer run → glibc-floor check → package
artifacts (PortMaster zip, tarball). CI has no ROMs, so the `mame` label
runs locally (`ctest -L mame`) and its fixtures are committed.

## 4. Phases

| Phase | Work | Exit criterion |
|---|---|---|
| P0 | MAME reference pipeline: ROM set check, CTest integration, PRNG probe (done); per-frame state and input-driven probes | `ctest -L mame` passes; state captures reproducible across runs |
| P1 | C skeleton: CMake, SDL video/input/audio/storage, fb blitter, atlas + fonts embed, PRNG + generated tables | Title screen on desktop and one handheld; 3.1 PRNG/table tests pass |
| P2a | Sim port, wave 1 complete: player, shots, grunts, electrodes, family, collisions, scoring, HUD, wave start/clear transitions, death beat and re-lay, game over (done 2026-10-17; no sound or initials entry yet) | `world_flow` and `play_golden` CTest pass |
| P2b | Hulks, spheroids, enforcers and sparks (waves 2-4 complete) (done 2026-10-18) | Waves 1-4 play with every enemy the ROM table spawns; `world_flow` covers them |
| P3 | Remaining enemies (hulks, brains/progs/cruise missiles, spheroids/enforcers/sparks, quarks/tanks/shells), all 40 waves, pacing, mercy | Full trace corpus identical |
| P4 | Presentation: HUD, 2P, death beat, wave transition, attract story, heroes + wipe, initials entry, operator menu, sound priorities | Render goldens + audio event logs match |
| P5 | Handheld polish: control schemes, scaling options, quit/operator combos, persistence paths, both packages, graphics/table extractor (`--extract`) | Device matrix checklist passes on ≥ 3 aarch64 devices + Steam Deck; extractor output matches full-release `assets/` |
| P5b | Sound extraction: 6808 + DAC sound-board emulator renders the WAVs from the user's sound ROM | Rendered WAVs match the shipped ones (sample-exact, or within a tolerance for the MAME-captured ones) |
| P6 | Release: CI artifacts, docs, PortMaster submission and GitHub release `v4.0-native` | Published |

Rough size: P0 is several days, P1 one week, P2-P3 two to four weeks, P4 one
to two weeks, and P5-P6 one week plus device testing.
