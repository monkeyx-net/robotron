/*
 * The two heroes tables, as js/core/HighScoreEntry.ts: ROBOTRON HEROES is
 * always 10 rows, topped up from the ROM's factory list; ALL TIME HEROES is
 * always 37 rows, padded with 10000s without initials. A score beating the
 * last row of either table earns initials and goes into every table it beats.
 */
#ifndef ROBOTRON_HISCORE_H
#define ROBOTRON_HISCORE_H

#include "game/storage.h"
#include "gfx/heroes.h"

/* Build the displayed tables from the save data and the ROM list. */
void hiscore_tables(const SaveData *d, const Assets *a, HeroTables *t);
int hiscore_qualifies(const HeroTables *t, unsigned score);
/* Would this score take the all-time #1 spot? */
int hiscore_is_new_top(const HeroTables *t, unsigned score);
/* Put a scored entry into every table it beats (updates save data). */
void hiscore_insert(SaveData *d, const Assets *a, const char *initials, unsigned score);

#endif
