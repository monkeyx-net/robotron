#!/bin/bash
# PortMaster launcher for the native Robotron: 2084 (SDL2).

XDG_DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}

if [ -d "/opt/system/Tools/PortMaster/" ]; then
  controlfolder="/opt/system/Tools/PortMaster"
elif [ -d "/opt/tools/PortMaster/" ]; then
  controlfolder="/opt/tools/PortMaster"
elif [ -d "$XDG_DATA_HOME/PortMaster/" ]; then
  controlfolder="$XDG_DATA_HOME/PortMaster"
else
  controlfolder="/roms/ports/PortMaster"
fi

source $controlfolder/control.txt

[ -f "${controlfolder}/mod_${CFW_NAME}.txt" ] && source "${controlfolder}/mod_${CFW_NAME}.txt"
get_controls

GAMEDIR=/$directory/ports/robotron

> "$GAMEDIR/log.txt" && exec > >(tee "$GAMEDIR/log.txt") 2>&1

cd $GAMEDIR

# scores and operator settings live with the port
mkdir -p "$GAMEDIR/conf"
export ROBOTRON_SAVE_DIR="$GAMEDIR/conf"
export ROBOTRON_ASSETS="$GAMEDIR/assets"

# first run: build the game's data tables from the player's own ROM set
if [ ! -f "$GAMEDIR/assets/data/waves.txt" ]; then
  for rom in "$GAMEDIR/robotron.zip" "$GAMEDIR/robotron"; do
    if [ -e "$rom" ]; then
      ./robotron.${DEVICE_ARCH} --extract "$rom" "$GAMEDIR/assets" && break
    fi
  done
fi

# gptokeyb only provides the exit hotkey; the game reads the pad itself
$GPTOKEYB "robotron.${DEVICE_ARCH}" &

SDL_GAMECONTROLLERCONFIG="$sdl_controllerconfig" ./robotron.${DEVICE_ARCH}

pm_finish
