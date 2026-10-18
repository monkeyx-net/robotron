#include "gfx/heroes.h"

#include <stdio.h>
#include <string.h>

#include "gfx/font.h"

static const uint32_t RAMP[21] = {
    0xAE00FF, 0x8926FF, 0x7626FF, 0x5126FF, 0x0000FF, 0x0051FF, 0x0076A0, 0x00FF00,
    0x76D900, 0xFFD900, 0xFFAE00, 0xFF8900, 0xFF7600, 0xFF5100, 0xFF005F, 0xFF005F,
    0xFF00A0, 0xFF00A0, 0xFF00FF, 0xFF00FF, 0xD900FF,
};
#define RAMP_LEN 21
#define RING_FRAMES 3
#define RINGS 57
#define FRAME_RINGS 8
#define RING_W 2
#define FRAME_X0 6
#define FRAME_Y0 6
#define FRAME_X1 284
#define FRAME_Y1 232
#define HEADING_RING 6
#define TABLE_RAMP_START 2

#define RED 0xFF0000u
#define PULSE_CYCLE 56
#define HEROES_PULSE_AT 3
#define ALL_TIME_PULSE_AT 31

/* Per wipe frame (MAME, from the first black frame): ramp step, then lit rings as first..last pairs. */
typedef struct {
    int step, pairs;
    int lit[12];
} WipeFrame;

static const WipeFrame WIPE[HEROES_WIPE_FRAMES] = {
    { 0, 0, { 0 } },
    { 0, 0, { 0 } },
    { 0, 0, { 0 } },
    { 0, 0, { 0 } },
    { 0, 0, { 0 } },
    { 0, 0, { 0 } },
    { 0, 0, { 0 } },
    { 2, 1, { 55, 55 } },
    { 2, 1, { 55, 55 } },
    { 3, 2, { 47, 47, 54, 55 } },
    { 3, 2, { 46, 47, 54, 55 } },
    { 3, 2, { 46, 47, 54, 55 } },
    { 4, 2, { 45, 47, 53, 55 } },
    { 4, 2, { 45, 47, 53, 55 } },
    { 4, 3, { 38, 39, 45, 47, 53, 55 } },
    { 5, 3, { 36, 39, 44, 47, 52, 55 } },
    { 5, 3, { 36, 39, 44, 47, 52, 55 } },
    { 5, 3, { 36, 39, 44, 47, 52, 55 } },
    { 5, 4, { 30, 31, 36, 39, 44, 47, 52, 55 } },
    { 6, 4, { 29, 31, 35, 39, 43, 47, 51, 55 } },
    { 6, 4, { 27, 31, 35, 39, 43, 47, 51, 55 } },
    { 6, 4, { 27, 31, 35, 39, 43, 47, 51, 55 } },
    { 7, 4, { 26, 31, 34, 39, 42, 47, 50, 55 } },
    { 7, 5, { 22, 23, 26, 31, 34, 39, 42, 47, 50, 55 } },
    { 7, 5, { 21, 23, 26, 31, 34, 39, 42, 47, 50, 55 } },
    { 7, 5, { 20, 23, 26, 31, 34, 39, 42, 47, 50, 55 } },
    { 8, 5, { 18, 23, 25, 31, 33, 39, 41, 47, 49, 55 } },
    { 8, 5, { 17, 23, 25, 31, 33, 39, 41, 47, 49, 55 } },
    { 8, 5, { 17, 23, 25, 31, 33, 39, 41, 47, 49, 55 } },
    { 8, 6, { 14, 15, 17, 23, 25, 31, 33, 39, 41, 47, 49, 55 } },
    { 8, 6, { 13, 15, 17, 23, 25, 31, 33, 39, 41, 47, 49, 55 } },
    { 9, 1, { 12, 56 } },
    { 9, 1, { 11, 56 } },
    { 9, 1, { 10, 56 } },
    { 9, 1, { 8, 56 } },
    { 9, 1, { 7, 56 } },
    { 10, 1, { 6, 56 } },
    { 10, 1, { 5, 56 } },
    { 10, 1, { 4, 56 } },
    { 10, 1, { 3, 56 } },
    { 10, 1, { 2, 56 } },
    { 10, 1, { 1, 56 } },
    { 11, 1, { 0, 56 } },
    { 11, 1, { 0, 52 } },
    { 12, 1, { 0, 50 } },
    { 12, 1, { 0, 48 } },
    { 12, 1, { 0, 46 } },
    { 12, 1, { 0, 44 } },
    { 13, 1, { 0, 42 } },
    { 13, 1, { 0, 40 } },
    { 13, 1, { 0, 38 } },
    { 14, 1, { 0, 36 } },
    { 14, 1, { 0, 34 } },
    { 14, 1, { 0, 32 } },
    { 15, 1, { 0, 30 } },
    { 15, 1, { 0, 29 } },
    { 15, 1, { 0, 27 } },
    { 16, 1, { 0, 25 } },
    { 16, 1, { 0, 24 } },
    { 16, 1, { 0, 22 } },
    { 16, 1, { 0, 21 } },
    { 17, 1, { 0, 19 } },
    { 17, 1, { 0, 18 } },
    { 17, 1, { 0, 17 } },
    { 17, 1, { 0, 15 } },
    { 17, 1, { 0, 14 } },
    { 18, 1, { 0, 13 } },
    { 18, 1, { 0, 12 } },
    { 18, 1, { 0, 10 } },
    { 18, 1, { 0, 9 } },
    { 18, 1, { 0, 8 } },
    { 19, 1, { 0, 7 } },
    { 19, 1, { 0, 7 } },
    { 19, 1, { 0, 7 } },
    { 19, 1, { 0, 7 } },
    { 19, 1, { 0, 7 } },
    { 20, 1, { 0, 7 } },
    { 20, 1, { 0, 7 } },
    { 20, 1, { 0, 7 } },
    { 20, 1, { 0, 7 } },
    { 0, 1, { 0, 7 } },
    { 0, 1, { 0, 7 } },
    { 0, 1, { 0, 7 } },
    { 0, 1, { 0, 7 } },
    { 1, 1, { 0, 7 } },
    { 1, 1, { 0, 7 } },
    { 1, 1, { 0, 7 } },
};

/* red -> pink -> white -> pink -> red, one entry per frame */
static uint32_t pulse(unsigned frame, int at)
{
    int p = (((int)frame - at) % PULSE_CYCLE + PULSE_CYCLE) % PULSE_CYCLE;
    if (p < 4) return 0xFF515F;
    if (p < 8) return 0xFF89A0;
    if (p < 16) return 0xFFFFFF;
    if (p < 20) return 0xFF89A0;
    if (p < 24) return 0xFF515F;
    return RED;
}

/* Ring k, lit where (x + y) is even, in colour rgb. */
static void ring(Framebuffer *fb, int k, uint32_t rgb)
{
    const int x0 = FRAME_X0 + k * RING_W, y0 = FRAME_Y0 + k * RING_W;
    const int x1 = FRAME_X1 - k * RING_W, y1 = FRAME_Y1 - k * RING_W;
    const uint32_t c = 0xFF000000u | rgb;
    for (int y = y0; y <= y1; y++) {
        int edge_row = y < y0 + RING_W || y > y1 - RING_W;
        for (int x = x0; x <= x1; x++) {
            if ((x + y) % 2) continue;
            if (edge_row || x < x0 + RING_W || x > x1 - RING_W)
                fb_fill_rect(fb, x, y, 1, 1, c);
        }
    }
}

static uint32_t ring_color(int step, int k)
{
    return RAMP[(step + k % FRAME_RINGS) % RAMP_LEN];
}

#define TALL FONT_ALT
#define SMALL FONT_MAIN

static void text(Framebuffer *fb, const Assets *a, const char *s, int x, int y, FontId f, uint32_t tint)
{
    font_draw_t(fb, a, f, s, x, y, 1, 0, tint);
}

/* Right-aligned so the last lit column is right_x (glyph cells carry a blank column). */
static void right(Framebuffer *fb, const Assets *a, const char *s, int right_x, int y, FontId f, uint32_t tint)
{
    text(fb, a, s, right_x + 2 - font_measure_t(a, f, s, 0), y, f, tint);
}

static void tables(Framebuffer *fb, const Assets *a, const HeroTables *t, unsigned frame, int step)
{
    char buf[32];
    uint32_t heading = RAMP[(step + HEADING_RING) % RAMP_LEN];
    uint32_t h = pulse(frame, HEROES_PULSE_AT), at = pulse(frame, ALL_TIME_PULSE_AT);

    /* headings word by word at MAME's x (the ROM's spaces vary in width) */
    text(fb, a, "ROBOTRON", 100, 30, TALL, heading);
    text(fb, a, "HEROES", 152, 30, TALL, heading);
    text(fb, a, "ALL", 100, 103, TALL, heading);
    text(fb, a, "TIME", 123, 103, TALL, heading);
    text(fb, a, "HEROES", 152, 103, TALL, heading);

    for (int i = 0; i < t->hero_count; i++) {
        int col = (i / 5) * 104, y = 46 + (i % 5) * 9;
        snprintf(buf, sizeof buf, "%d)", i + 1);
        right(fb, a, buf, 60 + col, y, TALL, h);
        text(fb, a, t->heroes[i].initials, 66 + col, y, TALL, h);
        snprintf(buf, sizeof buf, "%u", t->heroes[i].score);
        right(fb, a, buf, 134 + col, y, TALL, h);
    }

    const HeroRow *top = &t->all_time[0];
    right(fb, a, "1)", 44, 115, TALL, at);
    snprintf(buf, sizeof buf, "%u", top->score);
    right(fb, a, buf, 106, 115, TALL, at);
    /* the ROM fits 3 initials before the score; a longer name goes after it */
    text(fb, a, top->initials, strlen(top->initials) <= 4 ? 48 : 112, 115, TALL, at);
    for (int j = 0; j < ALL_TIME_ROWS - 1; j++) {
        const HeroRow *r = &t->all_time[j + 1];
        int col = (j / 12) * 80, y = 129 + (j % 12) * 7;
        snprintf(buf, sizeof buf, "%d)", j + 2);
        right(fb, a, buf, 44 + col, y, SMALL, at);
        text(fb, a, r->initials, 48 + col, y, SMALL, at);
        snprintf(buf, sizeof buf, "%u", r->score);
        right(fb, a, buf, 96 + col, y, SMALL, at);
    }
}

void heroes_draw(Framebuffer *fb, const Assets *a, const HeroTables *t, unsigned frame)
{
    fb_clear(fb, 0xFF000000u);
    if (frame < HEROES_WIPE_FRAMES) {
        const WipeFrame *w = &WIPE[frame];
        for (int k = 0; k < RINGS; k++)
            for (int i = 0; i < w->pairs; i++)
                if (k >= w->lit[2 * i] && k <= w->lit[2 * i + 1]) {
                    ring(fb, k, ring_color(w->step, k));
                    break;
                }
        return;
    }
    unsigned f = frame - HEROES_WIPE_FRAMES;
    int step = TABLE_RAMP_START + (int)(f / RING_FRAMES);
    for (int k = 0; k < FRAME_RINGS; k++) ring(fb, k, ring_color(step, k));
    tables(fb, a, t, f, step);
}
