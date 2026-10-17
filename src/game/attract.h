/*
 * The attract cycle, as js/attractMode.ts: title (300 frames) -> story pages
 * -> heroes screen (wipe + 603 frames) -> demo play -> title. Demo play needs
 * the gameplay sim (P2), so for now the heroes screen returns to the title.
 */
#ifndef ROBOTRON_ATTRACT_H
#define ROBOTRON_ATTRACT_H

#include "assets/assets.h"
#include "gfx/fb.h"
#include "gfx/heroes.h"
#include "gfx/palette.h"
#include "gfx/story.h"

typedef enum { ATTRACT_TITLE, ATTRACT_STORY, ATTRACT_HEROES } AttractScreen;

typedef struct {
    AttractScreen screen;
    int timer;               /* attractModeTimer: frames left on title / heroes */
    unsigned flash;          /* insertCoinFlashTimer: counts title frames, never reset */
    unsigned heroes_frame;   /* frames since the heroes screen opened */
    Story story;
    CycleA cycle;
    unsigned long clock;     /* global frame clock (colour cycling) */
    unsigned high_score;
    HeroTables tables;
} Attract;

#define TITLE_SCREEN_DURATION 300
#define HIGH_SCORE_DURATION 603

void attract_init(Attract *at, const Assets *a);
void attract_step(Attract *at);
void attract_draw(Framebuffer *fb, const Assets *a, Attract *at);

#endif
