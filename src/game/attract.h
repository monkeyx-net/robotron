/*
 * The attract cycle, as js/attractMode.ts: title (300 frames) -> story pages
 * -> heroes screen (wipe + 603 frames) -> demo play (450 frames) -> title.
 * The caller runs the demo world (sim/world.h) while `screen` is ATTRACT_DEMO;
 * without the ROM tables the heroes screen returns straight to the title.
 */
#ifndef ROBOTRON_ATTRACT_H
#define ROBOTRON_ATTRACT_H

#include "assets/assets.h"
#include "gfx/fb.h"
#include "gfx/heroes.h"
#include "gfx/palette.h"
#include "gfx/story.h"

typedef enum { ATTRACT_TITLE, ATTRACT_STORY, ATTRACT_HEROES, ATTRACT_DEMO } AttractScreen;

typedef struct {
    AttractScreen screen;
    int timer;               /* attractModeTimer: frames left on title / heroes */
    unsigned flash;          /* insertCoinFlashTimer: counts title frames, never reset */
    unsigned heroes_frame;   /* frames since the heroes screen opened */
    Story story;
    CycleA *cycle;           /* shared palette entry A */
    const unsigned long *clock; /* global frame clock (colour cycling) */
    unsigned high_score;
    HeroTables tables;
    int demo_enabled;        /* set by the caller when demo play can run */
    int demo_fresh;          /* the demo just began: the caller sets up its world */
} Attract;

#define TITLE_SCREEN_DURATION 300
#define HIGH_SCORE_DURATION 603
#define DEMO_PLAY_DURATION 450

void attract_init(Attract *at, const Assets *a, const unsigned long *clock, CycleA *cycle);
/* Back to the title (e.g. after the operator menu). */
void attract_show_title(Attract *at);
/* After a game: the heroes screen for `frames` (plus the wipe), then on with the cycle. */
void attract_show_heroes(Attract *at, int frames);
/* A score above this earns initials (either table's last row). */
unsigned attract_qualify_min(const Attract *at);
void attract_step(Attract *at);
void attract_draw(Framebuffer *fb, const Assets *a, Attract *at);

#endif
