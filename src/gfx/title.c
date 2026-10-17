#include "gfx/title.h"

#include <stdio.h>

#include "gfx/font.h"

#define FLASH_FRAMES 30          /* GameConfig.INSERT_COIN_FLASH_INTERVAL */

/* Playfield (GameConfig.PLAYFIELD) and the 2 px border 3 px outside it. */
#define PF_LEFT 7
#define PF_TOP 17
#define PF_RIGHT 285
#define PF_BOTTOM 229

void playfield_border(Framebuffer *fb, uint32_t rgb)
{
    const uint32_t c = 0xFF000000u | rgb;
    const int x0 = PF_LEFT - 3, y0 = PF_TOP - 3, x1 = PF_RIGHT + 3, y1 = PF_BOTTOM + 3;
    fb_fill_rect(fb, x0, y0, x1 - x0, 2, c);
    fb_fill_rect(fb, x0, y1 - 2, x1 - x0, 2, c);
    fb_fill_rect(fb, x0, y0, 2, y1 - y0, c);
    fb_fill_rect(fb, x1 - 2, y0, 2, y1 - y0, c);
}

/* A line centred on the screen like the web's addTitleLine. */
static void line(Framebuffer *fb, const Assets *a, const char *text, int y, uint32_t tint, FontId font, int scale)
{
    double x = FB_WIDTH / 2.0 - (double)font_measure(a, font, text) * scale / 2.0;
    font_draw(fb, a, font, text, x, y, scale, tint);
}

void title_draw(Framebuffer *fb, const Assets *a, unsigned frame, unsigned high_score)
{
    char score[32];
    snprintf(score, sizeof score, "HIGH SCORE %u", high_score);
    int blink_on = (frame / FLASH_FRAMES) % 2 == 0;

    fb_clear(fb, 0xFF000000u);
    playfield_border(fb, BORDER_WAVE1);
    line(fb, a, "ROBOTRON: 2084", 56, 0xFFFF44, FONT_ALT, 2);
    line(fb, a, "(C) 1982 WILLIAMS ELECTRONICS INC.", 96, 0xFFFFFF, FONT_MAIN, 1);
    line(fb, a, score, 116, 0x44FFFF, FONT_MAIN, 1);
    if (blink_on) {
        line(fb, a, "INSERT COIN", 176, 0xFFFFFF, FONT_ALT, 1);
        line(fb, a, "PRESS ENTER TO START", 200, 0x44FF44, FONT_MAIN, 1);
    }
}
