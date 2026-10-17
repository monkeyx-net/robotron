/*
 * Run-time game assets: sprite atlas and ROM fonts, read from
 * <asset dir>/sprites/{atlas,font_main,font_alt}.{png,json}. Nothing
 * ROM-derived is compiled into the binary (SDL2_PORT_PLAN.md, decision 1).
 *
 * Asset dir search order: $ROBOTRON_ASSETS, <exe dir>/assets, then the
 * source tree (development builds only).
 */
#ifndef ROBOTRON_ASSETS_H
#define ROBOTRON_ASSETS_H

#include <stdint.h>
#include "assets/png.h"

typedef struct {
    char name[32];
    int x, y, w, h;
} AtlasFrame;

#define MAX_ATLAS_FRAMES 256
#define MAX_GLYPHS 96 /* ' ' .. '~' */

typedef struct {
    Image image;
    AtlasFrame frames[MAX_ATLAS_FRAMES];
    int frame_count;
    uint32_t palette[16]; /* 0xRRGGBB, the Williams palette captured from hardware */
} Atlas;

typedef struct {
    int x, y, w, h;
    int present;
} Glyph;

typedef struct {
    Image image;
    int line_height;
    Glyph glyphs[MAX_GLYPHS]; /* indexed by char - ' ' */
} Font;

typedef struct {
    char dir[1024];
    Atlas atlas;
    Font font_main;
    Font font_alt;
} Assets;

/* Find the asset dir and load everything. Returns 0, or -1 with a message in err (size errlen). */
int assets_load(Assets *a, const char *argv0, char *err, int errlen);
void assets_free(Assets *a);

/* Frame by name (e.g. "logo2084_0"), or NULL. */
const AtlasFrame *atlas_frame(const Atlas *atlas, const char *name);

#endif
