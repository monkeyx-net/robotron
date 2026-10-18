#include "game/entry.h"

#include <stdio.h>
#include <string.h>

#include "gfx/blit.h"
#include "gfx/font.h"
#include "gfx/title.h"

static const char LETTERS[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ. ";
#define NLETTERS 28
#define REPEAT_DELAY_FRAMES 24 /* 400 ms */
#define REPEAT_RATE_FRAMES 7   /* ~120 ms */

void entry_start(Entry *e, unsigned score, int letters, EntryInput held)
{
    memset(e, 0, sizeof *e);
    e->score = score;
    e->letters = letters < 1 ? 1 : letters > ENTRY_MAX_LETTERS ? ENTRY_MAX_LETTERS : letters;
    e->prev = held;
}

static void cycle(Entry *e, int step)
{
    e->initials[e->slot] = (e->initials[e->slot] + step + NLETTERS) % NLETTERS;
}

static void confirm(Entry *e)
{
    if (++e->slot < e->letters) return;
    int n = 0;
    for (int i = 0; i < e->letters; i++) e->result[n++] = LETTERS[e->initials[i]];
    while (n > 0 && e->result[n - 1] == ' ') n--;
    e->result[n] = '\0';
    e->done = 1;
}

void entry_step(Entry *e, EntryInput in)
{
    if (e->done) return;
    if (in.confirm && !e->prev.confirm) {
        confirm(e);
        if (e->done) return;
    }
    int dir = in.up ? 1 : in.down ? -1 : 0;
    int prev_dir = e->prev.up ? 1 : e->prev.down ? -1 : 0;
    if (dir != 0 && dir != prev_dir) {
        cycle(e, dir);
        e->held_frames = e->since_repeat = 0;
    } else if (dir != 0) {
        e->held_frames++;
        e->since_repeat++;
        if (e->held_frames >= REPEAT_DELAY_FRAMES && e->since_repeat >= REPEAT_RATE_FRAMES) {
            cycle(e, dir);
            e->since_repeat = 0;
        }
    }
    e->prev = in;
}

static void line(Framebuffer *fb, const Assets *a, const char *text, int y, uint32_t tint, FontId font)
{
    font_draw(fb, a, font, text, FB_WIDTH / 2.0 - font_measure(a, font, text) / 2.0, y, 1, tint);
}

void entry_draw(Framebuffer *fb, const Assets *a, const Entry *e, uint32_t border)
{
    char buf[32];
    fb_clear(fb, 0xFF000000u);
    playfield_border(fb, border);
    line(fb, a, "GREAT SCORE", 50, 0xFF4444, FONT_ALT);
    snprintf(buf, sizeof buf, "%u", e->score);
    line(fb, a, buf, 70, 0xFFFF44, FONT_ALT);
    line(fb, a, e->letters > 3 ? "ENTER YOUR NAME" : "ENTER YOUR INITIALS", 95, 0x44FFFF, FONT_MAIN);

    /* fixed slots, so narrow letters never shift the others or the cursor */
    int slot_w = e->letters > 16 ? 12 : 14;
    double slots_x = FB_WIDTH / 2.0 - (slot_w * e->letters - 6) / 2.0;
    for (int i = 0; i < e->letters; i++) {
        char ch[2] = { LETTERS[e->initials[i]], 0 };
        font_draw(fb, a, FONT_ALT, ch, slots_x + i * slot_w + (8 - font_measure(a, FONT_ALT, ch)) / 2.0, 120, 1,
                  0xFFFF44);
    }
    if (!e->done)
        fill_rectf(fb, slots_x + e->slot * slot_w, 120 + font_line_height(a, FONT_ALT) + 3, 8, 1, 0xFF4444);
}
