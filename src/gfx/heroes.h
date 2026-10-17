/*
 * The arcade heroes screen, as js/core/HeroesScreen.ts (laid out from MAME):
 * 57 concentric dithered rings, the rectangle wipe that opens it, then
 * ROBOTRON HEROES (10 rows) and ALL TIME HEROES (37 rows) pulsing in red.
 */
#ifndef ROBOTRON_HEROES_H
#define ROBOTRON_HEROES_H

#include "assets/assets.h"
#include "gfx/fb.h"

#define HEROES_WIPE_FRAMES 87
#define ALL_TIME_ROWS 37

typedef struct {
    HeroRow heroes[HEROES_ROWS];
    int hero_count;
    HeroRow all_time[ALL_TIME_ROWS];
} HeroTables;

/* `frame` counts from 0 when the screen opens (the first wipe frame). */
void heroes_draw(Framebuffer *fb, const Assets *a, const HeroTables *t, unsigned frame);

#endif
