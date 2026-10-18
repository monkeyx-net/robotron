#include "gfx/story.h"

#include <string.h>

#include "gfx/blit.h"
#include "gfx/font.h"

#define YELLOW 0xFFFF44u
#define RED 0xFF4444u
#define GREEN 0x44FF44u
#define CYAN 0x44FFFFu
#define MAGENTA 0xFF44FFu
#define ORANGE 0xFF8800u
#define CYCLING 0xFFFFFFFFu /* paragraph drawn in palette entry A */

#define FRAMES_PER_CHAR 2
#define HOLD_FRAMES 240
#define HEADER_Y 28
#define TEXT_X 34
#define TEXT_Y 50
#define LINE_H 9
#define PARA_GAP 9
#define TRACKING 0

typedef struct {
    uint32_t tint;
    const char *lines[4];
} Paragraph;

typedef struct {
    uint32_t border, header;
    Paragraph paras[4];
} Page;

static const Page pages[STORY_PAGES] = {
    { RED, CYAN, {
        { YELLOW, { "IN 1982 THE ARCADE GLOWED.", "TWO JOYSTICKS. ONE HUMAN.", "AN ENDLESS HORDE OF ROBOTRONS." } },
        { RED, { "DECADES LATER ONLY A MEMORY REMAINED:", "THE WAVES, THE SOUNDS, THE PANIC." } },
    } },
    { CYAN, MAGENTA, {
        { GREEN, { "THE MEMORY LED BACK TO THE BINARY:", "48 KILOBYTES OF 6809 CODE AND PIXELS.", "NO SOURCE. NO MANUAL. ONLY BYTES." } },
        { ORANGE, { "BYTE BY BYTE IT WAS READ BACK:", "DISASSEMBLED, LABELED, AND PROBED", "FRAME BY FRAME INSIDE MAME." } },
    } },
    { GREEN, YELLOW, {
        { YELLOW, { "THE GRUNTS, THE BRAINS, THE HULKS,", "EVEN THE RANDOM NUMBER GENERATOR", "GAVE UP THEIR SECRETS." } },
        { CYAN, { "ALL 40 WAVES. EVERY TIMER.", "1000 OF 1000 RANDOM NUMBERS MATCHED." } },
    } },
    { MAGENTA, CYAN, {
        /* the web build's page 4 says FOR THE WEB; this port tells its own step */
        { GREEN, { "THEN THE GAME WAS BORN AGAIN,", "FIRST FOR THE WEB, THEN IN C", "FOR HANDHELDS, CHECKED FRAME BY FRAME",
                   "AGAINST THE ORIGINAL MACHINE." } },
        { RED, { "IN 2084 MAN BUILT MACHINES", "THAT TURNED AGAINST HIM." } },
        { YELLOW, { "IN 2026 A HUMAN WHO REMEMBERED", "AND AN AI THAT COULD READ THE BYTES", "WORKED TOGETHER TO SAVE THE GAME." } },
    } },
    { YELLOW, MAGENTA, {
        { CYAN, { "OVER 40 YEARS LATER", "THE MISSION IS UNCHANGED:" } },
        { CYCLING, { "SAVE THE LAST HUMAN FAMILY!" } },
    } },
};

static unsigned page_chars(const Page *p)
{
    unsigned n = 0;
    for (int i = 0; i < 4 && p->paras[i].tint; i++)
        for (int j = 0; j < 4 && p->paras[i].lines[j]; j++) n += (unsigned)strlen(p->paras[i].lines[j]);
    return n;
}

void story_start(Story *s)
{
    s->page = 0;
    s->frames = 0;
}

int story_step(Story *s)
{
    s->frames++;
    if (s->frames >= page_chars(&pages[s->page]) * FRAMES_PER_CHAR + HOLD_FRAMES) {
        s->frames = 0;
        if (++s->page >= STORY_PAGES) {
            s->page = STORY_PAGES - 1;
            return 1;
        }
    }
    return 0;
}

void story_draw(Framebuffer *fb, const Assets *a, const Story *s, CycleA *cycle, unsigned long clock)
{
    const Page *p = &pages[s->page];
    /* PixiJS stroke width 2, alignment 1 (inside) of rect (LEFT-1, TOP-2, RIGHT-LEFT+2, BOTTOM-TOP+4) */
    const double x = 6, y = 15, w = 280, h = 216;
    fill_rectf(fb, x, y, w, 2, p->border);
    fill_rectf(fb, x, y + h - 2, w, 2, p->border);
    fill_rectf(fb, x, y, 2, h, p->border);
    fill_rectf(fb, x + w - 2, y, 2, h, p->border);

    const char *header = "ROBOTRON: 2084";
    font_draw_t(fb, a, FONT_MAIN, header, (FB_WIDTH - font_measure_t(a, FONT_MAIN, header, TRACKING)) / 2.0,
                HEADER_Y, 1, TRACKING, p->header);

    unsigned total = page_chars(p);
    unsigned left = s->frames / FRAMES_PER_CHAR;
    if (left > total) left = total;
    uint32_t a_color = cycle_a_color(cycle, clock);
    int ly = TEXT_Y;
    for (int i = 0; i < 4 && p->paras[i].tint; i++) {
        uint32_t tint = p->paras[i].tint == CYCLING ? a_color : p->paras[i].tint;
        for (int j = 0; j < 4 && p->paras[i].lines[j]; j++) {
            const char *line = p->paras[i].lines[j];
            size_t len = strlen(line), n = left < len ? left : len;
            char buf[64];
            memcpy(buf, line, n);
            buf[n] = '\0';
            left -= (unsigned)n;
            font_draw_t(fb, a, FONT_MAIN, buf, TEXT_X, ly, 1, TRACKING, tint);
            ly += LINE_H;
        }
        ly += PARA_GAP;
    }
}
