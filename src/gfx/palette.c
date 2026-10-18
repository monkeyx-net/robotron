#include "gfx/palette.h"

#include <stddef.h>

static const uint8_t RG[8] = { 0x00, 0x26, 0x51, 0x76, 0x89, 0xAE, 0xD9, 0xFF };
static const uint8_t BL[4] = { 0x00, 0x5F, 0xA0, 0xFF };

static const uint8_t D_TABLE[] = {
    0xFF, 0xBF, 0x3F, 0x3E, 0x3C, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F,
    0x37, 0x2F, 0x27, 0x1F, 0x17, 0x47, 0x87, 0xC7, 0xC6, 0xC5, 0xCC, 0xCB, 0xCA,
    0xDA, 0xE8, 0xF8, 0xF9, 0xFA, 0xFB, 0xFD,
};

uint32_t palette_rgb(uint8_t b)
{
    return (uint32_t)RG[b & 7] << 16 | (uint32_t)RG[(b >> 3) & 7] << 8 | BL[b >> 6];
}

void cycle_a_init(CycleA *c)
{
    c->slot = -1;
    c->color = 0xFF;
    prng_reset(&c->rng);
}

uint32_t cycle_a_color(CycleA *c, unsigned long frame)
{
    long slot = (long)(frame / 8);
    if (slot != c->slot) {
        c->slot = slot;
        c->color = D_TABLE[prng_bounded(&c->rng, (int)sizeof D_TABLE)];
    }
    return palette_rgb(frame % 8 < 6 ? c->color : 0xFF);
}

typedef struct { uint8_t byte, frames; } Step;

static const Step PROG_F[] = { { 0x07, 12 }, { 0x2F, 6 } };
static const Step PROG_E[] = {
    { 0x07, 2 }, { 0x47, 2 }, { 0x87, 2 }, { 0xC7, 2 },
    { 0xC6, 1 }, { 0xC5, 1 }, { 0xC4, 1 }, { 0xC3, 1 }, { 0xC2, 1 }, { 0xC1, 1 }, { 0xC0, 1 },
    { 0xC1, 1 }, { 0xC2, 1 }, { 0xC3, 1 }, { 0xC4, 1 }, { 0xC5, 1 }, { 0xC6, 1 }, { 0xC7, 1 },
    { 0x87, 2 }, { 0x47, 2 },
};
static const Step PROG_B[] = { { 0xC0, 8 }, { 0x38, 8 }, { 0x07, 8 } };

static uint8_t program_byte(const Step *prog, int n, unsigned long frame)
{
    unsigned long period = 0;
    for (int i = 0; i < n; i++) period += prog[i].frames;
    unsigned long f = frame % period;
    for (int i = 0; i < n; i++) {
        if (f < prog[i].frames) return prog[i].byte;
        f -= prog[i].frames;
    }
    return prog[0].byte;
}

/* D: the rainbow table, holding the three reds-to-magenta steps for 4 frames */
static uint8_t program_d(unsigned long frame)
{
    unsigned long period = 0;
    for (size_t i = 0; i < sizeof D_TABLE; i++) {
        uint8_t b = D_TABLE[i];
        period += b == 0x47 || b == 0x87 || b == 0xC7 ? 4 : 2;
    }
    unsigned long f = frame % period;
    for (size_t i = 0; i < sizeof D_TABLE; i++) {
        uint8_t b = D_TABLE[i];
        unsigned hold = b == 0x47 || b == 0x87 || b == 0xC7 ? 4 : 2;
        if (f < hold) return b;
        f -= hold;
    }
    return D_TABLE[0];
}

long palette_cycle(int entry, unsigned long frame, CycleA *a)
{
    switch (entry) {
    case 0xA: return (long)cycle_a_color(a, frame);
    case 0xB: return (long)palette_rgb(program_byte(PROG_B, 3, frame));
    case 0xD: return (long)palette_rgb(program_d(frame));
    case 0xE: return (long)palette_rgb(program_byte(PROG_E, 20, frame));
    case 0xF: return (long)palette_rgb(program_byte(PROG_F, 2, frame));
    default: return -1;
    }
}
