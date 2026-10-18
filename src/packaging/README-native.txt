Robotron: 2084 (native SDL2 build)
==================================

Run ./robotron (add --windowed for a window on a desktop).

Controls
  Move: left stick / D-pad, keyboard WASD
  Fire: right stick, or A/B/X/Y (two together for diagonals), keyboard arrows
  1-player start: Start / Enter;  2-player start: L1+Start / key 2
  Coin: Select / Space
  Operator menu (attract screens): Select+R1 / F2
  Quit: hold Select+Start for 1 second / Esc

Game data
  The game's data tables (waves, timers, electrodes) come from the arcade ROM.
  If assets/data is missing, build it from your MAME ROM set:
      ./robotron --extract /path/to/robotron.zip

Saved scores and settings go to $ROBOTRON_SAVE_DIR, else
$XDG_DATA_HOME/robotron, else ~/.local/share/robotron.

See NOTICE for the third-party material (sprites, sounds, data tables)
this package contains.
