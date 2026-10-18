#include "game/attract.h"

#include <string.h>

#include "gfx/title.h"

static void show_title(Attract *at)
{
    at->screen = ATTRACT_TITLE;
    at->timer = TITLE_SCREEN_DURATION;
}

void attract_show_title(Attract *at)
{
    show_title(at);
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

static void show_demo(Attract *at)
{
    at->screen = ATTRACT_DEMO;
    at->timer = DEMO_PLAY_DURATION;
    at->demo_fresh = 1;
}

void attract_show_heroes(Attract *at, int frames)
{
    show_heroes(at);
    at->timer = frames + HEROES_WIPE_FRAMES;
}

unsigned attract_qualify_min(const Attract *at)
{
    if (at->tables.hero_count < HEROES_ROWS) return 0; /* a table with room takes any score */
    unsigned m = at->tables.all_time[ALL_TIME_ROWS - 1].score;
    if (at->tables.hero_count == HEROES_ROWS && at->tables.heroes[HEROES_ROWS - 1].score < m)
        m = at->tables.heroes[HEROES_ROWS - 1].score;
    return m;
}

void attract_init(Attract *at, const Assets *a, const unsigned long *clock, CycleA *cycle)
{
    memset(at, 0, sizeof *at);
    at->clock = clock;
    at->cycle = cycle;
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
        if (--at->timer <= 0) {
            if (at->demo_enabled) show_demo(at);
            else show_title(at);
        }
        break;
    case ATTRACT_DEMO:
        if (--at->timer <= 0) show_title(at);
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
        story_draw(fb, a, &at->story, at->cycle, *at->clock);
        break;
    case ATTRACT_HEROES:
        heroes_draw(fb, a, &at->tables, at->heroes_frame);
        break;
    case ATTRACT_DEMO: /* drawn by the caller from its demo world */
        break;
    }
}
