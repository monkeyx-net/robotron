#include "gfx/fb.h"

void fb_clear(Framebuffer *fb, uint32_t argb)
{
    for (int y = 0; y < FB_HEIGHT; y++)
        for (int x = 0; x < FB_WIDTH; x++)
            fb->px[y][x] = argb;
}

void fb_fill_rect(Framebuffer *fb, int x, int y, int w, int h, uint32_t argb)
{
    int x0 = x < 0 ? 0 : x;
    int y0 = y < 0 ? 0 : y;
    int x1 = x + w > FB_WIDTH ? FB_WIDTH : x + w;
    int y1 = y + h > FB_HEIGHT ? FB_HEIGHT : y + h;
    for (int yy = y0; yy < y1; yy++)
        for (int xx = x0; xx < x1; xx++)
            fb->px[yy][xx] = argb;
}

void fb_rect(Framebuffer *fb, int x, int y, int w, int h, uint32_t argb)
{
    if (w <= 0 || h <= 0) return;
    fb_fill_rect(fb, x, y, w, 1, argb);
    fb_fill_rect(fb, x, y + h - 1, w, 1, argb);
    fb_fill_rect(fb, x, y, 1, h, argb);
    fb_fill_rect(fb, x + w - 1, y, 1, h, argb);
}
