/*
 * The user's Robotron ROM set (MAME `robotron`, Solid Blue), read only by the
 * extractor, from a folder or a zip. Files may use MAME's names or the old
 * 1996 names (robotron.sb1..).
 *
 * CPU map of the program ROMs: $0000-$8FFF = 12 x 4 KB banks 1-9 (under
 * video RAM), $D000-$FFFF = banks 10-12.
 */
#ifndef ROBOTRON_ROM_H
#define ROBOTRON_ROM_H

#include <stdint.h>

typedef struct {
    uint8_t prog[12][4096];
    int loaded;
} RomSet;

/* Load all 12 program ROMs from a folder or a zip (robotron.zip). Returns 0, or -1 with a message in err. */
int rom_load(RomSet *rom, const char *src, char *err, int errlen);
/* Byte at a CPU address in program ROM ($0000-$8FFF, $D000-$FFFF); -1 elsewhere. */
int rom_byte(const RomSet *rom, unsigned addr);

#endif
