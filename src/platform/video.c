#include "platform/video.h"

#include <SDL.h>

static SDL_Window *window;
static SDL_Renderer *renderer;
static SDL_Texture *texture;

bool video_init(bool windowed)
{
    SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY, "0"); /* nearest */

    Uint32 flags = windowed ? SDL_WINDOW_RESIZABLE : SDL_WINDOW_FULLSCREEN_DESKTOP;
    window = SDL_CreateWindow("Robotron: 2084", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                              FB_WIDTH * 3, FB_HEIGHT * 3, flags);
    if (!window) {
        SDL_Log("SDL_CreateWindow: %s", SDL_GetError());
        return false;
    }
    renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (!renderer) /* KMSDRM without GLES, or a dummy driver */
        renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_SOFTWARE);
    if (!renderer) {
        SDL_Log("SDL_CreateRenderer: %s", SDL_GetError());
        return false;
    }
    texture = SDL_CreateTexture(renderer, SDL_PIXELFORMAT_ARGB8888, SDL_TEXTUREACCESS_STREAMING,
                                FB_WIDTH, FB_HEIGHT);
    if (!texture) {
        SDL_Log("SDL_CreateTexture: %s", SDL_GetError());
        return false;
    }
    SDL_ShowCursor(SDL_DISABLE);
    return true;
}

void video_present(const Framebuffer *fb)
{
    SDL_UpdateTexture(texture, NULL, fb->px, FB_WIDTH * (int)sizeof(uint32_t));

    int out_w, out_h;
    SDL_GetRendererOutputSize(renderer, &out_w, &out_h);
    int scale = out_w / FB_WIDTH < out_h / FB_HEIGHT ? out_w / FB_WIDTH : out_h / FB_HEIGHT;
    if (scale < 1) scale = 1;
    SDL_Rect dst = { (out_w - FB_WIDTH * scale) / 2, (out_h - FB_HEIGHT * scale) / 2,
                     FB_WIDTH * scale, FB_HEIGHT * scale };

    SDL_SetRenderDrawColor(renderer, 0, 0, 0, 255);
    SDL_RenderClear(renderer);
    SDL_RenderCopy(renderer, texture, NULL, &dst);
    SDL_RenderPresent(renderer);
}

void video_shutdown(void)
{
    if (texture) SDL_DestroyTexture(texture);
    if (renderer) SDL_DestroyRenderer(renderer);
    if (window) SDL_DestroyWindow(window);
    texture = NULL;
    renderer = NULL;
    window = NULL;
}
