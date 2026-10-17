/*
 * Title screen, as the web build draws it (js/ui.ts setupTitleScreen and
 * js/attractMode.ts): headline, credits and high score in the ROM fonts,
 * INSERT COIN / PRESS ENTER TO START blinking every 30 frames, inside the
 * wave-1 playfield border (js/core/ArcadeBorder.ts).
 */
#ifndef ROBOTRON_TITLE_H
#define ROBOTRON_TITLE_H

#include "assets/assets.h"
#include "gfx/fb.h"

#include <stdint.h>

#define BORDER_WAVE1 0xFF5100u /* ArcadeBorder wave 1, sampled from MAME */

/* The 2 px playfield border (js/core/ArcadeBorder.ts), colour 0xRRGGBB. */
void playfield_border(Framebuffer *fb, uint32_t rgb);

/* `frame` counts title-screen updates from 1; `high_score` as shown. */
void title_draw(Framebuffer *fb, const Assets *a, unsigned frame, unsigned high_score);

#endif
