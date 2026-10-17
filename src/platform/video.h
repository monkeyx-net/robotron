#ifndef ROBOTRON_VIDEO_H
#define ROBOTRON_VIDEO_H

#include <stdbool.h>
#include "gfx/fb.h"

/* Fullscreen-desktop window (windowed if `windowed`), vsync, nearest scaling. */
bool video_init(bool windowed);
/* Upload the framebuffer and present it at the largest integer scale. */
void video_present(const Framebuffer *fb);
void video_shutdown(void);

#endif
