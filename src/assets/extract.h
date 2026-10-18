/*
 * Extractor: reads the user's ROM set and writes the game's data tables as
 * plain text under <out>/data/. The game reads only these files, never the
 * ROM (SDL2_PORT_PLAN.md, decision 1).
 *
 *   heroes.txt  ROBOTRON HEROES factory list, $E495: 10 x (3 ASCII initials,
 *               4-byte BCD score)
 *   waves.txt   per-wave counts, $2E24: 9 tables x 40 waves (grunts,
 *               electrodes, mommies, daddies, mikeys, hulks, brains,
 *               spheroids, quarks)
 *   waveparams.txt  12 per-wave timer tables ($2C20, header/min/max/40 waves)
 *                   and the waves 1-4 mercy table ($2B59)
 *   electrodes.txt  electrode look per wave ($2A4B, shapes from [$3886])
 */
#ifndef ROBOTRON_EXTRACT_H
#define ROBOTRON_EXTRACT_H

#include "assets/rom.h"

int extract_all(const RomSet *rom, const char *out_dir, char *err, int errlen);

#endif
