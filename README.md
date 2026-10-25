# Robotron: 2084 — native SDL2 port

A C11 / SDL2 rebuild of the 1982 Williams arcade game for Linux handhelds
(aarch64: ArkOS, ROCKNIX, muOS, Knulli via PortMaster), x86_64 (Steam Deck,
desktops), Linux desktops, Windows, macOS and the web. It is a port of the
[robotron.hatch.org](https://robotron.hatch.org/) web remake, whose waves,
enemy pacing, spawn positions and PRNG were traced in the arcade ROM and
checked against MAME.

The web version (TypeScript, PixiJS) lives on the `main` branch (last web
commit `627ca56`). This branch holds only the native port; its plan, decisions and test
plan are in [SDL2_PORT_PLAN.md](SDL2_PORT_PLAN.md).

```bash
cmake -S . -B build && cmake --build build -j
ctest --test-dir build
build/robotron --windowed
```

### Game data from your ROM set

The game's data tables (waves, timers, electrodes, the factory heroes list)
come from the arcade ROM; the source tree contains none. Put your MAME
`robotron` (Solid Blue) set in `robotron/` (git-ignored, as a folder or
`robotron.zip`) and the build extracts them into `build/assets/data`, or run:

```bash
build/robotron --extract /path/to/robotron.zip
```

Without them the attract screens run, but a game can't start.

## Controls

| Action | Pad | Keyboard |
|---|---|---|
| Move | left stick or D-pad | W A S D |
| Fire | right stick, or Y up, A down, X left, B right (two together for diagonals) | arrow keys |
| Coin | Select | 5 or Space |
| 1-player start | Start | 1 or Enter |
| 2-player start | L1 + Start | 2 |
| Operator menu (attract screens) | Select + R1 | F2 |
| Next graphics preset | Select + L1 | F3 |
| Glow on / off | | F4 |
| CRT scanlines on / off | | F5 |
| Screen scale: auto, integer, fit, stretch | Select + R2 | F7 |
| Screen aspect: 4:3 (the arcade monitor) or square pixels | Select + L2 | F8 |
| Quit | hold Select + Start for 1 s | Esc |

The players take turns; every connected pad drives the controls. Pads use
SDL's game controller database; set `ROBOTRON_GAMECONTROLLERDB` to a
`gamecontrollerdb.txt` to add mappings.

## Running

```bash
build/robotron [--windowed] [--gfx preset] [--scale mode] [--aspect 4:3|square]
               [--frames N] [--screenshot out.png] [--input script.txt]
build/robotron --extract <rom dir or zip> [<asset dir>]
```

- `--gfx`: `classic` (default), `classic-crt`, `crisp`, `smooth`, `hd-crisp`,
  `hd-smooth`, `hd-glow`, `hd-glow-crt`.
- `--scale`: `auto` (default: `integer` if it fills 95% of the screen, else
  `fit`), `integer`, `fit` (sizes between whole numbers stay sharp),
  `stretch`. `--aspect`: `4:3` (default, the arcade monitor's shape) or
  `square` pixels. The preset, scale and aspect are saved with the scores;
  the command line overrides them.
- `--input`, `--frames`, `--screenshot`: scripted, headless runs
  (`SDL_VIDEODRIVER=dummy`); see `src/main.c`.

Assets (sprites, sounds, the extracted tables) are found in `$ROBOTRON_ASSETS`,
else `assets/` next to the program (development builds also use the source
tree). Scores, operator settings and the graphics settings are saved to
`$ROBOTRON_SAVE_DIR`, else `$XDG_DATA_HOME/robotron`, `%APPDATA%\robotron` on
Windows, or `~/.local/share/robotron`; in the browser, to IndexedDB.

## Building

Needs CMake 3.13+, a C11 compiler and the SDL2 development files (2.0.10 or
newer; releases build against 2.0.10 in Ubuntu 20.04).

### Linux desktops and the Steam Deck

```bash
sudo apt install build-essential cmake pkg-config libsdl2-dev   # Debian / Ubuntu
cmake -S . -B build && cmake --build build -j
ctest --test-dir build
```

The build folder is a runnable layout: `build/assets` links the repo's
sprites and sounds and holds the extracted tables. On aarch64 handhelds build
natively on the device or in an aarch64 Ubuntu 20.04 container (as CI does)
so the binary runs on their older glibc.

### CMake options

| Option | Default | Effect |
|---|---|---|
| `CMAKE_BUILD_TYPE` | `Release` | the usual CMake build types |
| `ROBOTRON_DEV_ASSETS` | `ON` | development builds fall back to the source tree's `sprites/`; set `OFF` for releases |
| `ROBOTRON_SANITIZE` | `OFF` | build with ASan and UBSan |
| `ROBOTRON_ROM_DIR` | `robotron/` | your ROM set (MAME or 1996 file names): when present, every build extracts the tables and the `rom` tests run |
| `ROBOTRON_WEB_DATA` | `build/assets/data` if it exists | web only: the extracted tables to bundle; empty = attract screens only |
| `ROBOTRON_WEB_PORT` | `8000` | web only: port of the `serve` target |

```bash
cmake -S . -B build-san -DROBOTRON_SANITIZE=ON && cmake --build build-san -j   # sanitizers
```

### Windows (MinGW-w64 in MSYS2)

From the MSYS2 MINGW64 shell:

```bash
pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-cmake mingw-w64-x86_64-ninja \
          mingw-w64-x86_64-pkgconf mingw-w64-x86_64-SDL2
cmake -S . -B build -G Ninja -DROBOTRON_DEV_ASSETS=OFF
cmake --build build --target robotron
cp /mingw64/bin/SDL2.dll build/          # the package takes every DLL next to the exe
cmake --build build --target package_windows
```

The tests use POSIX calls, so on Windows only the game is built. Windows
copies `sprites/` and `sounds/` into `build/assets` instead of linking them.

### Web (Emscripten)

Extract the tables with a native build first (above), then, with the
[Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
active:

```bash
emcmake cmake -S . -B build-web
cmake --build build-web --target serve    # builds, then serves http://localhost:8000/
```

The page is `build-web/web/index.{html,js,wasm,data}`; sprites, sounds and
(with `ROBOTRON_WEB_DATA`) the ROM tables go in `index.data`. Without the
tables the page plays the attract screens only. A page bundling the tables
holds ROM-derived data: keep it for local use.

### Release packages

```bash
cmake -S . -B build -DROBOTRON_DEV_ASSETS=OFF && cmake --build build -j
cmake --build build --target package_linux package_portmaster
# macOS (on a Mac): cmake --build build --target package_macos
```

Writes `build/packages/robotron-<version>-linux-<arch>.tar.gz` and a
PortMaster layout `robotron-<version>-portmaster-<arch>.zip` (the launcher
`Robotron 2084.sh` and a `robotron/` folder); on macOS the `package_macos`
target writes `robotron-<version>-macos-<arch>.tar.gz`. Packages hold the program,
sprites, sounds, `README-native.txt`, `LICENSE` and `NOTICE`; the extracted
tables only if the build had them (otherwise players run `--extract`).

## Tests

```bash
ctest --test-dir build              # everything available
ctest --test-dir build -L rom       # needs the ROM set in robotron/
ctest --test-dir build -L mame      # needs MAME and the ROM set
```

`ctest` runs the C tests: the ROM PRNG against 1000 outputs captured in MAME,
asset loading, heroes tables and saves, and (with the ROM set) extraction,
gameplay flow through all 40 waves and screenshot hashes of scripted runs.
With MAME installed, `ctest -L mame` re-captures the PRNG fixture from the
arcade itself.

## Continuous integration

`.github/workflows/build.yml` runs on pushes and pull requests to the
`sdl2-port` branch, and by hand (Actions > Build > Run workflow):

1. **Version:** reads the top `### vx.y.z` entry from `CHANGELOG.md` (it must
   match `project(robotron VERSION x.y.z)` in `CMakeLists.txt`, or the run
   fails). On a push, if the release `vx.y.z` already exists, the builds are
   skipped; to publish one, bump the version in both and push.
2. **Linux x86_64 and aarch64:** in an Ubuntu 20.04 container (GCC 9,
   SDL 2.0.10, glibc 2.31 for PortMaster) on GitHub's x86_64 and arm64
   runners, with ccache: build with `ROBOTRON_DEV_ASSETS=OFF`, run `ctest`
   (CI has no ROM set, so the always-run tests: `prng_golden`, `assets`,
   `hiscore`, `enhance`), make the Linux and PortMaster archives.
3. **Windows x86_64:** MSYS2 MinGW64 with Ninja; builds the game, copies the
   MinGW DLLs it links (SDL2.dll) next to it and makes the Windows zip.
4. **macOS arm64:** Homebrew SDL2 (and ccache); builds with
   `ROBOTRON_DEV_ASSETS=OFF`, runs `ctest` and makes the macOS tarball.
5. **Web:** Emscripten; zips `build-web/web` as `robotron-<version>-web.zip`
   (no ROM tables in CI: the page plays the attract screens only).
6. **Release:** on a push whose version has no release yet, downloads every
   build's archives and publishes GitHub release `vx.y.z` with generated
   notes.

Every job uploads its archives as workflow artifacts. CI has no ROM set, so
release packages carry no ROM tables; players run `--extract` with their own
set. To publish a release, bump the top `###` version in `CHANGELOG.md` and
the matching `project(robotron VERSION ...)` in `CMakeLists.txt`, then push.

## License

Apache 2.0 for the source code ([LICENSE](LICENSE)). The sprites, sounds and
ROM-derived data are not covered; see [NOTICE](NOTICE).
