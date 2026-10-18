/*
 * Run-time game assets. Nothing ROM-derived is compiled into the binary
 * (SDL2_PORT_PLAN.md, decision 1):
 *   sprites/{atlas,font_main,font_alt}.{png,json}  required
 *   data/{heroes,waves,waveparams,electrodes}.txt  written by --extract; optional
 *
 * Each part comes from the first of these that has it: $ROBOTRON_ASSETS,
 * <exe dir>/assets, then the source tree (development builds only).
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

#define HEROES_ROWS 10
#define WAVES 40
enum { W_GRUNTS, W_ELECTRODES, W_MOMMIES, W_DADDIES, W_MIKEYS, W_HULKS, W_BRAINS, W_SPHEROIDS, W_QUARKS, WAVE_FIELDS };

typedef struct {
    char initials[4];
    unsigned score;
} HeroRow;

#define PARAM_TABLES 12
#define PARAM_BYTES 43 /* header, min, max, waves 1-40 */

typedef struct {
    int hold, w, h;      /* hold frames while dying; size in pixels */
    char rows[24][25];   /* '#' lit */
} ElectrodeFrame;

typedef struct {
    int entry;           /* palette entry the electrodes draw in */
    int nframes;
    ElectrodeFrame frames[3];
} ElectrodeLook;

typedef struct {
    char sprites_dir[1024]; /* holds sprites/ */
    char data_dir[1024];    /* holds data/, or "" when not extracted yet */
    Atlas atlas;
    Font font_main;
    Font font_alt;
    int have_heroes;        /* data/heroes.txt loaded */
    HeroRow rom_heroes[HEROES_ROWS];
    int have_waves;         /* data/waves.txt loaded */
    unsigned char waves[WAVES][WAVE_FIELDS];
    int have_params;        /* data/waveparams.txt loaded */
    unsigned char params[PARAM_TABLES][PARAM_BYTES];
    unsigned char mercy[4][4];
    int have_electrodes;    /* data/electrodes.txt loaded */
    ElectrodeLook electrodes[10];
} Assets;

/* Find the asset dir and load everything. Returns 0, or -1 with a message in err (size errlen). */
int assets_load(Assets *a, const char *argv0, char *err, int errlen);
void assets_free(Assets *a);

/* Frame by name (e.g. "logo2084_0"), or NULL. */
const AtlasFrame *atlas_frame(const Atlas *atlas, const char *name);

#endif
