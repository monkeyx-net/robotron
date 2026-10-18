/*
 * Saved state: operator settings, the high score, ROBOTRON HEROES and ALL
 * TIME HEROES rows (the web build keeps these in localStorage). One text file, written to a
 * temp file and renamed so a power-off mid-write keeps the old one.
 *
 * Directory: $ROBOTRON_SAVE_DIR, else $XDG_DATA_HOME/robotron, else (Windows)
 * %APPDATA%/robotron, else ~/.local/share/robotron.
 */
#ifndef ROBOTRON_STORAGE_H
#define ROBOTRON_STORAGE_H

#include "assets/assets.h"
#include "sim/world.h"

#define SAVE_MAX_ROWS 64

typedef struct {
    OperatorSettings op;  /* factory settings when none are saved */
    unsigned high_score;
    HeroRow heroes[SAVE_MAX_ROWS];
    int hero_count;
    HeroRow all_time[SAVE_MAX_ROWS];
    int all_time_count;
} SaveData;

/* Missing or unreadable file: an empty SaveData. */
void storage_load(SaveData *d);
/* Returns 0 on success. */
int storage_save(const SaveData *d);
/* The save file's path (for messages). */
const char *storage_path(void);

#endif
