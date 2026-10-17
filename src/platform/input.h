/*
 * Controls, sampled once per 60 Hz frame. Pads go through SDL_GameController
 * (SDL_GAMECONTROLLERCONFIG / gamecontrollerdb.txt), with a keyboard fallback
 * matching the web build (WASD move, arrows fire).
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
    bool operator_menu;  /* Select+R1, edge-triggered */
    bool quit;           /* Select+Start held QUIT_HOLD_FRAMES, Esc, or window close */
} InputFrame;

void input_init(void);
/* Pump SDL events and build this frame's input. */
void input_poll(InputFrame *out);
void input_shutdown(void);

#endif
