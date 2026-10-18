#include "sim/spawn.h"

#define MAX_TRIES 500

/* $3920 + 4 * level: y0, y1, x0, x1 (lines, bytes); index 0 unused */
static const int BOXES[7][4] = {
    { 0, 0, 0, 0 },
    { 0x40, 0xB0, 0x1A, 0x7A },
    { 0x48, 0xA8, 0x1A, 0x7A },
    { 0x50, 0xA0, 0x2A, 0x6A },
    { 0x54, 0x9D, 0x30, 0x60 },
    { 0x5D, 0x96, 0x35, 0x59 },
    { 0x62, 0x94, 0x38, 0x5C },
};

static int bounded(Prng *r, int n)
{
    return ((prng_step(r) * n) >> 8) + 1;
}

static const int *box_for(int wave)
{
    int level = wave >= 10 ? 6 : wave < 1 ? 1 : wave > 5 ? 5 : wave;
    return BOXES[level];
}

static int rom_w(int w) { return (w + 1) / 2; }

static Point to_port(int xb, int yb, int w, int h)
{
    Point p = { 2.0 * xb - 6 + w / 2.0, yb - 7 + h / 2.0 };
    return p;
}

static void random_top_left(Prng *r, int wb, int h, int *xb, int *yb)
{
    *xb = bounded(r, 0x88 - wb) + 6;
    *yb = bounded(r, 0xD2 - h) + 0x17;
}

static int in_box(int xb, int yb, const int box[4])
{
    return yb > box[0] && yb < box[1] && xb > box[2] && xb < box[3];
}

Point spawn_outside_box(Prng *r, int wave, int w, int h, SpawnBlocked blocked, void *ctx)
{
    const int *box = box_for(wave);
    Point p = { 0, 0 };
    for (int i = 0; i < MAX_TRIES; i++) {
        int xb, yb;
        random_top_left(r, rom_w(w), h, &xb, &yb);
        if (in_box(xb, yb, box)) continue;
        p = to_port(xb, yb, w, h);
        if (!blocked || !blocked(ctx, p, w, h)) return p;
    }
    return p;
}

Point spawn_electrode(Prng *r, int wave, int w, int h)
{
    const int *b = box_for(wave);
    const int box[4] = { b[0] + 4, b[1] - 4, b[2] + 3, b[3] - 3 };
    for (;;) {
        int xb, yb;
        random_top_left(r, rom_w(w), h, &xb, &yb);
        if (!in_box(xb, yb, box)) return to_port(xb, yb, w, h);
    }
}

Point spawn_anywhere(Prng *r, int w, int h)
{
    int xb, yb;
    random_top_left(r, rom_w(w), h, &xb, &yb);
    return to_port(xb, yb, w, h);
}

Point spawn_brain(Prng *r, int w, int h)
{
    int wb = rom_w(w), xb, yb;
    random_top_left(r, wb, h, &xb, &yb);
    if (!(prng_step(r) & 0x80)) {
        int n = bounded(r, 0x10);
        xb = prng_step(r) & 0x80 ? 0x8F - (n + wb) : n + 7;
    } else {
        int n = bounded(r, 0x20);
        yb = prng_step(r) & 0x80 ? 0xEA - (n + h) : n + 0x18;
    }
    return to_port(xb, yb, w, h);
}

Point spawn_spheroid(Prng *r, int w, int h)
{
    int xb, yb;
    random_top_left(r, rom_w(w), h, &xb, &yb);
    xb = prng_step(r) & 0x80 ? 0x09 : 0x87;
    return to_port(xb, yb, w, h);
}

Point spawn_quark(Prng *r, int w, int h)
{
    int yb = prng_step(r) & 0x80 ? 0xDC : 0x1A;
    int xb = bounded(r, 0x7E) + 6;
    return to_port(xb, yb, w, h);
}
