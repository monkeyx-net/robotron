#include "game/attract.h"

#include <string.h>

#include "gfx/title.h"

static void show_title(Attract *at)
{
    at->screen = ATTRACT_TITLE;
    at->timer = TITLE_SCREEN_DURATION;
}

static void show_story(Attract *at)
{
    at->screen = ATTRACT_STORY;
    story_start(&at->story);
}

static void show_heroes(Attract *at)
{
    at->screen = ATTRACT_HEROES;
    at->heroes_frame = 0;
    at->timer = HIGH_SCORE_DURATION + HEROES_WIPE_FRAMES;
}

void attract_init(Attract *at, const Assets *a)
{
    memset(at, 0, sizeof *at);
    cycle_a_init(&at->cycle);
    /* ROBOTRON HEROES: the ROM's factory list when extracted; ALL TIME HEROES: 37 x 10000.
       Saved scores come with persistent storage. */
    if (a->have_heroes) {
        memcpy(at->tables.heroes, a->rom_heroes, sizeof at->tables.heroes);
        at->tables.hero_count = HEROES_ROWS;
    }
    for (int i = 0; i < ALL_TIME_ROWS; i++) at->tables.all_time[i].score = 10000;
    show_title(at);
}

void attract_step(Attract *at)
{
    at->clock++;
    switch (at->screen) {
    case ATTRACT_TITLE:
        at->flash++;
        if (--at->timer <= 0) show_story(at);
        break;
    case ATTRACT_STORY:
        if (story_step(&at->story)) show_heroes(at);
        break;
    case ATTRACT_HEROES:
        at->heroes_frame++;
        if (--at->timer <= 0) show_title(at); /* demo play goes here (P2) */
        break;
    }
}

void attract_draw(Framebuffer *fb, const Assets *a, Attract *at)
{
    switch (at->screen) {
    case ATTRACT_TITLE:
        title_draw(fb, a, at->flash, at->high_score);
        break;
    case ATTRACT_STORY:
        fb_clear(fb, 0xFF000000u);
        playfield_border(fb, BORDER_WAVE1);
        story_draw(fb, a, &at->story, &at->cycle, at->clock);
        break;
    case ATTRACT_HEROES:
        heroes_draw(fb, a, &at->tables, at->heroes_frame);
        break;
    }
}
