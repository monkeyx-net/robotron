#include "gfx/font.h"

#include <ctype.h>
#include <string.h>

#include "gfx/blit.h"

#define DASH_W 3

/* Punctuation outside the ROM charset ('0'-'^'), plus cells the extractor got
   wrong; a pattern here wins over the sheet. Same as js/core/BitmapFont.ts. */
typedef struct {
    char ch;
    const char *rows[6];
} Synth;

static const Synth synth_alt[] = {
    { ')', { "#..", ".#.", "..#", "..#", ".#.", "#.." } },
    { 'I', { ".##.", ".##.", ".##.", ".##.", ".##.", ".##." } },
    { '(', { "..#", ".#.", "#..", "#..", ".#.", "..#" } },
    { '.', { ".", ".", ".", ".", ".", "#" } },
    { ',', { ".", ".", ".", ".", "#", "#" } },
    { '\'', { "#", "#", ".", ".", ".", "." } },
    { '!', { "#", "#", "#", "#", ".", "#" } },
    { 0, { 0 } },
};

static const Synth synth_main[] = {
    { ')', { ".#.", "..#", "..#", "..#", ".#." } },
    { '(', { ".#", "#.", "#.", "#.", ".#" } },
    { '.', { ".", ".", ".", ".", "#" } },
    { ',', { ".", ".", ".", "#", "#" } },
    { '\'', { "#", "#", ".", ".", "." } },
    { '!', { "#", "#", "#", ".", "#" } },
    { 0, { 0 } },
};

static const Font *font_of(const Assets *a, FontId id)
{
    return id == FONT_ALT ? &a->font_alt : &a->font_main;
}

static const Synth *synth_for(FontId id, char ch)
{
    for (const Synth *s = id == FONT_ALT ? synth_alt : synth_main; s->ch; s++)
        if (s->ch == ch) return s;
    return NULL;
}

static const Glyph *glyph_for(const Font *f, char ch)
{
    unsigned char c = (unsigned char)ch;
    if (c < ' ' || c > '~') return NULL;
    const Glyph *g = &f->glyphs[c - ' '];
    return g->present ? g : NULL;
}

static int space_width(const Font *f)
{
    const Glyph *zero = glyph_for(f, '0');
    return zero ? zero->w : 4;
}

int font_line_height(const Assets *a, FontId id)
{
    return font_of(a, id)->line_height;
}

int font_measure_t(const Assets *a, FontId id, const char *text, int tracking)
{
    const Font *f = font_of(a, id);
    int x = 0;
    for (const char *p = text; *p; p++) {
        char ch = (char)toupper((unsigned char)*p);
        const Synth *s = synth_for(id, ch);
        const Glyph *g = glyph_for(f, ch);
        int w = s ? (int)strlen(s->rows[0]) + 1 : g ? g->w : ch == '-' ? DASH_W : space_width(f);
        x += w + tracking;
    }
    return x > tracking ? x - tracking : 0;
}

int font_measure(const Assets *a, FontId id, const char *text)
{
    return font_measure_t(a, id, text, 1);
}

void font_draw_t(Framebuffer *fb, const Assets *a, FontId id, const char *text,
                 double x, double y, int scale, int tracking, uint32_t tint)
{
    const Font *f = font_of(a, id);
    int cx = 0; /* cursor in unscaled font pixels */
    for (const char *p = text; *p; p++) {
        char ch = (char)toupper((unsigned char)*p);
        const Synth *s = synth_for(id, ch);
        const Glyph *g = s ? NULL : glyph_for(f, ch);
        double ox = x + (double)cx * scale;
        if (s) {
            int w = (int)strlen(s->rows[0]);
            for (int row = 0; row < 6 && s->rows[row]; row++)
                for (int col = 0; col < w; col++)
                    if (s->rows[row][col] == '#')
                        fill_rectf(fb, ox + col * scale, y + row * scale, scale, scale, tint);
            cx += w + 1 + tracking;
        } else if (g) {
            blit(fb, &f->image, g->x, g->y, g->w, g->h, ox, y, scale, tint);
            cx += g->w + tracking;
        } else if (ch == '-') {
            fill_rectf(fb, ox, y + (f->line_height / 2) * scale, DASH_W * scale, scale, tint);
            cx += DASH_W + tracking;
        } else {
            cx += space_width(f) + tracking;
        }
    }
}

void font_draw(Framebuffer *fb, const Assets *a, FontId id, const char *text,
               double x, double y, int scale, uint32_t tint)
{
    font_draw_t(fb, a, id, text, x, y, scale, 1, tint);
}
