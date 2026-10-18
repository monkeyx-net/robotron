/*
 * Robotron: 2084 native build: SDL setup and the fixed 60 Hz loop.
 * See SDL2_PORT_PLAN.md. So far: the attract cycle (title, story, heroes)
 * and wave 1 of the game (START or coin from any attract screen).
 *
 *   robotron [--windowed] [--frames N] [--screenshot out.png] [--input script.txt]
 *   robotron --extract <rom dir> [<asset dir>]
 *
 * --frames N stops after N updates; with --screenshot the last frame is
 * written as a 292x240 PNG (use SDL_VIDEODRIVER=dummy to run headless).
 * --input replays scripted controls: lines of "<frame> [start] [start2] [coin]
 * [menu] [move:x,y] [fire:x,y]", each holding from that frame until the next line.
 * --extract reads the user's ROM set and writes the data tables to
 * <asset dir>/data (default: assets/ next to the program).
 */
#include <SDL.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "assets/assets.h"
#include "assets/extract.h"
#include "assets/png.h"
#include "game/attract.h"
#include "game/entry.h"
#include "game/hiscore.h"
#include "game/opmenu.h"
#include "game/storage.h"
#include "gfx/play.h"
#include "sim/world.h"
#include "gfx/fb.h"
#include "platform/audio.h"
#include "platform/input.h"
#include "platform/video.h"
#include "sim/prng.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#define FRAME_HZ 60
/* Cap catch-up after a stall (suspend/resume, SD card hiccup). */
#define MAX_STEPS_PER_PRESENT 4

static Framebuffer fb;
static Assets assets;

#define GAME_OVER_HEROES_FRAMES 580 /* heroes screen after a game (MAME) */

typedef enum { MODE_ATTRACT, MODE_PLAY, MODE_ENTRY, MODE_OPMENU } Mode;

typedef struct {
    Prng prng;            /* the ROM PRNG, shared by everything, never reset */
    unsigned long clock;  /* global frame clock: colour cycling */
    CycleA cycle;
    Mode mode;
    Attract attract;
    World world;
    Entry entry;
    OpMenu menu;
    SaveData save;
} Game;

static MenuInput menu_input(const InputFrame *in)
{
    MenuInput m = { in->move_y < 0, in->move_y > 0, in->fire_y < 0 || in->fire_x > 0, in->fire_y > 0 || in->fire_x < 0,
                    in->start || in->menu_held };
    return m;
}

static EntryInput entry_input(const InputFrame *in)
{
    EntryInput e = { in->move_y < 0 || in->fire_y < 0, in->move_y > 0 || in->fire_y > 0,
                     in->start || in->coin || in->fire_x > 0 || in->move_x > 0 };
    return e;
}

static void save_scores(Game *g)
{
    if (storage_save(&g->save)) fprintf(stderr, "robotron: cannot save %s\n", storage_path());
#ifdef __EMSCRIPTEN__
    EM_ASM(FS.syncfs(false, function (err) {})); /* flush /save to IndexedDB */
#endif
}

static void show_heroes_after_game(Game *g)
{
    hiscore_tables(&g->save, &assets, &g->attract.tables);
    attract_show_heroes(&g->attract, GAME_OVER_HEROES_FRAMES);
    g->mode = MODE_ATTRACT;
}

static void play_sounds(World *w)
{
    for (int i = 0; i < w->sound_count; i++) audio_play(w->sounds[i]);
    w->sound_count = 0;
}

static void step(Game *g, const InputFrame *in)
{
    g->clock++;
    if (g->mode == MODE_OPMENU) {
        opmenu_step(&g->menu, menu_input(in));
        if (g->menu.done) {
            g->save.op = g->menu.draft;
            if (g->menu.reset_scores) { /* ROBOTRON HEROES back to the ROM list; ALL TIME stays */
                g->save.hero_count = 0;
                g->save.high_score = g->attract.high_score = 0;
            }
            save_scores(g);
            hiscore_tables(&g->save, &assets, &g->attract.tables);
            attract_show_title(&g->attract);
            g->mode = MODE_ATTRACT;
        }
        return;
    }
    if (g->mode == MODE_ATTRACT) {
        if (in->operator_menu) {
            opmenu_open(&g->menu, &g->save.op, menu_input(in));
            g->mode = MODE_OPMENU;
            return;
        }
        if ((in->start || in->coin || in->start2) && world_can_play(&assets)) {
            g->world.qualify_min = attract_qualify_min(&g->attract);
            world_start(&g->world, &assets, &g->prng, &g->clock, &g->cycle, &g->save.op, in->start2 ? 2 : 1);
            g->mode = MODE_PLAY;
            play_sounds(&g->world);
            return;
        }
        if (g->attract.screen == ATTRACT_DEMO) {
            static const PlayInput none = {0};
            world_step(&g->world, &none);
            g->world.sound_count = 0;
        }
        attract_step(&g->attract);
        if (g->attract.demo_fresh) { /* showDemoPlayScreen: set up now, first update next frame */
            g->attract.demo_fresh = 0;
            world_start_demo(&g->world, &assets, &g->prng, &g->clock, &g->cycle);
        }
        return;
    }
    if (g->mode == MODE_ENTRY) {
        entry_step(&g->entry, entry_input(in));
        if (g->entry.done) {
            audio_stop(SND_HIGH_SCORE_ENTRY);
            hiscore_insert(&g->save, &assets, g->entry.result, g->entry.score);
            save_scores(g);
            show_heroes_after_game(g);
        }
        return;
    }
    PlayInput pin = { in->move_x, in->move_y, in->fire_x, in->fire_y };
    world_step(&g->world, &pin);
    play_sounds(&g->world);
    if (g->world.state == W_DONE) {
        unsigned score = g->world.score;
        if (score > g->save.high_score) {
            g->save.high_score = g->attract.high_score = score;
            save_scores(g);
        }
        if (hiscore_qualifies(&g->attract.tables, score)) {
            int letters = hiscore_is_new_top(&g->attract.tables, score) ? g->save.op.letters : 3;
            entry_start(&g->entry, score, letters, entry_input(in));
            audio_play(SND_HIGH_SCORE_ENTRY);
            g->mode = MODE_ENTRY;
        } else {
            show_heroes_after_game(g);
        }
    }
}

static void draw(Game *g)
{
    if (g->mode == MODE_PLAY) play_draw(&fb, &g->world, &g->cycle, g->clock);
    else if (g->mode == MODE_ENTRY) entry_draw(&fb, &assets, &g->entry, g->world.border_color);
    else if (g->mode == MODE_OPMENU) opmenu_draw(&fb, &assets, &g->menu);
    else if (g->attract.screen == ATTRACT_DEMO) play_draw(&fb, &g->world, &g->cycle, g->clock);
    else attract_draw(&fb, &assets, &g->attract);
}

static int extract(const char *argv0, const char *rom_dir, const char *out_dir)
{
    static RomSet rom;
    char err[512], def[1024];
    if (!out_dir) {
        const char *slash = strrchr(argv0, '/');
        int n = slash ? (int)(slash - argv0) : 0;
        snprintf(def, sizeof def, "%.*s%sassets", n, argv0, slash ? "/" : "");
        out_dir = def;
    }
    if (rom_load(&rom, rom_dir, err, sizeof err) || extract_all(&rom, out_dir, err, sizeof err)) {
        fprintf(stderr, "robotron: %s\n", err);
        return 1;
    }
    printf("robotron: ROM tables written to %s/data\n", out_dir);
    return 0;
}

typedef struct {
    long frame;
    InputFrame in;
} ScriptLine;

static ScriptLine script[4096];
static int script_len, script_pos;

static int load_script(const char *path)
{
    FILE *f = fopen(path, "r");
    if (!f) {
        fprintf(stderr, "robotron: cannot open %s\n", path);
        return -1;
    }
    char line[256];
    while (script_len < (int)(sizeof script / sizeof script[0]) && fgets(line, sizeof line, f)) {
        if (line[0] == '#' || line[0] == '\n') continue;
        ScriptLine *l = &script[script_len];
        memset(l, 0, sizeof *l);
        char *tok = strtok(line, " \t\n");
        if (!tok) continue;
        l->frame = strtol(tok, NULL, 10);
        while ((tok = strtok(NULL, " \t\n"))) {
            if (!strcmp(tok, "start")) l->in.start = true;
            else if (!strcmp(tok, "start2")) l->in.start2 = true;
            else if (!strcmp(tok, "menu")) l->in.menu_held = true;
            else if (!strcmp(tok, "coin")) l->in.coin = true;
            else if (sscanf(tok, "move:%d,%d", &l->in.move_x, &l->in.move_y) == 2) {}
            else if (sscanf(tok, "fire:%d,%d", &l->in.fire_x, &l->in.fire_y) == 2) {}
            else fprintf(stderr, "robotron: %s: unknown token '%s'\n", path, tok);
        }
        script_len++;
    }
    fclose(f);
    return 0;
}

/* Replace live controls with the script line in force at `frame` (quit stays live). */
static void apply_script(InputFrame *in, long frame)
{
    while (script_pos + 1 < script_len && script[script_pos + 1].frame <= frame) script_pos++;
    static bool menu_was_held;
    bool quit = in->quit;
    if (script_len && script[script_pos].frame <= frame) *in = script[script_pos].in;
    else memset(in, 0, sizeof *in);
    in->quit = quit;
    in->operator_menu = in->menu_held && !menu_was_held;
    menu_was_held = in->menu_held;
}

static int save_screenshot(const char *path)
{
    static uint8_t rgba[FB_HEIGHT * FB_WIDTH * 4];
    for (int y = 0; y < FB_HEIGHT; y++)
        for (int x = 0; x < FB_WIDTH; x++) {
            uint32_t p = fb.px[y][x];
            uint8_t *o = rgba + (y * FB_WIDTH + x) * 4;
            o[0] = (uint8_t)(p >> 16);
            o[1] = (uint8_t)(p >> 8);
            o[2] = (uint8_t)p;
            o[3] = 0xFF;
        }
    if (png_write(path, rgba, FB_WIDTH, FB_HEIGHT)) {
        fprintf(stderr, "robotron: cannot write %s\n", path);
        return -1;
    }
    return 0;
}

/* Loop state, static so the browser can run one pass per animation frame. */
static Game g;
static long max_frames = -1;
static const char *screenshot;
static Uint64 step_ticks, last, acc;
static long frames;
static int rc;
static InputFrame in;

static void game_init(void)
{
    prng_reset(&g.prng);
    cycle_a_init(&g.cycle);
    attract_init(&g.attract, &assets, &g.clock, &g.cycle);
    g.attract.demo_enabled = world_can_play(&assets);
    storage_load(&g.save);
    hiscore_tables(&g.save, &assets, &g.attract.tables);
    g.attract.high_score = g.save.high_score;
    if (!world_can_play(&assets))
        fprintf(stderr, "robotron: ROM tables not found; run --extract to enable play (attract only)\n");

    step_ticks = SDL_GetPerformanceFrequency() / FRAME_HZ;
    last = SDL_GetPerformanceCounter();
}

/* Step the sim for the time elapsed, then draw and present; false = stop. */
static bool run_once(void)
{
    Uint64 now = SDL_GetPerformanceCounter();
    acc += now - last;
    last = now;
    if (acc > step_ticks * MAX_STEPS_PER_PRESENT)
        acc = step_ticks * MAX_STEPS_PER_PRESENT;
    /* Headless runs step once per loop so the frame count is exact. */
    if (max_frames >= 0 && acc < step_ticks) acc = step_ticks;

    /* Sim advances in whole frames only; arcade logic is frame-quantised. */
    while (acc >= step_ticks) {
        input_poll(&in);
#ifndef __EMSCRIPTEN__
        if (in.quit) return false; /* a browser tab has nothing to quit to */
#endif
        if (script_len) apply_script(&in, frames + 1);
        step(&g, &in);
        frames++;
        acc -= step_ticks;
        if (max_frames >= 0 && frames >= max_frames) break;
    }
    /* Headless runs (--frames) only need the last frame, and skip vsync pacing. */
    if (max_frames < 0 || frames >= max_frames) draw(&g);
    if (max_frames < 0) video_present(&fb); /* blocks on vsync */
    if (max_frames >= 0 && frames >= max_frames) {
        if (screenshot && save_screenshot(screenshot)) rc = 1;
        return false;
    }
    return true;
}

#ifdef __EMSCRIPTEN__
/* Saves live in /save, an IndexedDB-backed folder loaded before the game starts. */
static void web_frame(void)
{
    static bool started;
    if (!started) {
        if (!EM_ASM_INT({ return Module.robotronSaveReady | 0; })) return;
        game_init();
        started = true;
    }
    run_once();
}
#endif

int main(int argc, char **argv)
{
    bool windowed = false;
    if (argc >= 3 && !strcmp(argv[1], "--extract")) return extract(argv[0], argv[2], argc > 3 ? argv[3] : NULL);
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--windowed")) windowed = true;
        else if (!strcmp(argv[i], "--frames") && i + 1 < argc) max_frames = strtol(argv[++i], NULL, 10);
        else if (!strcmp(argv[i], "--screenshot") && i + 1 < argc) screenshot = argv[++i];
        else if (!strcmp(argv[i], "--input") && i + 1 < argc) {
            if (load_script(argv[++i])) return 1;
        }
        else {
            fprintf(stderr, "usage: %s [--windowed] [--frames N] [--screenshot out.png] [--input script.txt]\n"
                            "       %s --extract <rom dir> [<asset dir>]\n", argv[0], argv[0]);
            return 2;
        }
    }

    char err[512];
    if (assets_load(&assets, argv[0], err, sizeof err)) {
        fprintf(stderr, "robotron: %s\n", err);
        return 1;
    }

    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMECONTROLLER | SDL_INIT_EVENTS) != 0) {
        SDL_Log("SDL_Init: %s", SDL_GetError());
        assets_free(&assets);
        return 1;
    }
#ifdef __EMSCRIPTEN__
    windowed = true; /* the page's canvas */
#endif
    if (!video_init(windowed)) {
        SDL_Quit();
        assets_free(&assets);
        return 1;
    }
    input_init();
    if (max_frames < 0) audio_init(argv[0]); /* headless runs stay silent */

#ifdef __EMSCRIPTEN__
    setenv("ROBOTRON_SAVE_DIR", "/save", 1);
    EM_ASM(
        FS.mkdir('/save');
        FS.mount(IDBFS, {}, '/save');
        FS.syncfs(true, function (err) { Module.robotronSaveReady = 1; });
    );
    emscripten_set_main_loop(web_frame, 0, 1); /* never returns */
#endif
    game_init();
    while (run_once()) {}

    audio_shutdown();
    input_shutdown();
    video_shutdown();
    SDL_Quit();
    assets_free(&assets);
    return rc;
}
