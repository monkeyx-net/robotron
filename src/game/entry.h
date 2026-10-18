/*
 * Initials entry after a qualifying score, as js/core/HighScoreEntry.ts:
 * GREAT SCORE, the score, ENTER YOUR INITIALS, then up/down cycles the
 * letter (A-Z . space) and confirm locks it in. Inputs are edge-triggered,
 * seeded with what is held when the screen opens; a held direction repeats
 * after 400 ms every 120 ms.
 */
#ifndef ROBOTRON_ENTRY_H
#define ROBOTRON_ENTRY_H

#include "assets/assets.h"
#include "gfx/fb.h"

#define ENTRY_MAX_LETTERS 20

typedef struct {
    int up, down, confirm;
} EntryInput;

typedef struct {
    unsigned score;
    int letters;
    int initials[ENTRY_MAX_LETTERS]; /* indices into "A-Z. " */
    int slot;
    EntryInput prev;
    int dir_held, held_frames, since_repeat;
    int done;
    char result[ENTRY_MAX_LETTERS + 1]; /* trailing spaces trimmed */
} Entry;

void entry_start(Entry *e, unsigned score, int letters, EntryInput held);
/* One frame; sets e->done when the last letter is locked in. */
void entry_step(Entry *e, EntryInput in);
void entry_draw(Framebuffer *fb, const Assets *a, const Entry *e, uint32_t border);

#endif
