# Robotron: 2084 — native SDL2 port — Changelog

---
## Changelog

### v0.1.1 (2026-10-21)

#### Game

- **Wave 1 playable** — the web build's game logic ported to C: player, shots,
  grunts, electrodes, family, collisions, scoring, extra men, wave start/clear,
  beam-in, death beat and re-lay, game over, stepped at 60 Hz with gameplay
  randomness from the ROM PRNG.
- **All 40 waves' enemies** — hulks (ROM walk tables, trampling), spheroids and
  enforcers (drops and aim easing from the `$BE60` timers), sparks, brains
  (human conversion and cruise missiles), progs, quarks, tanks and bouncing
  shells, exactly as traced in the arcade ROM.
- **Sound effects** — SDL mixer modelled on the web build's SoundManager:
  overlapping voices, every sound from the ROM priority table, WAVs converted
  to 48 kHz stereo, silent in headless runs.
- **Saved scores and initials entry** — the arcade's heroes tables with the
  87-frame rectangle wipe, letters entry, saves in `$XDG_DATA_HOME/robotron`
  (IndexedDB in the browser), unlike-era factory tables from the ROM.
- **Operator menu and 2 players** — the GAME ADJUSTMENT page (extra men, turns,
  difficulty, letters, factory reset, score-table reset), saved with the
  scores; 2-player alternation with hand-over, `PLAYER N` interstitial and a
  two-sided HUD.
- **Attract cycle with demo play** — title → story → heroes → demo → title,
  the demo man shooting at the nearest destructible enemy; START during the
  demo begins a game.
- **Fidelity fixes** — playfield border and wave-clear rings measured in MAME
  (the web build's box covered the WAVE line); the main font's blank `:`
  drawn as a built-in pattern; story page 4 now tells the port's step.

#### Data & ROM

- **ROM table extractor** — `robotron --extract` reads the user's own ROM set
  (MAME or 1996 file names, CRC-checked) and writes `assets/data/*.txt`
  (waves, timers, mercy, electrode looks, heroes); nothing ROM-derived is
  compiled in.
- **Zip support** — `--extract` takes a folder or `robotron.zip` (dependency-free
  deflate decoder, CRC-32 checked), and extraction is checked against SHA-256
  hashes recorded against the web build's tables.
- **Asset loading** — dependency-free PNG and JSON readers and loaders for the
  sprite atlas and ROM fonts from `$ROBOTRON_ASSETS`, `<exe dir>/assets` or the
  source tree in development builds.

#### Build & Platforms

- **Linux, Windows and web builds** — CMake builds natively for Linux
  (x86_64/aarch64 handhelds), Windows (MinGW-w64, saves in `%APPDATA%\robotron`)
  and the web (Emscripten, `serve` target, saves in IndexedDB).
- **macOS build & package** — new `package_macos` target produces an arm64
  tarball (`robotron-<version>-macos-<arch>.tar.gz`) beside the Linux and
  PortMaster packages.
- **Release packages** — `package_linux` (tarball), `package_portmaster`
  (launcher, port.json, screenshot rendered by the game itself),
  `package_windows` (zip) and `package_macos` (tarball) bundle the binary with
  sprites, sounds, extracted tables, `README-native.txt`, `LICENSE` and
  `NOTICE`.
- **CI workflow** — `.github/workflows/build.yml` builds Linux, Windows, macOS
  and web on every push to `sdl2-port`, runs the tests, and publishes a GitHub
  release `vx.y.z` when the top `CHANGELOG.md` version (checked against
  `CMakeLists.txt`) is new.

#### Tests

- **The port's own goldens** — the ROM PRNG against 1000 outputs captured in
  MAME, asset loading, heroes tables and saves, extraction (folder and zip)
  against recorded hashes, gameplay flow through all 40 waves including the
  2-player hand-over, and screenshot hashes of scripted headless runs.
- **MAME reference tests** — with MAME installed, `ctest -L mame` re-captures
  the PRNG fixture straight from the arcade.

#### Documentation

- **README** — every key and pad button, CMake build options (Linux, Windows,
  web, packages, sanitizers), tests and the CI process.
- **CLAUDE.md and SDL2_PORT_PLAN.md** — the port's ground rules, commands,
  `src/` layout and the plan it follows.
