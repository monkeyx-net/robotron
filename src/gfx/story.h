/*
 * Attract-mode story pages, as js/core/AttractStory.ts: a bordered page under
 * the ROBOTRON: 2084 header, paragraphs typed out one letter every 2 frames,
 * held 240 frames, five pages. The last line cycles like palette entry A.
 * The first page also lists the controls.
 */
#ifndef ROBOTRON_STORY_H
#define ROBOTRON_STORY_H

#include "assets/assets.h"
#include "gfx/fb.h"
#include "gfx/palette.h"

typedef struct {
    int page;       /* 0..STORY_PAGES-1 */
    unsigned frames; /* updates since the page appeared */
} Story;

#define STORY_PAGES 5

void story_start(Story *s);
/* Advance one frame; returns 1 once the last page has finished. */
int story_step(Story *s);
/* Draw over the playfield border; `clock` is the global frame clock for colour cycling. */
void story_draw(Framebuffer *fb, const Assets *a, const Story *s, CycleA *cycle, unsigned long clock);

#endif
