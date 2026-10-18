#include "game/opmenu.h"

#include <stdio.h>
#include <string.h>

#include "gfx/blit.h"
#include "gfx/font.h"

#define ITEMS 6
#define ROW_TOP 44
#define ROW_H 12
#define CURSOR_X 2
#define LABEL_X 12
#define VALUE_RIGHT 188
#define NOTE_X 193
#define GREEN 0x44FF44u
#define WHITE 0xFFFFFFu
#define YELLOW 0xFFFF44u
#define REPEAT_DELAY_FRAMES 24
#define REPEAT_RATE_FRAMES 7

static const int EXTRA_MAN_CHOICES[5] = { 0, 20000, 25000, 30000, 50000 };
static const char *const LABELS[ITEMS] = {
    "EXTRA MAN EVERY", "TURNS PER PLAYER", "DIFFICULTY OF PLAY", "LETTERS FOR HIGHEST SCORE NAME",
    "RESTORE FACTORY SETTINGS", "HIGH SCORE TABLE RESET",
};

static int clampi(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }

void opmenu_open(OpMenu *m, const OperatorSettings *current, MenuInput held)
{
    memset(m, 0, sizeof *m);
    m->draft = *current;
    m->prev = held;
}

static void value_text(const OpMenu *m, int i, char *buf, size_t n)
{
    const OperatorSettings *s = &m->draft;
    switch (i) {
    case 0: snprintf(buf, n, "%d", s->extra_man_every); break;
    case 1: snprintf(buf, n, "%d", s->turns); break;
    case 2: snprintf(buf, n, "%d", s->difficulty); break;
    case 3: snprintf(buf, n, "%d", s->letters); break;
    case 4: snprintf(buf, n, "%s", m->restore_factory ? "YES" : "NO"); break;
    default: snprintf(buf, n, "%s", m->reset_scores ? "YES" : "NO"); break;
    }
}

static const char *note(const OpMenu *m, int i)
{
    const OperatorSettings *s = &m->draft;
    switch (i) {
    case 0:
        switch (s->extra_man_every) {
        case 0: return "NO EXTRA MEN";
        case 20000: return "LIBERAL";
        case 25000: return "RECOMMENDED";
        case 30000: return "CONSERVATIVE";
        case 50000: return "EXTRA CONSERVATIVE";
        default: return "";
        }
    case 1: return s->turns == 2 ? "HIGH VOLUME ARCADES" : s->turns == 3 ? "RECOMMENDED" : s->turns == 4 ? "FOR WEAKER PLAYERS" : "";
    case 2:
        return s->difficulty <= 2 ? "EXTRA LIBERAL" : s->difficulty <= 4 ? "LIBERAL" : s->difficulty == 5 ? "RECOMMENDED"
             : s->difficulty <= 7 ? "CONSERVATIVE" : "EXTRA CONSERVATIVE";
    case 3: return s->letters == 3 ? "RECOMMENDED" : "";
    default: return "";
    }
}

static void change(OpMenu *m, int dir)
{
    OperatorSettings *s = &m->draft;
    switch (m->sel) {
    case 0: {
        int i = 0;
        while (i < 5 && EXTRA_MAN_CHOICES[i] != s->extra_man_every) i++;
        if (i == 5) i = 2;
        s->extra_man_every = EXTRA_MAN_CHOICES[clampi(i + dir, 0, 4)];
        break;
    }
    case 1: s->turns = clampi(s->turns + dir, 1, 20); break;
    case 2: s->difficulty = clampi(s->difficulty + dir, 0, 10); break;
    case 3: s->letters = clampi(s->letters + dir, 3, 20); break;
    case 4: m->restore_factory = dir > 0; break;
    default: m->reset_scores = dir > 0; break;
    }
}

void opmenu_step(OpMenu *m, MenuInput in)
{
    if (m->done) return;
    if (in.exit && !m->prev.exit) m->exit_armed = 1;
    if (!in.exit && m->prev.exit && m->exit_armed) {
        if (m->restore_factory) m->draft = OPERATOR_FACTORY;
        m->done = 1;
        return;
    }
    int sdir = in.up ? -1 : in.down ? 1 : 0, vdir = in.inc ? 1 : in.dec ? -1 : 0;
    int psdir = m->prev.up ? -1 : m->prev.down ? 1 : 0, pvdir = m->prev.inc ? 1 : m->prev.dec ? -1 : 0;
    if ((sdir && sdir != psdir) || (vdir && vdir != pvdir)) {
        if (sdir && sdir != psdir) m->sel = (m->sel + sdir + ITEMS) % ITEMS;
        if (vdir && vdir != pvdir) change(m, vdir);
        m->held_frames = m->since_repeat = 0;
    } else if (sdir || vdir) {
        m->held_frames++;
        m->since_repeat++;
        if (m->held_frames >= REPEAT_DELAY_FRAMES && m->since_repeat >= REPEAT_RATE_FRAMES) {
            if (sdir) m->sel = (m->sel + sdir + ITEMS) % ITEMS;
            if (vdir) change(m, vdir);
            m->since_repeat = 0;
        }
    }
    m->prev = in;
}

static void centered(Framebuffer *fb, const Assets *a, const char *t, int y, uint32_t tint)
{
    font_draw(fb, a, FONT_MAIN, t, FB_WIDTH / 2.0 - font_measure(a, FONT_MAIN, t) / 2.0, y, 1, tint);
}

void opmenu_draw(Framebuffer *fb, const Assets *a, const OpMenu *m)
{
    char buf[32];
    fb_clear(fb, 0xFF000000u); /* the arcade page is plain black, no arena border */
    centered(fb, a, "GAME ADJUSTMENT", 16, WHITE);
    for (int i = 0; i < ITEMS; i++) {
        int y = ROW_TOP + i * ROW_H;
        font_draw(fb, a, FONT_MAIN, LABELS[i], LABEL_X, y, 1, GREEN);
        value_text(m, i, buf, sizeof buf);
        font_draw(fb, a, FONT_MAIN, buf, VALUE_RIGHT - font_measure(a, FONT_MAIN, buf), y, 1, GREEN);
        font_draw(fb, a, FONT_MAIN, note(m, i), NOTE_X, y, 1, GREEN);
    }
    /* '->' cursor drawn by hand: the ROM font's '>' doesn't read as an arrow */
    int cy = ROW_TOP + m->sel * ROW_H;
    fill_rectf(fb, CURSOR_X, cy + 2, 3, 1, WHITE);
    static const int arrow[5][2] = { { 4, 0 }, { 5, 1 }, { 6, 2 }, { 5, 3 }, { 4, 4 } };
    for (int i = 0; i < 5; i++) fill_rectf(fb, CURSOR_X + arrow[i][0], cy + arrow[i][1], 1, 1, WHITE);
    centered(fb, a, "USE -MOVE- TO SELECT ADJUSTMENT", 176, WHITE);
    centered(fb, a, "USE -FIRE- LEVER TO CHANGE THE VALUE", 186, WHITE);
    centered(fb, a, "PRESS ADVANCE TO EXIT", 200, YELLOW);
    centered(fb, a, "KEYS  W S SELECT   ARROWS CHANGE   ENTER EXIT", 222, 0x888888);
}
