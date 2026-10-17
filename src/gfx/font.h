/*
 * ROM bitmap fonts, laid out exactly like the web build's BitmapFont:
 * letters are uppercased; each glyph advances its width plus `tracking`
 * (1 px); characters with no glyph (space) advance the width of '0';
 * '-' and some punctuation are drawn from small built-in patterns.
 */
#ifndef ROBOTRON_FONT_H
#define ROBOTRON_FONT_H

#include <stdint.h>
#include "assets/assets.h"
#include "gfx/fb.h"

typedef enum { FONT_MAIN, FONT_ALT } FontId;

/* Width in pixels at scale 1. */
int font_measure(const Assets *a, FontId id, const char *text);
/* Draw text with its top-left at (x, y), scaled, in colour tint (0xRRGGBB). */
void font_draw(Framebuffer *fb, const Assets *a, FontId id, const char *text,
               double x, double y, int scale, uint32_t tint);
int font_line_height(const Assets *a, FontId id);

/* The same with explicit tracking (extra pixels between glyphs; default 1). */
int font_measure_t(const Assets *a, FontId id, const char *text, int tracking);
void font_draw_t(Framebuffer *fb, const Assets *a, FontId id, const char *text,
                 double x, double y, int scale, int tracking, uint32_t tint);

#endif
