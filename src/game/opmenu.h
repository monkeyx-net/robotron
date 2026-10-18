/*
 * The operator's GAME ADJUSTMENT page, as js/core/OperatorMenu.ts: MOVE
 * up/down selects, FIRE up/down (or right/left) changes, ADVANCE (Start, or
 * the menu button again) saves and exits on release. Inputs are edge-
 * triggered, seeded with what is held when it opens, repeating after
 * 400 ms every 120 ms. RESTORE FACTORY SETTINGS and HIGH SCORE TABLE RESET
 * apply on exit.
 */
#ifndef ROBOTRON_OPMENU_H
#define ROBOTRON_OPMENU_H

#include "assets/assets.h"
#include "gfx/fb.h"
#include "sim/world.h"

typedef struct {
    int up, down, inc, dec, exit;
} MenuInput;

typedef struct {
    OperatorSettings draft;
    int restore_factory, reset_scores;
    int sel;
    MenuInput prev;
    int exit_armed, held_frames, since_repeat;
    int done;
} OpMenu;

void opmenu_open(OpMenu *m, const OperatorSettings *current, MenuInput held);
void opmenu_step(OpMenu *m, MenuInput in);
void opmenu_draw(Framebuffer *fb, const Assets *a, const OpMenu *m);

#endif
