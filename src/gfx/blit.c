#include "gfx/blit.h"

#include <math.h>

/* Pixels whose centres lie in [a, b): first..last inclusive (last < first if none). */
static void span(double a, double b, int limit, int *first, int *last)
{
    int f = (int)ceil(a - 0.5);
    int l = (int)ceil(b - 0.5) - 1;
    if (f < 0) f = 0;
    if (l > limit - 1) l = limit - 1;
    *first = f;
    *last = l;
}

/* round(a * b / 255) for 8-bit channels, as the GPU writes a normalized product. */
static uint32_t mul8(uint32_t a, uint32_t b)
{
    return (a * b * 2 + 255) / 510;
}

void blit(Framebuffer *fb, const Image *img, int sx, int sy, int sw, int sh,
          double dx, double dy, int scale, uint32_t tint)
{
    blit_ex(fb, img, sx, sy, sw, sh, dx, dy, scale, tint, 1.0, 0);
}

void blit_ex(Framebuffer *fb, const Image *img, int sx, int sy, int sw, int sh,
             double dx, double dy, int scale, uint32_t tint, double alpha, int silhouette)
{
    uint32_t sprite_a = alpha >= 1 ? 255 : alpha <= 0 ? 0 : (uint32_t)(alpha * 255 + 0.5);
    if (!sprite_a) return;
    if (scale < 1) scale = 1;
    int x0, x1, y0, y1;
    span(dx, dx + (double)sw * scale, FB_WIDTH, &x0, &x1);
    span(dy, dy + (double)sh * scale, FB_HEIGHT, &y0, &y1);
    uint32_t tr = tint >> 16 & 0xFF, tg = tint >> 8 & 0xFF, tb = tint & 0xFF;

    for (int y = y0; y <= y1; y++) {
        int v = (int)floor((y + 0.5 - dy) / scale);
        if (v < 0 || v >= sh) continue;
        const uint8_t *row = img->rgba + ((size_t)(sy + v) * (size_t)img->width + (size_t)sx) * 4;
        for (int x = x0; x <= x1; x++) {
            int u = (int)floor((x + 0.5 - dx) / scale);
            if (u < 0 || u >= sw) continue;
            const uint8_t *p = row + (size_t)u * 4;
            uint32_t a = p[3];
            if (!a) continue;
            if (silhouette) a = 255;
            a = mul8(a, sprite_a);
            uint32_t r = silhouette ? tr : mul8(p[0], tr), g = silhouette ? tg : mul8(p[1], tg),
                     b = silhouette ? tb : mul8(p[2], tb);
            uint32_t *d = &fb->px[y][x];
            if (a < 255) { /* source-over */
                uint32_t dr = *d >> 16 & 0xFF, dg = *d >> 8 & 0xFF, db = *d & 0xFF;
                r = mul8(r, a) + mul8(dr, 255 - a);
                g = mul8(g, a) + mul8(dg, 255 - a);
                b = mul8(b, a) + mul8(db, 255 - a);
            }
            *d = 0xFF000000u | r << 16 | g << 8 | b;
        }
    }
}

void fill_rectf(Framebuffer *fb, double x, double y, double w, double h, uint32_t rgb)
{
    int x0, x1, y0, y1;
    span(x, x + w, FB_WIDTH, &x0, &x1);
    span(y, y + h, FB_HEIGHT, &y0, &y1);
    for (int yy = y0; yy <= y1; yy++)
        for (int xx = x0; xx <= x1; xx++)
            fb->px[yy][xx] = 0xFF000000u | (rgb & 0xFFFFFF);
}

void blend_pixel(Framebuffer *fb, int x, int y, uint32_t rgb, double alpha)
{
    if (x < 0 || y < 0 || x >= FB_WIDTH || y >= FB_HEIGHT) return;
    uint32_t a = alpha >= 1 ? 255 : alpha <= 0 ? 0 : (uint32_t)(alpha * 255 + 0.5);
    uint32_t *d = &fb->px[y][x];
    uint32_t r = rgb >> 16 & 0xFF, g = rgb >> 8 & 0xFF, b = rgb & 0xFF;
    uint32_t dr = *d >> 16 & 0xFF, dg = *d >> 8 & 0xFF, db = *d & 0xFF;
    r = mul8(r, a) + mul8(dr, 255 - a);
    g = mul8(g, a) + mul8(dg, 255 - a);
    b = mul8(b, a) + mul8(db, 255 - a);
    *d = 0xFF000000u | r << 16 | g << 8 | b;
}

void fill_rectf_alpha(Framebuffer *fb, double x, double y, double w, double h, uint32_t rgb, double alpha)
{
    int x0, x1, y0, y1;
    span(x, x + w, FB_WIDTH, &x0, &x1);
    span(y, y + h, FB_HEIGHT, &y0, &y1);
    for (int yy = y0; yy <= y1; yy++)
        for (int xx = x0; xx <= x1; xx++) blend_pixel(fb, xx, yy, rgb, alpha);
}
