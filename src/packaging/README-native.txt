Robotron: 2084 (native SDL2 build)
==================================

Run ./robotron, or robotron.exe on Windows (add --windowed for a window on a
desktop).

Controls
  Move: left stick / D-pad, keyboard WASD
  Fire: right stick, or A/B/X/Y (two together for diagonals), keyboard arrows
  1-player start: Start / Enter;  2-player start: L1+Start / key 2
  Coin: Select / Space
  Operator menu (attract screens): Select+R1 / F2
  Quit: hold Select+Start for 1 second / Esc
  Graphics: Select+L1 / F3 steps the presets, F4 glow, F5 CRT scanlines
  Screen: Select+R2 / F7 steps the scale mode, Select+L2 / F8 the aspect

Screen (--scale <mode>, --aspect 4:3|square)
  auto     whole-number scaling if it fills at least 95% of the screen, else fit
  integer  a whole number of screen rows per arcade row
  fit      as large as fits (sizes between whole numbers stay sharp)
  stretch  the whole screen, whatever its shape
  4:3 is the shape of the arcade's monitor (the default); square keeps square
  pixels. The last choice is saved.

Graphics presets
  classic      the arcade picture, pixel for pixel (default)
  classic-crt  the same with scanlines
  crisp        the picture upscaled whole, hard pixels (Scale2x/3x)
  smooth       the picture upscaled whole, smoothed edges (xBR)
  hd-crisp     drawn at screen resolution: upscaled sprites, smooth effects
  hd-smooth    the same with xBR sprites
  hd-glow      hd-smooth with a neon glow
  hd-glow-crt  hd-glow with scanlines
  Pick one at start with --gfx <preset>; the last choice is saved. Gameplay
  is identical in every preset. On slower handhelds hd-crisp / hd-smooth
  cost the least.

Game data
  The game's data tables (waves, timers, electrodes) come from the arcade ROM.
  If assets/data is missing, build it from your MAME ROM set:
      ./robotron --extract /path/to/robotron.zip

Saved scores and settings go to $ROBOTRON_SAVE_DIR, else
$XDG_DATA_HOME/robotron, else (Windows) %APPDATA%\robotron, else
~/.local/share/robotron.

See NOTICE for the third-party material (sprites, sounds, data tables)
this package contains.
