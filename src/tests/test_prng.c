/*
 * PRNG golden test: src/sim/prng.c must reproduce the ROM's prng_update
 * ($D6CD). Uses the same fixture as `npm test`: DP $84/$85/$86 after each of
 * the first 1000 calls from a cold boot, captured in MAME.
 *
 *   ctest --test-dir build   (or: build/test_prng tests/fixtures/prng_golden.txt)
 */
#include <stdio.h>
#include "sim/prng.h"

int main(int argc, char **argv)
{
    if (argc < 2) {
        fprintf(stderr, "usage: %s prng_golden.txt\n", argv[0]);
        return 2;
    }
    FILE *f = fopen(argv[1], "r");
    if (!f) {
        perror(argv[1]);
        return 2;
    }

    Prng p;
    prng_reset(&p);
    unsigned a, hi, lo;
    int calls = 0, failures = 0;
    while (fscanf(f, "%x %x %x", &a, &hi, &lo) == 3) {
        uint8_t got = prng_step(&p);
        calls++;
        if (got != a || p.hi != hi || p.lo != lo) {
            if (failures++ < 5)
                fprintf(stderr, "call %d: expected %02X %02X %02X, got %02X %02X %02X\n",
                        calls, a, hi, lo, got, p.hi, p.lo);
        }
    }
    fclose(f);

    if (calls == 0) {
        fprintf(stderr, "PRNG golden test FAILED: no data in %s\n", argv[1]);
        return 1;
    }
    if (failures) {
        fprintf(stderr, "PRNG golden test FAILED: %d of %d calls differ\n", failures, calls);
        return 1;
    }
    printf("PRNG golden test passed: %d calls match the ROM\n", calls);
    return 0;
}
