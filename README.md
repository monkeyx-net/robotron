# Robotron: 2084 — native SDL2 port

A C11 / SDL2 rebuild of the 1982 Williams arcade game for Linux handhelds
(aarch64: ArkOS, ROCKNIX, muOS, Knulli via PortMaster) and x86_64 (Steam Deck,
desktops). It is a port of the [robotron.hatch.org](https://robotron.hatch.org/)
web remake, whose waves, enemy pacing, spawn positions and PRNG were traced in
the arcade ROM and checked against MAME.

The web version (TypeScript, PixiJS) lives on the `main` branch (last web
commit `627ca56`). This branch holds only the native port; its plan, decisions and test
plan are in [SDL2_PORT_PLAN.md](SDL2_PORT_PLAN.md).

## Build

Needs CMake 3.13+, a C11 compiler and SDL2 development files (2.0.10 or newer).

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
| Move | left stick / D-pad | W A S D |
| Fire | right stick, or A/B/X/Y (two together for diagonals) | arrow keys |
| 1-player start | Start | Enter |
| 2-player start | L1 + Start | 2 |
| Coin | Select | Space |
| Operator menu (attract screens) | Select + R1 | F2 |
| Quit | hold Select + Start for 1 s | Esc |

Scores and operator settings are saved to `$ROBOTRON_SAVE_DIR`, else
`$XDG_DATA_HOME/robotron`, else `~/.local/share/robotron`.

## Packages

```bash
cmake -S . -B build -DROBOTRON_DEV_ASSETS=OFF && cmake --build build -j
cmake --build build --target package_linux package_portmaster
```

Writes `build/packages/robotron-<version>-linux-<arch>.tar.gz` and a PortMaster
layout `robotron-<version>-portmaster-<arch>.zip`. Release builds use Ubuntu
20.04 (glibc 2.31) for PortMaster compatibility.

## Tests

`ctest` runs the C tests: the ROM PRNG against 1000 outputs captured in MAME,
asset loading, heroes tables and saves, and (with the ROM set) extraction,
gameplay flow through all 40 waves and screenshot hashes of scripted runs.
With MAME installed, `ctest -L mame` re-captures the PRNG fixture from the
arcade itself.

## License

Apache 2.0 for the source code ([LICENSE](LICENSE)). The sprites, sounds and
ROM-derived data are not covered; see [NOTICE](NOTICE).
