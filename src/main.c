/*
 * Robotron: 2084 native build: SDL setup and the fixed 60 Hz loop.
 * See SDL2_PORT_PLAN.md. Scaffold only: draws a test pattern driven by the
 * inputs until the sim (src/sim/) and drawing (src/gfx/) are ported.
 *
 *   robotron [--windowed]
 */
#include <SDL.h>
#include <string.h>

#include "gfx/fb.h"
#include "platform/input.h"
#include "platform/video.h"
#include "sim/prng.h"

#define FRAME_HZ 60
/* Cap catch-up after a stall (suspend/resume, SD card hiccup). */
#define MAX_STEPS_PER_PRESENT 4

static Framebuffer fb;

typedef struct {
    Prng prng;
    unsigned frame;
    int x, y;
    int fire_x, fire_y;
} Scaffold;

static void step(Scaffold *s, const InputFrame *in)
{
    prng_step(&s->prng); /* the ROM steps it once per frame */
    s->frame++;
    s->x += in->move_x;
    s->y += in->move_y;
    if (s->x < 8) s->x = 8;
    if (s->x > FB_WIDTH - 16) s->x = FB_WIDTH - 16;
    if (s->y < 16) s->y = 16;
    if (s->y > FB_HEIGHT - 16) s->y = FB_HEIGHT - 16;
    s->fire_x = in->fire_x;
    s->fire_y = in->fire_y;
}

static void draw(const Scaffold *s)
{
    fb_clear(&fb, 0xFF000000);
    /* Playfield border; the colour cycles with the PRNG, like the ROM's flashing. */
    uint32_t c = 0xFF000000 | (uint32_t)s->prng.accum << 16 | (uint32_t)s->prng.hi << 8 | s->prng.lo;
    fb_rect(&fb, 4, 12, FB_WIDTH - 8, FB_HEIGHT - 16, c);
    fb_fill_rect(&fb, s->x, s->y, 8, 8, 0xFFFFFFFF);
    if (s->fire_x || s->fire_y)
        fb_fill_rect(&fb, s->x + 3 + s->fire_x * 8, s->y + 3 + s->fire_y * 8, 2, 2, 0xFFFFFF00);
}

int main(int argc, char **argv)
{
    bool windowed = false;
    for (int i = 1; i < argc; i++)
        if (strcmp(argv[i], "--windowed") == 0) windowed = true;

    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMECONTROLLER | SDL_INIT_EVENTS) != 0) {
        SDL_Log("SDL_Init: %s", SDL_GetError());
        return 1;
    }
    if (!video_init(windowed)) {
        SDL_Quit();
        return 1;
    }
    input_init();

    Scaffold s = { .x = FB_WIDTH / 2, .y = FB_HEIGHT / 2 };
    prng_reset(&s.prng);

    const Uint64 freq = SDL_GetPerformanceFrequency();
    const Uint64 step_ticks = freq / FRAME_HZ;
    Uint64 last = SDL_GetPerformanceCounter();
    Uint64 acc = 0;
    InputFrame in = {0};

    for (;;) {
        Uint64 now = SDL_GetPerformanceCounter();
        acc += now - last;
        last = now;
        if (acc > step_ticks * MAX_STEPS_PER_PRESENT)
            acc = step_ticks * MAX_STEPS_PER_PRESENT;

        /* Sim advances in whole frames only; arcade logic is frame-quantised. */
        while (acc >= step_ticks) {
            input_poll(&in);
            if (in.quit) goto done;
            step(&s, &in);
            acc -= step_ticks;
        }
        draw(&s);
        video_present(&fb); /* blocks on vsync */
    }

done:
    input_shutdown();
    video_shutdown();
    SDL_Quit();
    return 0;
}
