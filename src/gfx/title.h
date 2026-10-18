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

/* The playfield border's outer box, measured in MAME (wave 1 and attract):
 * columns 6-283, rows 15-229, so a clear row stays above the WAVE line at
 * y 231. The web build's box (3 px outside GameConfig.PLAYFIELD) ran from
 * 4-287 x 14-231 and drew over the WAVE line. */
#define BORDER_X0 6
#define BORDER_Y0 15
#define BORDER_X1 284 /* exclusive */
#define BORDER_Y1 230 /* exclusive */

/* The 2 px playfield border (js/core/ArcadeBorder.ts), colour 0xRRGGBB. */
void playfield_border(Framebuffer *fb, uint32_t rgb);

/* `frame` counts title-screen updates from 1; `high_score` as shown. */
void title_draw(Framebuffer *fb, const Assets *a, unsigned frame, unsigned high_score);

#endif
