/*
 * Draws the gameplay world (sim/world.h) in the web build's container order:
 * electrodes, humans, enemies, shots, player, effects, border, HUD, then the
 * wave-clear rings and the game-over text.
 */
#ifndef ROBOTRON_PLAY_H
#define ROBOTRON_PLAY_H

#include "gfx/fb.h"
#include "gfx/palette.h"
#include "sim/world.h"

void play_draw(Framebuffer *fb, const World *w, CycleA *cycle, unsigned long clock);

#endif
