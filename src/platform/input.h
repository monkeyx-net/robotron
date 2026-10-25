/*
 * Controls, sampled once per 60 Hz frame. Pads go through SDL_GameController
 * (SDL_GAMECONTROLLERCONFIG / gamecontrollerdb.txt), with a keyboard fallback
 * matching the web build (WASD move, arrows fire). Graphics modes: Select+L1
 * or F3 steps the presets, F4 toggles glow, F5 scanlines. Screen: Select+R2 or
 * F7 steps the scale mode, Select+L2 or F8 the aspect (platform/video.h).
 */
#ifndef ROBOTRON_INPUT_H
#define ROBOTRON_INPUT_H

#include <stdbool.h>

/* Frames Select+Start must be held to quit (decision 2: 1 s). */
#define QUIT_HOLD_FRAMES 60

typedef struct {
    int move_x, move_y;  /* -1, 0, 1 each */
    int fire_x, fire_y;  /* -1, 0, 1 each */
    bool coin;           /* Select */
    bool start;          /* Start */
    bool start2;         /* 2-player start: key 2, or Start with L1 held */
    bool operator_menu;  /* Select+R1 or F2, edge-triggered */
    bool menu_held;      /* the same, while held */
    bool quit;           /* Select+Start held QUIT_HOLD_FRAMES, Esc, or window close */
    bool gfx_next;       /* Select+L1 or F3, edge-triggered: next graphics preset */
    bool gfx_glow;       /* F4, edge-triggered */
    bool gfx_scanlines;  /* F5, edge-triggered */
    bool screen_scale;   /* Select+R2 or F7, edge-triggered: next scale mode */
    bool screen_aspect;  /* Select+L2 or F8, edge-triggered: 4:3 or square pixels */
} InputFrame;

void input_init(void);
/* Pump SDL events and build this frame's input. */
void input_poll(InputFrame *out);
void input_shutdown(void);

#endif
