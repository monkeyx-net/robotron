/*
 * Williams palette helpers and the ROM's colour-cycling entry A, as in
 * js/core/ColorCycles.ts: entry A shows a random colour from D's table for
 * 6 frames, then white for 2, on 8-frame slots of the global frame clock.
 * B, D, E and F run fixed programs logged from MAME's palette writes.
 */
#ifndef ROBOTRON_PALETTE_H
#define ROBOTRON_PALETTE_H

#include <stdint.h>
#include "sim/prng.h"

/* Williams palette byte (BBGGGRRR) to 0xRRGGBB, with MAME's gun levels. */
uint32_t palette_rgb(uint8_t b);

typedef struct {
    long slot;
    uint8_t color;
    Prng rng; /* cosmetic only, never the gameplay PRNG */
} CycleA;

void cycle_a_init(CycleA *c);
/* Colour of entry A at global frame `frame` (0xRRGGBB). */
uint32_t cycle_a_color(CycleA *c, unsigned long frame);

/* Colour of palette entry 0x0-0xF at `frame` if the ROM cycles it (A, B, D,
   E, F; js/core/ColorCycles.ts), else -1. */
long palette_cycle(int entry, unsigned long frame, CycleA *a);

#endif
