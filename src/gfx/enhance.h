/*
 * Enhanced graphics (not in the arcade or the web build; classic is the default):
 *   FILTER  the arcade frame is drawn as usual, then upscaled whole (Scale2x/3x
 *           or xBR) to the display's integer scale
 *   HD      everything is drawn at that scale: sprites and fonts from upscaled
 *           copies, shapes and effects at device-pixel precision
 * plus a glow (bloom) pass and CRT scanlines (the scanlines are drawn by the
 * platform layer). The sim is untouched, so play is identical in every mode.
 */
#ifndef ROBOTRON_ENHANCE_H
#define ROBOTRON_ENHANCE_H

#include "assets/assets.h"
#include "gfx/fb.h"
#include "gfx/scale.h"

typedef enum { GFX_CLASSIC, GFX_FILTER, GFX_HD } GfxMode;

typedef struct {
    int mode;      /* GfxMode */
    int smooth;    /* xBR instead of Scale2x/3x */
    int glow;
    int scanlines;
} GfxSettings;

/* "CLASSIC", "HD SMOOTH + GLOW", ... for the on-screen notice. */
const char *gfx_describe(const GfxSettings *g);
/* Step through the presets (classic, crisp, smooth, hd-crisp, hd-smooth, hd-glow, ...). */
void gfx_next_preset(GfxSettings *g);
/* A preset by its command-line name; returns 0, or -1 if unknown. */
int gfx_parse(const char *name, GfxSettings *g);
/* Preset names for --help, space separated. */
const char *gfx_preset_names(void);

/* Arcade pixels drawn per device pixel (1 = classic, else 2..FB_MAX_SCALE) given
   the display's integer scale. */
int gfx_render_scale(const GfxSettings *g, int display_scale);

/* Upscaled atlas, fonts and electrode shapes for HD rendering at `factor`
   (cached; rebuilt when factor or scaler change). Returns 0, or -1 when out of memory. */
int enhance_prepare(const Assets *a, int factor, Scaler scaler);
/* An electrode shape as an image, when HD rendering at `factor` is prepared; else NULL. */
const Image *enhance_electrode_image(const ElectrodeFrame *f, int factor);

/* FILTER: upscale the arcade frame src (scale 1) into dst (scale 2..4). */
int enhance_filter_frame(const Framebuffer *src, Framebuffer *dst, Scaler scaler);
/* Bloom: add a blurred copy of the frame onto itself. */
void enhance_glow(Framebuffer *fb);

#endif
