/*
 * Wave-start spawn positions, as js/core/SpawnPlacement.ts (ROM $7199, the
 * exclusion boxes at $3920, $42F4, $5B57, $5168, $8B36). Sizes are sprite
 * pixels; the returned points are sprite centres.
 */
#ifndef ROBOTRON_SPAWN_H
#define ROBOTRON_SPAWN_H

#include "sim/prng.h"

typedef struct { double x, y; } Point;
/* Would a w x h sprite centred at p overlap something already placed? */
typedef int (*SpawnBlocked)(void *ctx, Point p, int w, int h);

Point spawn_outside_box(Prng *r, int wave, int w, int h, SpawnBlocked blocked, void *ctx);
Point spawn_electrode(Prng *r, int wave, int w, int h);
Point spawn_anywhere(Prng *r, int w, int h);
Point spawn_brain(Prng *r, int w, int h);
Point spawn_spheroid(Prng *r, int w, int h);
Point spawn_quark(Prng *r, int w, int h);

#endif
