/*
 * The arcade-resolution framebuffer every frame is drawn into, in software.
 * The platform layer uploads it to a texture and scales it to the screen.
 */
#ifndef ROBOTRON_FB_H
#define ROBOTRON_FB_H

#include <stdint.h>

#define FB_WIDTH  292
#define FB_HEIGHT 240

typedef struct {
    uint32_t px[FB_HEIGHT][FB_WIDTH]; /* ARGB8888 */
} Framebuffer;

void fb_clear(Framebuffer *fb, uint32_t argb);
/* Clipped to the framebuffer. */
void fb_fill_rect(Framebuffer *fb, int x, int y, int w, int h, uint32_t argb);
/* 1-px outline, clipped. */
void fb_rect(Framebuffer *fb, int x, int y, int w, int h, uint32_t argb);

#endif
