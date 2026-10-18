/*
 * Sprite and rectangle drawing into the framebuffer, with the same pixel
 * coverage as the web build's GPU path: a pixel is drawn when its centre
 * falls inside the (possibly fractional, scaled) destination rectangle, and
 * samples the nearest texel. Tint multiplies like PixiJS (white * tint = tint).
 */
#ifndef ROBOTRON_BLIT_H
#define ROBOTRON_BLIT_H

#include <stdint.h>
#include "assets/png.h"
#include "gfx/fb.h"

/* Draw the sw x sh region at (sx, sy) of img with its top-left at (dx, dy),
   scaled by an integer factor and multiplied by tint (0xRRGGBB). */
void blit(Framebuffer *fb, const Image *img, int sx, int sy, int sw, int sh,
          double dx, double dy, int scale, uint32_t tint);

/* blit with sprite alpha (0..1) and, if `silhouette`, every opaque pixel drawn as tint. */
void blit_ex(Framebuffer *fb, const Image *img, int sx, int sy, int sw, int sh,
             double dx, double dy, int scale, uint32_t tint, double alpha, int silhouette);

/* Solid rectangle with fractional coordinates; colour 0xRRGGBB. */
void fill_rectf(Framebuffer *fb, double x, double y, double w, double h, uint32_t rgb);
/* The same blended at alpha (0..1). */
void fill_rectf_alpha(Framebuffer *fb, double x, double y, double w, double h, uint32_t rgb, double alpha);
/* Blend one pixel. */
void blend_pixel(Framebuffer *fb, int x, int y, uint32_t rgb, double alpha);

#endif
