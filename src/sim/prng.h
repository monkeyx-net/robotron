/*
 * Arcade PRNG: port of the ROM's prng_update ($D6CD), same as js/core/Prng.ts.
 * State is DP[$84] (accumulator), DP[$85] (hi), DP[$86] (lo).
 */
#ifndef ROBOTRON_PRNG_H
#define ROBOTRON_PRNG_H

#include <stdint.h>

typedef struct {
    uint8_t accum; /* DP[$84] */
    uint8_t hi;    /* DP[$85] */
    uint8_t lo;    /* DP[$86] */
} Prng;

/* ROM power-on seed $A55A (main_game_entry). */
void prng_reset(Prng *p);

/* Set the three state bytes (side streams are seeded this way). */
void prng_seed(Prng *p, uint8_t accum, uint8_t hi, uint8_t lo);

/* One call of prng_update; returns DP[$84]. */
uint8_t prng_step(Prng *p);

/* 0..n-1, steps the generator (prng_bounded, $D042). */
int prng_bounded(Prng *p, int n);

#endif
