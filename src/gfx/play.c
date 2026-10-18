#include "gfx/play.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

#include "gfx/blit.h"
#include "gfx/font.h"
#include "gfx/title.h"

/* HUD layout (ArcadeHud.ts, from MAME) */
static const int SCORE_RIGHT[2] = { 83, 211 };
static const int ICONS_X[2] = { 86, 214 };
#define WAVE_LEFT_P2 160
#define WAITING_RED 0xFF0000u
#define ICON_PITCH 8
#define MAX_ICONS 7
#define HUD_TOP_Y 7
#define HUD_BOTTOM_Y 231
#define WAVE_RIGHT_P1 126
#define WAVE_LABEL_X 134
static const char *const LIFE_ICON[7] = { ".ooo.", "BB.BB", "BB.BB", "..o..", "gg.gg", "m.g.m", ".g.g." };

#define SHOT_COLOR 0xFFFF00u
#define SHIELD_COLOR 0x00FFFFu
#define GAME_OVER_TINT 0xAEFF00u
#define GAME_OVER_X 118
#define GAME_OVER_Y 121

/* WaveTransition.ts rings */
#define RING_SPAWN_START 2
#define RING_SPAWN_END 32
#define RING_GROWTH 3.8
#define RING_START_HALF_W 30
#define FLASH_START 54
#define FLASH_END 60
#define STAR_FRAMES 20
#define STAR_SPREAD 20

typedef struct {
    const AtlasFrame *player[12], *grunt[3], *human[3][12];
    const AtlasFrame *hulk[9], *spheroid[8], *enforcer[6], *spark[4], *brain[12], *tank[4], *quark[3];
    const Assets *assets;
} Frames;

static Frames frames;

static const AtlasFrame *frame_named(const Assets *a, const char *family, int i)
{
    char name[32];
    snprintf(name, sizeof name, "%s_%d", family, i);
    return atlas_frame(&a->atlas, name);
}

static void load_frames(const Assets *a)
{
    if (frames.assets == a) return;
    frames.assets = a;
    static const char *const fam[3] = { "mommy", "daddy", "mikey" };
    for (int i = 0; i < 12; i++) {
        frames.player[i] = frame_named(a, "player", i);
        for (int k = 0; k < 3; k++) frames.human[k][i] = frame_named(a, fam[k], i);
    }
    for (int i = 0; i < 3; i++) frames.grunt[i] = frame_named(a, "grunt", i);
    for (int i = 0; i < 9; i++) frames.hulk[i] = frame_named(a, "hulk", i);
    for (int i = 0; i < 8; i++) frames.spheroid[i] = frame_named(a, "spheroid", i);
    for (int i = 0; i < 6; i++) frames.enforcer[i] = frame_named(a, "enforcer_spawn", i);
    for (int i = 0; i < 4; i++) frames.spark[i] = frame_named(a, "spark", i);
    for (int i = 0; i < 12; i++) frames.brain[i] = frame_named(a, "brain", i);
    for (int i = 0; i < 4; i++) frames.tank[i] = frame_named(a, "tank", i);
    for (int i = 0; i < 3; i++) frames.quark[i] = frame_named(a, "quark", i);
}

/* A centre-anchored sprite. */
static void sprite(Framebuffer *fb, const Assets *a, const AtlasFrame *f, double cx, double cy,
                   uint32_t tint, double alpha, int silhouette)
{
    if (!f) return;
    blit_ex(fb, &a->atlas.image, f->x, f->y, f->w, f->h, cx - f->w / 2.0, cy - f->h / 2.0, 1, tint, alpha,
            silhouette);
}

/* One beam-in slice set: rows, columns or pixels of a sprite spread about its centre. */
static void beam_sprite(Framebuffer *fb, const Assets *a, const AtlasFrame *f, double cx, double cy,
                        int mode, double spread)
{
    if (!f) return;
    int cells_x = mode == 0 ? 1 : f->w, cells_y = mode == 1 ? 1 : f->h;
    int cw = mode == 0 ? f->w : 1, ch = mode == 1 ? f->h : 1;
    for (int j = 0; j < cells_y; j++)
        for (int i = 0; i < cells_x; i++) {
            double hx = -f->w / 2.0 + (mode == 0 ? 0 : i), hy = -f->h / 2.0 + (mode == 1 ? 0 : j);
            double sx = mode == 0 ? hx : hx * spread, sy = mode == 1 ? hy : hy * spread;
            double gx = cx + sx, gy = cy + sy;
            if (gy < PF_TOP - 2 || gy > PF_BOTTOM + 2 || gx < PF_LEFT - 2 || gx > PF_RIGHT + 2) continue;
            blit(fb, &a->atlas.image, f->x + (mode == 0 ? 0 : i), f->y + (mode == 1 ? 0 : j), cw, ch, gx, gy, 1,
                 0xFFFFFF);
        }
}

static void electrode(Framebuffer *fb, const ElectrodeFrame *f, double cx, double cy, uint32_t tint)
{
    for (int y = 0; y < f->h; y++)
        for (int x = 0; x < f->w; x++)
            if (f->rows[y][x] == '#') fill_rectf(fb, cx - f->w / 2.0 + x, cy - f->h / 2.0 + y, 1, 1, tint);
}

static void particle(Framebuffer *fb, const Particle *p)
{
    double r = p->size * p->scale;
    int x0 = (int)floor(p->x - r - 1), x1 = (int)ceil(p->x + r + 1);
    int y0 = (int)floor(p->y - r - 1), y1 = (int)ceil(p->y + r + 1);
    double c = cos(-p->rotation), s = sin(-p->rotation);
    for (int y = y0; y <= y1; y++)
        for (int x = x0; x <= x1; x++) {
            double lx = x + 0.5 - p->x, ly = y + 0.5 - p->y;
            int inside;
            if (p->ring == 0) { /* diamond, rotated */
                double rx = lx * c - ly * s, ry = lx * s + ly * c;
                inside = fabs(rx) + fabs(ry) <= r;
            } else {
                inside = lx * lx + ly * ly <= r * r;
            }
            if (inside) blend_pixel(fb, x, y, p->color, p->alpha);
        }
}

/* ArcadeHud: the player whose turn it is in entry A, the waiting player's score in red */
static void hud(Framebuffer *fb, const World *w, uint32_t a_color, uint32_t b_color)
{
    const Assets *as = w->assets;
    char text[32];
    for (int p = 0; p < w->player_count; p++) {
        int active = p == w->current;
        unsigned score = active ? w->score : w->slots[p].score;
        int lives = active ? w->lives : w->slots[p].lives;
        int wave = active ? w->wave : w->slots[p].wave;
        snprintf(text, sizeof text, "%02u", score);
        font_draw_t(fb, as, FONT_ALT, text, SCORE_RIGHT[p] - font_measure_t(as, FONT_ALT, text, 0), HUD_TOP_Y, 1, 0,
                    active ? a_color : WAITING_RED);
        int men = lives - 1;
        if (men > MAX_ICONS) men = MAX_ICONS;
        for (int i = 0; i < men; i++)
            for (int y = 0; y < 7; y++)
                for (int x = 0; x < 5; x++) {
                    char c = LIFE_ICON[y][x];
                    uint32_t col = c == 'o' ? 0xFF5100u : c == 'g' ? 0x8989A0u : c == 'm' ? 0xFF00FFu : b_color;
                    if (c != '.') fill_rectf(fb, ICONS_X[p] + i * ICON_PITCH + x, HUD_TOP_Y + y, 1, 1, col);
                }
        snprintf(text, sizeof text, "%d", wave);
        double wx = p == 0 ? WAVE_RIGHT_P1 - font_measure_t(as, FONT_MAIN, text, 0) : WAVE_LEFT_P2;
        font_draw_t(fb, as, FONT_MAIN, text, wx, HUD_BOTTOM_Y, 1, 0, a_color);
    }
    font_draw_t(fb, as, FONT_MAIN, "WAVE", WAVE_LABEL_X, HUD_BOTTOM_Y, 1, 0, a_color);
}

/* PIXI.Color from {h, s: 100, v} */
static uint32_t hsv(double h, double v)
{
    h = h / 360.0 * 6;
    v /= 100.0;
    int hh = (int)floor(h);
    double b = 0, c = v * (1 - (h - hh)), d = v * (1 - (1 - h + hh));
    double rgb[6][3] = { { v, d, b }, { c, v, b }, { b, v, d }, { b, c, v }, { d, b, v }, { v, b, c } };
    const double *o = rgb[hh % 6];
    return (uint32_t)lround(o[0] * 255) << 16 | (uint32_t)lround(o[1] * 255) << 8 | (uint32_t)lround(o[2] * 255);
}

static uint32_t ring_color(int i, int frame)
{
    double hue = (frame - 16) * 7 > 0 ? (frame - 16) * 7 : 0;
    hue += i * 1.5 + (i % 3) * 14;
    return hsv(hue < 245 ? hue : 245, i % 2 ? 100 : 80);
}

/* 2 px stroke centred on the rect outline */
static void stroke_rect(Framebuffer *fb, double x, double y, double w, double h, uint32_t c)
{
    fill_rectf(fb, x - 1, y - 1, w + 2, 2, c);
    fill_rectf(fb, x - 1, y + h - 1, w + 2, 2, c);
    fill_rectf(fb, x - 1, y - 1, 2, h + 2, c);
    fill_rectf(fb, x + w - 1, y - 1, 2, h + 2, c);
}

static void wave_clear_fx(Framebuffer *fb, int frame)
{
    const double x0 = BORDER_X0, y0 = BORDER_Y0, x1 = BORDER_X1, y1 = BORDER_Y1;
    const double cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, max_hw = (x1 - x0) / 2, max_hh = (y1 - y0) / 2;
    if (frame < FLASH_START) {
        int end = frame + 1 < RING_SPAWN_END ? frame + 1 : RING_SPAWN_END;
        for (int born = RING_SPAWN_START; born < end; born++) {
            int age = frame - born;
            double hw = RING_START_HALF_W + age * RING_GROWTH, hh = age * RING_GROWTH;
            if (hw > max_hw || hh > max_hh) continue;
            stroke_rect(fb, cx - hw, cy - hh, hw * 2, hh * 2 > 1 ? hh * 2 : 1, ring_color(born - RING_SPAWN_START, frame));
        }
    } else if (frame < FLASH_END) {
        double down = (y1 - y0) * (frame - FLASH_START) / (double)(FLASH_END - FLASH_START);
        fill_rectf(fb, x0, y0, x1 - x0, 2, 0xFF0000);
        fill_rectf(fb, x0, y0, 2, down, 0xFF0000);
        fill_rectf(fb, x1 - 2, y0, 2, down, 0xFF0000);
    }
}

void play_draw(Framebuffer *fb, const World *w, CycleA *cycle, unsigned long clock)
{
    const Assets *a = w->assets;
    load_frames(a);
    fb_clear(fb, 0xFF000000u);

    /* obstacles: electrodes and the dying ones */
    const ElectrodeLook *look = world_electrode_look(w);
    for (int i = 0; i < w->electrode_count; i++)
        electrode(fb, &look->frames[0], w->electrodes[i].x, w->electrodes[i].y, w->electrode_tint);
    for (int i = 0; i < w->dying_count; i++) {
        const DyingElectrode *d = &w->dying[i];
        electrode(fb, &look->frames[d->frame < look->nframes ? d->frame : 0], d->x, d->y, w->electrode_tint);
    }

    /* humans; progs as silhouettes in entry A over afterimages in entry E */
    uint32_t a_color = cycle_a_color(cycle, clock);
    long e_cycle = palette_cycle(0xE, clock, cycle);
    uint32_t e_color = e_cycle >= 0 ? (uint32_t)e_cycle : 0xFF00FF;
    for (int i = 0; i < w->human_count; i++) {
        const Human *h = &w->humans[i];
        if (!h->prog) {
            sprite(fb, a, frames.human[h->kind][h->frame], h->x, h->y, 0xFFFFFF, 1, 0);
            continue;
        }
        for (int t = 0; t < h->trail_len; t++)
            sprite(fb, a, frames.human[h->kind][h->trail[t].frame], h->trail[t].x, h->trail[t].y, e_color, 1, 1);
        sprite(fb, a, frames.human[h->kind][h->frame], h->x, h->y, a_color, 1, 1);
    }

    /* enemies, with any beam-in in progress */
    /* the spheroid's shimmer: the atlas bakes its cycling pixels near-white */
    static const uint32_t SHIMMER[4] = { 0xFF2222, 0xFF8822, 0xFFFF44, 0xFFFFFF };
    for (int i = 0; i < w->enemy_count; i++) {
        const Enemy *e = &w->enemies[i];
        const AtlasFrame *f;
        uint32_t tint = 0xFFFFFF;
        switch (e->kind) {
        case EN_HULK: f = frames.hulk[e->frame % 9]; break;
        case EN_SPHEROID:
            f = frames.spheroid[e->frame % 8];
            tint = SHIMMER[(int)floor(e->pulse * 4) % 4];
            break;
        case EN_ENFORCER: f = frames.enforcer[e->frame % 6]; break;
        case EN_BRAIN: f = frames.brain[e->frame % 12]; break;
        case EN_TANK: f = frames.tank[e->frame % 4]; break;
        case EN_QUARK: f = frames.quark[e->frame % 3]; break;
        default: f = frames.grunt[e->frame % 3]; break;
        }
        if (e->visible) {
            sprite(fb, a, f, e->x, e->y, tint, 1, 0);
        } else if (w->state == W_BEAM_IN && !w->beams[i].done) {
            const Beam *b = &w->beams[i];
            double p = (w->t_frame - b->delay) / b->dur;
            if (p >= 0 && p < 1)
                beam_sprite(fb, a, f, e->x, e->y, b->horizontal ? 1 : 0, 1 + (b->spread - 1) * (1 - p));
        }
    }

    /* player shots: 2 x 4 yellow */
    for (int i = 0; i < w->shot_count; i++) fill_rectf(fb, w->shots[i].x - 1, w->shots[i].y - 2, 2, 4, SHOT_COLOR);
    long d_cycle = palette_cycle(0xD, clock, cycle);
    uint32_t d_color = d_cycle >= 0 ? (uint32_t)d_cycle : 0xFFFFFF;
    for (int i = 0; i < w->eshot_count; i++) {
        const EnemyShot *es = &w->eshots[i];
        if (es->kind == ES_SPARK) {
            sprite(fb, a, frames.spark[es->frame % 4], es->x, es->y, 0xFFFFFF, 1, 0);
        } else if (es->kind == ES_MISSILE) {
            for (int t = 0; t < es->trail_len; t++) fill_rectf(fb, es->trail[t][0], es->trail[t][1], 2, 2, d_color);
            fill_rectf(fb, es->x, es->y, 2, 2, a_color);
        } else {
            for (int y = -5; y <= 5; y++)
                for (int x = -5; x <= 5; x++) {
                    int px = (int)floor(es->x) + x, py = (int)floor(es->y) + y;
                    double dx = px + 0.5 - es->x, dy = py + 0.5 - es->y;
                    if (dx * dx + dy * dy <= 16 && px >= 0 && py >= 0 && px < FB_WIDTH && py < FB_HEIGHT)
                        fb->px[py][px] = 0xFF888888u;
                }
        }
    }

    /* player, its shield, the starburst and the death beat */
    const Player *pl = &w->player;
    const AtlasFrame *pf = frames.player[pl->frame];
    if (pl->visible) {
        sprite(fb, a, pf, pl->x, pl->y, 0xFFFFFF, pl->alpha, 0);
        if (pl->shield) {
            double al = 0.25 * pl->alpha;
            for (int y = -11; y <= 11; y++)
                for (int x = -11; x <= 11; x++) {
                    double px = floor(pl->x) + x + 0.5 - pl->x, py = floor(pl->y) + y + 0.5 - pl->y;
                    if (px * px + py * py <= 100) blend_pixel(fb, (int)floor(pl->x) + x, (int)floor(pl->y) + y, SHIELD_COLOR, al);
                }
        }
    } else if (w->state == W_BEAM_IN && w->star_start >= 0) {
        double p = (w->t_frame - w->star_start) / (double)STAR_FRAMES;
        if (p > 1) p = 1;
        beam_sprite(fb, a, pf, pl->x, pl->y, 2, 1 + (STAR_SPREAD - 1) * (1 - p));
    }
    if (w->beat_active && w->beat_visible)
        sprite(fb, a, frames.player[w->beat_frame], w->beat_x, w->beat_y, w->beat_color, 1, 1);

    /* effects: explosions and score popups */
    for (int i = 0; i < w->particle_count; i++) particle(fb, &w->particles[i]);
    for (int i = 0; i < w->popup_count; i++) {
        const Popup *p = &w->popups[i];
        char text[16];
        snprintf(text, sizeof text, "%u", p->points);
        double x = floor(p->x - font_measure(a, FONT_MAIN, text) / 2.0 + 0.5);
        double y = floor(p->y - font_line_height(a, FONT_MAIN) / 2.0 + 0.5);
        font_draw(fb, a, FONT_MAIN, text, x, y, 1, 0xFFFFFF);
    }

    if (w->border_visible) playfield_border(fb, w->border_color);

    if (w->hud_visible) {
        long bc = palette_cycle(0xB, clock, cycle);
        hud(fb, w, a_color, bc >= 0 ? (uint32_t)bc : 0x0000FF);
    }

    if (w->state == W_WAVE_CLEAR) wave_clear_fx(fb, w->t_frame);

    if (w->inter_frames > 0) { /* TwoPlayer.showInterstitial */
        char text[24];
        snprintf(text, sizeof text, "PLAYER %d", w->current + 1);
        font_draw(fb, a, FONT_ALT, text, (FB_WIDTH - font_measure(a, FONT_ALT, text)) / 2.0, FB_HEIGHT / 2 - 4, 1, 0xFFFF44);
    }

    if (w->state == W_GAME_OVER) {
        if (w->go_text) font_draw(fb, a, FONT_MAIN, "GAME OVER", GAME_OVER_X, GAME_OVER_Y, 1, GAME_OVER_TINT);
        if (w->go_erase_x > 0) fill_rectf(fb, w->go_erase_x, 0, FB_WIDTH - w->go_erase_x, FB_HEIGHT, 0x000000);
    }
}
