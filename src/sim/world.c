#include "sim/world.h"

#include <math.h>
#include <string.h>

#include "sim/spawn.h"

#define FRAME_MS (1000.0 / 60.0)
#define PROJECTILE_SPEED 4
#define SHOOT_RATE_MS 100
#define RESPAWN_INVULNERABILITY_MS 2000
#define INITIAL_BONUS 1000
#define MAX_BONUS 5000
#define BONUS_STEP 1000
#define INTERSTITIAL_FRAMES 108 /* "PLAYER N", 1.8 s */
#define POINTS_GRUNT 100
#define POINTS_SPHEROID 1000
#define POINTS_ENFORCER 150
#define POINTS_SPARK 25

/* enemies.ts process cadences (MAME) */
#define SPHEROID_CYCLE_FRAMES 10
#define SPHEROID_DROP_CYCLE_FRAMES 16
#define SPHEROID_EXIT_SPEED 2
#define SPHEROID_SPEED 0.7
#define ENFORCER_MATERIALIZE_FRAMES 40
#define ENFORCER_PASS_FRAMES 3
#define SPARK_PASS_FRAMES 4
#define MAX_ENFORCERS 8
#define MAX_SPARKS 20
#define POINTS_BRAIN 500
#define POINTS_TANK 200
#define POINTS_QUARK 1000
#define POINTS_PROG 100
#define POINTS_MISSILE 25
#define POINTS_SHELL 25
#define QUARK_CYCLE_FRAMES 15
#define QUARK_PASS_FRAMES 3
#define QUARK_EXIT_SPEED 2
#define TANK_PASS_FRAMES 2
#define TANK_MATERIALIZE_FRAMES 48
#define TANK_SHELL_BOUNCES 2
#define MAX_MISSILES 8
#define MAX_TANKS 20
#define MAX_SHELLS 21
#define MISSILE_PASS_FRAMES 2
#define MISSILE_TRAIL 8
/* $20C7 bounds on the missile head's top-left: x bytes 7..$8E, y $18..$EA */
#define MISSILE_X0 (2 * 0x07 - 6)
#define MISSILE_X1 (2 * 0x8E - 6)
#define MISSILE_Y0 (0x18 - 7)
#define MISSILE_Y1 (0xEA - 7)
#define PROG_PASS_FRAMES 3
#define PROG_STEP 4
#define PROG_TRAIL 6
static const int PROG_WALK[4] = { 0, 1, 0, 2 };
/* Brain frames ($1CA2-$1CBA): left, right, down, up */
static const int BRAIN_WALK[4][4] = { { 0, 1, 0, 2 }, { 3, 4, 3, 5 }, { 6, 7, 6, 8 }, { 9, 10, 9, 11 } };

/* Hulk direction tables ($01CC-$01F3): [record, dx px, dy lines]; up reuses the down frames */
static const int HULK_WALK[4][4][3] = {
    { { 0, -3, 0 }, { 1, -4, 0 }, { 0, -3, 0 }, { 2, -4, 0 } },  /* left */
    { { 3, 3, 0 }, { 4, 4, 0 }, { 3, 3, 0 }, { 5, 4, 0 } },      /* right */
    { { 6, 0, 2 }, { 7, 0, 2 }, { 6, 0, 2 }, { 8, 0, 2 } },      /* down */
    { { 6, 0, -2 }, { 7, 0, -2 }, { 6, 0, -2 }, { 8, 0, -2 } },  /* up */
};
enum { HW_LEFT, HW_RIGHT, HW_DOWN, HW_UP };
/* records -> atlas frames (the atlas keeps source-address order) */
static const int HULK_ATLAS[9] = { 0, 1, 2, 6, 7, 8, 3, 4, 5 };
#define POPUP_FRAMES 90

/* WaveTransition.ts */
#define FLASH_START 54
#define FLASH_END 60
#define SPAWN_AT 66
#define BEAM_DELAY_MAX 30
#define BEAM_DUR_MIN 10
#define BEAM_DUR_MAX 18
#define BEAM_SPREAD_MIN 10
#define BEAM_SPREAD_MAX 20
#define BEAM_HORIZONTAL_CHANCE 0.25
#define STAR_FRAMES 20

/* DeathBeat.ts */
#define BEAT_FIRST_FRAMES 2
#define BEAT_FLASHES 10
#define BEAT_FLASH_FRAMES 6
#define BEAT_FADE_FRAMES 4
#define BEAT_DONE_AT 104
static const int BEAT_FLASH_ENTRIES[4] = { 0x0, 0x1, 0x3, 0x7 };
static const uint8_t BEAT_FADE[7] = { 0xFF, 0xF6, 0xAD, 0xA4, 0x5B, 0x52, 0x09 };

/* ui.ts game over */
#define GO_DEATH_FRAMES 120
#define GO_TEXT_FRAMES 120
static const int ERASE_FROM_X[6] = { 284, 272, 216, 158, 104, 46 };

/* Player walk sequences, ROM $6FFC-$7030: left, right, down, up */
static const int PLAYER_WALK[4][4] = { { 0, 1, 0, 2 }, { 3, 4, 3, 5 }, { 6, 7, 6, 8 }, { 9, 10, 9, 11 } };

/* Human walk tables, ROM $425F: [frame, dx, dy] x 4, sides then diagonals */
#define HUMAN_STEP_FRAMES 8
static const int HUMAN_WALK[8][4][3] = {
    { { 0, -2, 0 }, { 1, -1, 0 }, { 0, -2, 0 }, { 2, -1, 0 } },
    { { 3, 2, 0 }, { 4, 1, 0 }, { 3, 2, 0 }, { 5, 1, 0 } },
    { { 6, 0, 1 }, { 7, 0, 1 }, { 6, 0, 1 }, { 8, 0, 1 } },
    { { 9, 0, -1 }, { 10, 0, -1 }, { 9, 0, -1 }, { 11, 0, -1 } },
    { { 0, -2, -1 }, { 2, -1, -1 }, { 0, -2, -1 }, { 2, -1, -1 } },
    { { 3, 2, -1 }, { 4, 1, -1 }, { 3, 2, -1 }, { 5, 1, -1 } },
    { { 3, 2, 1 }, { 4, 1, 1 }, { 3, 2, 1 }, { 5, 1, 1 } },
    { { 0, -2, 1 }, { 1, -1, 1 }, { 0, -2, 1 }, { 2, -1, 1 } },
};

/* ArcadeBorder.ts: per-wave styles on a 10-wave cycle */
typedef struct { int kind; int n; uint32_t colors[10]; } BorderStyle; /* 0 solid, 1 flicker, 2 cycle */
static const BorderStyle BORDER_STYLES[10] = {
    { 0, 1, { 0xFF5100 } },
    { 0, 1, { 0xFFFF00 } },
    { 0, 1, { 0xFF0000 } },
    { 1, 10, { 0xFF005F, 0xFF00A0, 0xFF00FF, 0xD900FF, 0xAE00FF, 0x8900FF, 0x7600FF, 0x5100FF, 0x2600FF, 0xFF0000 } },
    { 0, 1, { 0x0000FF } },
    { 0, 1, { 0xFF00FF } },
    { 0, 1, { 0xFF7600 } },
    { 0, 1, { 0x8989A0 } },
    { 0, 1, { 0x000000 } },
    { 2, 10, { 0x00FFFF, 0x51FF5F, 0xAEAE00, 0xFF7600, 0xFF2600, 0xAE0000, 0x760000, 0x260000, 0x0000FF, 0x0089FF } },
};
#define BORDER_STEP_FRAMES 6

/* ---- helpers ------------------------------------------------------------ */

static void sfx(World *w, SoundId id)
{
    if (w->state == W_DEMO) return; /* canPlaySound: the demo is silent */
    if (w->sound_count < (int)(sizeof w->sounds / sizeof w->sounds[0])) w->sounds[w->sound_count++] = id;
}

static double fx_float(World *w)
{
    int hi = prng_step(&w->fx), lo = prng_step(&w->fx);
    return (double)(hi << 8 | lo) / 65536.0;
}

static double js_round(double v) { return floor(v + 0.5); }

/* isColliding: centre distance within tolerance (both visible). */
static int near(double ax, double ay, double bx, double by, double tol)
{
    double dx = ax - bx, dy = ay - by;
    return sqrt(dx * dx + dy * dy) <= tol;
}

static void clamp_to_playfield(double *x, double *y, double hw, double hh)
{
    if (*x < PF_LEFT + hw) *x = PF_LEFT + hw;
    if (*x > PF_RIGHT - hw) *x = PF_RIGHT - hw;
    if (*y < PF_TOP + hh) *y = PF_TOP + hh;
    if (*y > PF_BOTTOM - hh) *y = PF_BOTTOM - hh;
}

#define REMOVE_AT(arr, count, i) \
    do { memmove(&(arr)[i], &(arr)[(i) + 1], sizeof (arr)[0] * (size_t)((count) - (i) - 1)); (count)--; } while (0)

const ElectrodeLook *world_electrode_look(const World *w)
{
    int i = w->wave < 1 ? 0 : (w->wave - 1) % 10;
    return &w->assets->electrodes[i];
}

/* Graphics bounds of the resting electrode frame: the lit pixels' box. */
static void electrode_extent(const World *w, double *hw, double *hh)
{
    const ElectrodeFrame *f = &world_electrode_look(w)->frames[0];
    int x0 = 99, x1 = -1, y0 = 99, y1 = -1;
    for (int y = 0; y < f->h; y++)
        for (int x = 0; x < f->w; x++)
            if (f->rows[y][x] == '#') {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
    *hw = x1 >= x0 ? (x1 - x0 + 1) / 2.0 : 4;
    *hh = y1 >= y0 ? (y1 - y0 + 1) / 2.0 : 4;
}

static void human_size(const World *w, HumanKind k, double *hw, double *hh)
{
    *hw = w->human_w[k] / 2.0;
    *hh = w->human_h[k] / 2.0;
}

static void human_extent(const World *w, const Human *h, double *hw, double *hh)
{
    human_size(w, h->kind, hw, hh);
}

/* ---- effects -------------------------------------------------------------- */

static void explosion(World *w, double x, double y, uint32_t color)
{
    for (int ring = 0; ring < 2; ring++) {
        double ring_speed = ring == 0 ? 3 : 2, ring_life = ring == 0 ? 15 : 25;
        for (int i = 0; i < 16; i++) {
            if (w->particle_count == MAX_PARTICLES) return;
            Particle *p = &w->particles[w->particle_count++];
            p->ring = ring;
            p->color = color;
            p->size = ring == 0 ? fx_float(w) * 2 + 2 : fx_float(w) * 1.5 + 1;
            p->x = x;
            p->y = y;
            double angle = i / 16.0 * 2 * M_PI + (fx_float(w) - 0.5) * 0.5;
            double speed = ring_speed + fx_float(w);
            p->vx = cos(angle) * speed;
            p->vy = sin(angle) * speed;
            p->life = ring_life + fx_float(w) * 10;
            p->max_life = p->life;
            p->rotation = fx_float(w) * 2 * M_PI;
            p->rotation_speed = (fx_float(w) - 0.5) * 0.2;
            p->alpha = 1;
            p->scale = 1;
        }
    }
}

static void update_particles(World *w)
{
    for (int i = w->particle_count - 1; i >= 0; i--) {
        Particle *p = &w->particles[i];
        p->vx *= 0.98;
        p->vy *= 0.98;
        p->x += p->vx;
        p->y += p->vy;
        double pct = p->life / p->max_life;
        p->alpha = pct * 2 < 1 ? pct * 2 : 1;
        p->rotation += p->rotation_speed;
        p->scale = 0.8 + pct * 0.2;
        p->life -= 1;
        if (p->life <= 0) REMOVE_AT(w->particles, w->particle_count, i);
    }
}

static void popup(World *w, double x, double y, unsigned points)
{
    if (w->popup_count == MAX_POPUPS) return;
    Popup *p = &w->popups[w->popup_count++];
    p->x = x;
    p->y = y;
    p->points = points;
    p->frames = 0;
}

static void update_popups(World *w)
{
    for (int i = w->popup_count - 1; i >= 0; i--)
        if (++w->popups[i].frames >= POPUP_FRAMES) REMOVE_AT(w->popups, w->popup_count, i);
}

/* ---- border --------------------------------------------------------------- */

static void border_set_wave(World *w, int wave)
{
    const BorderStyle *s = &BORDER_STYLES[((wave < 1 ? 1 : wave) - 1) % 10];
    w->border_wave = wave;
    w->border_frames = 0;
    w->border_step = -1;
    w->border_color = s->colors[0];
}

static void border_tick(World *w)
{
    const BorderStyle *s = &BORDER_STYLES[((w->border_wave < 1 ? 1 : w->border_wave) - 1) % 10];
    if (s->kind == 0) return;
    int step = ++w->border_frames / BORDER_STEP_FRAMES;
    if (step == w->border_step) return;
    w->border_step = step;
    w->border_color = s->kind == 2 ? s->colors[step % s->n] : s->colors[(int)(fx_float(w) * s->n)];
}

/* ---- scoring -------------------------------------------------------------- */

static void check_extra_life(World *w)
{
    if (w->state != W_PLAYING || w->extra_man_every <= 0) return;
    if (w->score >= w->next_extra) {
        w->lives++;
        w->next_extra += (unsigned)w->extra_man_every;
        sfx(w, SND_EXTRA_LIFE);
    }
}

static void add_score(World *w, unsigned points)
{
    w->score += points;
    check_extra_life(w);
    pacing_note_score(&w->pacing);
}

/* ---- entities --------------------------------------------------------------- */

static void clear_entities(World *w, int clear_humans)
{
    w->shot_count = 0;
    w->eshot_count = 0;
    w->enemy_count = 0;
    if (clear_humans) w->human_count = 0;
    w->electrode_count = 0;
    w->dying_count = 0;
    w->particle_count = 0;
    w->popup_count = 0;
}

static void human_rehome(World *w, Human *h)
{
    h->walk_steps = (prng_step(w->prng) & 0x7F) + 1;
    h->walk_table = prng_step(w->prng) & 7;
    h->walk_idx = 0;
    h->frame = HUMAN_WALK[h->walk_table][0][0];
}

static Human *create_human(World *w, HumanKind k)
{
    if (w->human_count == MAX_HUMANS) return NULL;
    Human *h = &w->humans[w->human_count++];
    memset(h, 0, sizeof *h);
    h->id = ++w->next_human_id;
    h->kind = k;
    h->frame = 6;
    /* ROM spawn ($42FD): first step after (rand & 7) + 1 frames, random heading */
    h->step_timer = (prng_step(w->prng) & 7) + 1;
    human_rehome(w, h);
    return h;
}

static Enemy *create_enemy(World *w, EnemyKind kind, int health, int points)
{
    if (w->enemy_count == MAX_ENEMIES) return NULL;
    Enemy *e = &w->enemies[w->enemy_count++];
    memset(e, 0, sizeof *e);
    e->kind = kind;
    e->health = health;
    e->points = points;
    e->visible = 1;
    e->walk_table = -1;
    return e;
}

static Enemy *create_grunt(World *w)
{
    return create_enemy(w, EN_GRUNT, 1, POINTS_GRUNT);
}

/* createSpheroid: ceil(prng_le($BE5E)/2) enforcers; first drop after prng_le($BE60) 10-frame cycles */
static Enemy *create_spheroid(World *w)
{
    Enemy *e = create_enemy(w, EN_SPHEROID, 2, POINTS_SPHEROID);
    if (!e) return NULL;
    e->drops_left = pacing_child_count(&w->pacing, w->prng);
    e->drop_timer = prng_le(w->prng, w->pacing.params[P_SPHEROID_DROP]) * SPHEROID_CYCLE_FRAMES;
    return e;
}

/* createEnforcer: first shot after the materialize plus prng_le($BE5F) 3-frame passes */
static Enemy *create_enforcer(World *w, double x, double y)
{
    Enemy *e = create_enemy(w, EN_ENFORCER, 2, POINTS_ENFORCER);
    if (!e) return NULL;
    e->x = x;
    e->y = y;
    e->frame = 1;
    e->shoot_passes = prng_le(w->prng, w->pacing.params[P_ENFORCER_SHOT]);
    return e;
}

/* createBrain: first cruise missile after prng_le($BE62) steps */
static Enemy *create_brain(World *w)
{
    Enemy *e = create_enemy(w, EN_BRAIN, 3, POINTS_BRAIN);
    if (!e) return NULL;
    e->frame = 6;
    e->missile_steps = prng_le(w->prng, w->pacing.params[P_BRAIN_MISSILE]);
    return e;
}

/* createQuark: ceil(prng_le($BE5E)/2) tanks; first drop after prng_le($BE66) 15-frame cycles */
static Enemy *create_quark(World *w)
{
    Enemy *e = create_enemy(w, EN_QUARK, 2, POINTS_QUARK);
    if (!e) return NULL;
    e->drops_left = pacing_child_count(&w->pacing, w->prng);
    e->drop_timer = prng_le(w->prng, w->pacing.params[P_QUARK_DROP]) * QUARK_CYCLE_FRAMES;
    return e;
}

/* createTank: first shell $BE64 passes after materializing */
static Enemy *create_tank(World *w, double x, double y)
{
    Enemy *e = create_enemy(w, EN_TANK, 4, POINTS_TANK);
    if (!e) return NULL;
    e->x = x;
    e->y = y;
    e->materialize = TANK_MATERIALIZE_FRAMES;
    e->shoot_passes = w->pacing.params[P_TANK_SHOT];
    return e;
}

static void enemy_extent(const World *w, const Enemy *e, double *hw, double *hh)
{
    *hw = w->enemy_w[e->kind] / 2.0;
    *hh = w->enemy_h[e->kind] / 2.0;
}

typedef struct { World *w; const Enemy *self; } OverlapCtx;

/* Grunts skip spots that overlap something already placed ($DE0F). */
static int overlaps(void *ctx, Point p, int pw, int ph)
{
    OverlapCtx *c = ctx;
    World *w = c->w;
    double ehw, ehh;
    electrode_extent(w, &ehw, &ehh);
    for (int i = 0; i < w->electrode_count; i++)
        if (fabs(w->electrodes[i].x - p.x) < ehw + pw / 2.0 && fabs(w->electrodes[i].y - p.y) < ehh + ph / 2.0)
            return 1;
    for (int i = 0; i < w->enemy_count; i++) {
        const Enemy *o = &w->enemies[i];
        if (o == c->self) continue;
        double hw, hh;
        enemy_extent(w, o, &hw, &hh);
        if (fabs(o->x - p.x) < hw + pw / 2.0 && fabs(o->y - p.y) < hh + ph / 2.0) return 1;
    }
    return 0;
}

typedef struct { int counts[WAVE_FIELDS]; } WaveCounts;

static void player_center(World *w)
{
    w->player.x = GAME_W / 2.0;
    w->player.y = GAME_H / 2.0;
    w->player.dx = w->player.dy = 0;
}

/* layWave: electrodes, enemies and family at ROM spawn positions, player centred. */
static void lay_wave(World *w, const WaveCounts *c)
{
    player_center(w);
    const ElectrodeFrame *rest = &world_electrode_look(w)->frames[0];
    for (int i = 0; i < c->counts[W_ELECTRODES] && w->electrode_count < MAX_ELECTRODES; i++) {
        Point p = spawn_electrode(w->prng, w->wave, rest->w, rest->h);
        w->electrodes[w->electrode_count].x = p.x;
        w->electrodes[w->electrode_count].y = p.y;
        w->electrode_count++;
    }
    /* the electrode tint starts at its colour now (createElectrode) */
    long c0 = palette_cycle(world_electrode_look(w)->entry, *w->clock, w->cycle);
    w->electrode_tint = c0 >= 0 ? (uint32_t)c0 : 0xFFFF00;

    for (int i = 0; i < c->counts[W_GRUNTS]; i++) {
        Enemy *g = create_grunt(w);
        if (!g) break;
        OverlapCtx ctx = { w, g };
        Point p = spawn_outside_box(w->prng, w->wave, w->enemy_w[EN_GRUNT], w->enemy_h[EN_GRUNT], overlaps, &ctx);
        g->x = p.x;
        g->y = p.y;
    }
    for (int i = 0; i < c->counts[W_HULKS]; i++) {
        Enemy *e = create_enemy(w, EN_HULK, 1 << 30, 0);
        if (!e) break;
        Point p = spawn_outside_box(w->prng, w->wave, w->enemy_w[EN_HULK], w->enemy_h[EN_HULK], NULL, NULL);
        e->x = p.x;
        e->y = p.y;
    }
    for (int i = 0; i < c->counts[W_SPHEROIDS]; i++) {
        Enemy *e = create_spheroid(w);
        if (!e) break;
        Point p = spawn_spheroid(w->prng, w->enemy_w[EN_SPHEROID], w->enemy_h[EN_SPHEROID]);
        e->x = p.x;
        e->y = p.y;
    }
    for (int i = 0; i < c->counts[W_BRAINS]; i++) {
        Enemy *e = create_brain(w);
        if (!e) break;
        Point p = spawn_brain(w->prng, w->enemy_w[EN_BRAIN], w->enemy_h[EN_BRAIN]);
        e->x = p.x;
        e->y = p.y;
    }
    for (int i = 0; i < c->counts[W_QUARKS]; i++) {
        Enemy *e = create_quark(w);
        if (!e) break;
        Point p = spawn_quark(w->prng, w->enemy_w[EN_QUARK], w->enemy_h[EN_QUARK]);
        e->x = p.x;
        e->y = p.y;
    }

    static const int family[3][2] = { { HU_MOMMY, W_MOMMIES }, { HU_DADDY, W_DADDIES }, { HU_MIKEY, W_MIKEYS } };
    for (int f = 0; f < 3; f++) {
        HumanKind k = (HumanKind)family[f][0];
        for (int i = 0; i < c->counts[family[f][1]]; i++) {
            Human *h = create_human(w, k);
            if (!h) break;
            Point p = spawn_anywhere(w->prng, w->human_w[k], w->human_h[k]);
            h->x = p.x;
            h->y = p.y;
        }
    }
    w->player.alive = 1;
    w->player.invuln_ms = RESPAWN_INVULNERABILITY_MS;
}

static void start_beam_in(World *w);

static void start_next_wave(World *w)
{
    w->wave++;
    border_set_wave(w, w->wave);
    w->bonus = INITIAL_BONUS;
    w->electrode_count = 0;
    w->dying_count = 0;
    w->eshot_count = 0;
    w->enemy_count = 0;
    w->human_count = 0;
    player_center(w);

    WaveCounts c;
    int idx = w->wave;
    while (idx > 40) idx -= 20;
    for (int k = 0; k < WAVE_FIELDS; k++) c.counts[k] = w->assets->waves[idx - 1][k];
    pacing_begin_wave(&w->pacing, w->wave, w->lives - 1 > 0 ? w->lives - 1 : 0);
    lay_wave(w, &c);
    w->player.alive = 1;
    w->player.invuln_ms = RESPAWN_INVULNERABILITY_MS;
}

/* relayWave: after a death the survivors get fresh positions and beam in again. */
static void relay_wave(World *w)
{
    WaveCounts c;
    memset(&c, 0, sizeof c);
    for (int i = 0; i < w->enemy_count; i++) {
        EnemyKind k = w->enemies[i].kind;
        if (k == EN_GRUNT) c.counts[W_GRUNTS]++;
        else if (k == EN_HULK) c.counts[W_HULKS]++;
        else if (k == EN_SPHEROID) c.counts[W_SPHEROIDS]++;
        else if (k == EN_BRAIN) c.counts[W_BRAINS]++;
        else if (k == EN_QUARK) c.counts[W_QUARKS]++;
    }
    c.counts[W_ELECTRODES] = w->electrode_count;
    for (int i = 0; i < w->human_count; i++) {
        const Human *h = &w->humans[i];
        if (h->rescued || h->prog) continue;
        c.counts[h->kind == HU_MOMMY ? W_MOMMIES : h->kind == HU_DADDY ? W_DADDIES : W_MIKEYS]++;
    }
    clear_entities(w, 1);
    lay_wave(w, &c);
    w->player.visible = 0;
    start_beam_in(w);
}

/* ---- transitions ------------------------------------------------------------ */

static void start_beam_in(World *w)
{
    w->state = W_BEAM_IN;
    w->t_frame = 0;
    w->star_start = -1;
    for (int i = 0; i < w->enemy_count; i++) {
        Beam *b = &w->beams[i];
        b->horizontal = fx_float(w) < BEAM_HORIZONTAL_CHANCE;
        b->delay = fx_float(w) * BEAM_DELAY_MAX;
        b->dur = BEAM_DUR_MIN + fx_float(w) * (BEAM_DUR_MAX - BEAM_DUR_MIN);
        b->spread = BEAM_SPREAD_MIN + fx_float(w) * (BEAM_SPREAD_MAX - BEAM_SPREAD_MIN);
        b->done = 0;
        w->enemies[i].visible = 0;
    }
    w->player.visible = 0;
}

static void step_beam_in(World *w)
{
    int frame = ++w->t_frame;
    int pending = 0;
    for (int i = 0; i < w->enemy_count; i++) {
        Beam *b = &w->beams[i];
        if (b->done) continue;
        double p = (frame - b->delay) / b->dur;
        if (p < 0) { pending++; continue; }
        if (p >= 1) { b->done = 1; w->enemies[i].visible = 1; continue; }
        pending++;
    }
    if (pending > 0) return;
    if (w->star_start < 0) w->star_start = frame;
    if (frame - w->star_start < STAR_FRAMES) return;
    w->player.visible = 1;
    w->state = W_PLAYING;
}

static void start_wave_clear(World *w)
{
    w->state = W_WAVE_CLEAR;
    w->t_frame = 0;
    sfx(w, SND_WAVE_COMPLETE);
    clear_entities(w, 1);
    w->player.visible = 0;
    w->border_visible = 0;
}

static void step_wave_clear(World *w)
{
    if (++w->t_frame < SPAWN_AT) return;
    w->border_visible = 1;
    start_next_wave(w);
    start_beam_in(w);
}

static uint32_t entry_rgb(const World *w, int entry, int *visible)
{
    *visible = entry != 0;
    return w->assets->atlas.palette[entry];
}

static void beat_start(World *w)
{
    w->beat_active = 1;
    w->beat_frames = 0;
    w->beat_slot = -1;
    w->beat_x = w->player.x;
    w->beat_y = w->player.y;
    w->beat_frame = w->player.frame;
    w->beat_color = entry_rgb(w, 0x9, &w->beat_visible);
    w->player.visible = 0;
}

/* Returns 1 on the frame the beat finishes. */
static int beat_step(World *w)
{
    if (!w->beat_active) return 0;
    w->beat_frames++;
    int f = w->beat_frames - BEAT_FIRST_FRAMES;
    if (f >= 0 && f < BEAT_FLASHES * BEAT_FLASH_FRAMES) {
        int s = f / BEAT_FLASH_FRAMES;
        if (s != w->beat_slot) {
            w->beat_slot = s;
            w->beat_color = entry_rgb(w, BEAT_FLASH_ENTRIES[(int)(fx_float(w) * 4)], &w->beat_visible);
        }
    } else if (f >= BEAT_FLASHES * BEAT_FLASH_FRAMES) {
        int k = (f - BEAT_FLASHES * BEAT_FLASH_FRAMES) / BEAT_FADE_FRAMES;
        w->beat_visible = k < 7;
        if (k < 7) w->beat_color = palette_rgb(BEAT_FADE[k]);
    }
    if (w->beat_frames >= BEAT_DONE_AT) {
        w->beat_active = 0;
        return 1;
    }
    return 0;
}

static void player_hit(World *w)
{
    Player *pl = &w->player;
    if (w->state != W_PLAYING) return; /* the demo man cannot die */
    if (!pl->alive || pl->invuln_ms > 0) return;
    sfx(w, SND_PLAYER_DEATH);
    w->lives--;
    pl->alive = 0;
    pl->dx = pl->dy = 0;
    pacing_on_death(&w->pacing, w->lives - 1 > 0 ? w->lives - 1 : 0);
    w->bonus = INITIAL_BONUS;

    /* TwoPlayer.onDeath */
    int game_over = w->lives <= 0;
    w->swap_after_beat = 0;
    if (w->player_count == 2) {
        PlayerSlot *cur = &w->slots[w->current];
        cur->score = w->score;
        cur->lives = w->lives;
        cur->wave = w->wave;
        cur->bonus = w->bonus;
        cur->next_extra = w->next_extra;
        int other = 1 - w->current;
        if (w->slots[other].lives > 0) {
            /* restore the other player; startNextWave increments first */
            const PlayerSlot *s = &w->slots[other];
            w->score = s->score;
            w->lives = s->lives;
            w->wave = s->wave - 1 > 0 ? s->wave - 1 : 0;
            w->bonus = s->bonus;
            w->next_extra = s->next_extra;
            w->current = other;
            w->swap_after_beat = 1;
            game_over = 0;
        }
    }
    if (game_over) {
        w->state = W_GAME_OVER;
        w->hud_visible = 0;
        w->go_frames = 0;
        w->go_text = 0;
        w->go_erase_x = 0;
        beat_start(w);
        return;
    }
    w->state = W_DEATH;
    beat_start(w);
}

static void step_game_over(World *w)
{
    beat_step(w);
    w->go_frames++;
    if (w->go_frames >= GO_DEATH_FRAMES) w->go_text = 1;
    if (w->go_frames < GO_DEATH_FRAMES + GO_TEXT_FRAMES) return;
    int erase = w->go_frames - (GO_DEATH_FRAMES + GO_TEXT_FRAMES);
    unsigned best = world_best_score(w);
    int qualifies = best > 0 && best > w->qualify_min;
    if (erase >= 6 || qualifies) {
        clear_entities(w, 1);
        w->score = best; /* afterGameOverText: the best of both players goes on */
        w->state = W_DONE;
        return;
    }
    w->go_erase_x = ERASE_FROM_X[erase];
}

/* ---- per-frame updates (PLAYING only) ------------------------------------------- */

static int sgn(double v) { return (v > 0) - (v < 0); }

static void player_walk_frame(Player *p)
{
    int sx = sgn(p->dx), sy = sgn(p->dy);
    int seq = sx < 0 ? 0 : sx > 0 ? 1 : sy > 0 ? 2 : sy < 0 ? 3 : -1;
    if (seq < 0) return;
    if (seq != p->walk_seq) {
        p->walk_seq = seq;
        p->walk_pos = 0;
        p->walk_tick = 0;
    }
    if (p->walk_tick == 0) {
        p->frame = PLAYER_WALK[seq][p->walk_pos];
        p->walk_pos = (p->walk_pos + 1) % 4;
    }
    p->walk_tick ^= 1;
}

static void player_input_and_update(World *w, const PlayInput *in)
{
    Player *p = &w->player;
    /* handleKeyboardInput: movement and shooting are read first */
    double mx = in->move_x, my = in->move_y;
    double ml = sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }
    double fxv = 0, fyv = 0;
    if (p->alive && w->state == W_PLAYING) {
        double now = w->frame * 1000.0 / 60.0;
        if (now - p->last_shot_ms >= SHOOT_RATE_MS) {
            fxv = in->fire_x;
            fyv = in->fire_y;
            double fl = sqrt(fxv * fxv + fyv * fyv);
            if (fl > 1) { fxv /= fl; fyv /= fl; }
            if (fl > 0) p->last_shot_ms = now;
        }
    }
    p->dx = mx * 2;
    p->dy = my * 2;
    if ((fxv != 0 || fyv != 0) && p->alive && w->shot_count < MAX_PLAYER_SHOTS) {
        Shot *s = &w->shots[w->shot_count++];
        sfx(w, SND_SHOOT);
        s->x = p->x;
        s->y = p->y;
        s->dx = fxv * PROJECTILE_SPEED;
        s->dy = fyv * PROJECTILE_SPEED;
    }

    /* Player.update: 1 px per frame per axis, clamped, walk frame */
    if (!p->alive) return;
    p->x += sgn(p->dx);
    p->y += sgn(p->dy);
    clamp_to_playfield(&p->x, &p->y, w->player_w / 2.0, w->player_h / 2.0);
    player_walk_frame(p);
    if (p->invuln_ms > 0) {
        double phase = (p->invuln_ms / 1000.0) * M_PI * 2 * 2;
        p->alpha = 0.6 + sin(phase * 3) * 0.4;
        p->shield = 1;
    } else {
        p->alpha = 1.0;
        p->shield = 0;
    }
}

static void update_shots(World *w)
{
    for (int i = w->shot_count - 1; i >= 0; i--) {
        Shot *s = &w->shots[i];
        s->x += s->dx;
        s->y += s->dy;
        if (s->x < PF_LEFT || s->x > PF_RIGHT || s->y < PF_TOP || s->y > PF_BOTTOM)
            REMOVE_AT(w->shots, w->shot_count, i);
    }
}

static double aux_float(World *w)
{
    int hi = prng_step(&w->aux), lo = prng_step(&w->aux);
    return (double)(hi << 8 | lo) / 65536.0;
}

/* moveBlockedAtWalls ($DD09): each axis moves only if the sprite stays inside. */
static void move_blocked(double *x, double *y, double hw, double hh, double dx, double dy)
{
    double nx = *x + dx, ny = *y + dy;
    if (nx - hw >= PF_LEFT && nx + hw <= PF_RIGHT) *x = nx;
    if (ny - hh >= PF_TOP && ny + hh <= PF_BOTTOM) *y = ny;
}

static Human *human_by_id(World *w, int id)
{
    for (int i = 0; i < w->human_count; i++)
        if (w->humans[i].id == id && !w->humans[i].prog) return &w->humans[i];
    return NULL;
}

/* $41B3: one target for life: the player when rand > $C0, else the next human round-robin */
static int pick_hulk_target(World *w)
{
    if (prng_step(w->prng) > 0xC0) return 0;
    int n = 0;
    for (int i = 0; i < w->human_count; i++) n += !w->humans[i].rescued && !w->humans[i].prog;
    if (!n) return 0;
    unsigned k = w->hulk_cursor++ % (unsigned)n;
    for (int i = 0; i < w->human_count; i++) {
        if (w->humans[i].rescued || w->humans[i].prog) continue;
        if (k-- == 0) return w->humans[i].id;
    }
    return 0;
}

/* $4106: (rand & $1F) + 1 steps on the other axis toward the target + -16..15 */
static void hulk_rehome(World *w, Enemy *e)
{
    e->walk_steps = (prng_step(w->prng) & 0x1F) + 1;
    const Human *t = e->target_id ? human_by_id(w, e->target_id) : NULL;
    double tx, ty;
    if (t && !t->rescued) { tx = t->x; ty = t->y; }
    else { tx = w->player.x; ty = w->player.y; }
    int jitter = (prng_step(w->prng) & 0x1F) - 16;
    int horizontal = e->walk_table == HW_LEFT || e->walk_table == HW_RIGHT;
    e->walk_table = horizontal ? (ty + jitter > e->y ? HW_DOWN : HW_UP) : (tx + 2 * jitter > e->x ? HW_RIGHT : HW_LEFT);
    e->walk_idx = 0;
    e->frame = HULK_ATLAS[HULK_WALK[e->walk_table][0][0]];
}

static void update_hulk(World *w, Enemy *e)
{
    if (e->walk_table < 0) {
        e->walk_idx = 0;
        e->step_timer = 0;
        e->target_id = pick_hulk_target(w);
        hulk_rehome(w, e);
    }
    e->step_timer -= 1;
    while (e->step_timer <= 0) {
        e->step_timer += w->pacing.params[P_HULK_STEP];
        const int *st = HULK_WALK[e->walk_table][e->walk_idx];
        e->walk_idx = (e->walk_idx + 1) % 4;
        e->frame = HULK_ATLAS[st[0]];
        double nx = e->x + st[1], ny = e->y + st[2], hw, hh;
        enemy_extent(w, e, &hw, &hh);
        if (nx < PF_LEFT + hw || nx > PF_RIGHT - hw || ny < PF_TOP + hh || ny > PF_BOTTOM - hh) {
            hulk_rehome(w, e);
            continue;
        }
        e->x = nx;
        e->y = ny;
        if (--e->walk_steps <= 0) hulk_rehome(w, e);
    }
}

/* Returns 1 when the spheroid has left the playfield and is gone. */
static int update_spheroid(World *w, Enemy *e, int *live_enforcers)
{
    if (!e->leaving) {
        if (!e->dx || !e->dy || aux_float(w) < 0.01) {
            double a = aux_float(w) * M_PI * 2;
            e->dx = cos(a) * SPHEROID_SPEED;
            e->dy = sin(a) * SPHEROID_SPEED;
        }
        e->drop_timer -= 1;
        if (e->drop_timer <= 0) {
            if (!e->dropping) {
                e->dropping = 1;
            } else if (*live_enforcers < MAX_ENFORCERS) {
                create_enforcer(w, e->x, e->y); /* appended: the fixed array keeps `e` valid */
                sfx(w, SND_ENFORCER_SPAWN);
                (*live_enforcers)++;
                if (--e->drops_left <= 0) {
                    e->leaving = 1;
                    e->dx = prng_step(w->prng) & 0x80 ? -SPHEROID_EXIT_SPEED : SPHEROID_EXIT_SPEED;
                    e->dy = 0;
                }
            }
            e->drop_timer = prng_le(w->prng, w->pacing.params[P_SPHEROID_DROP] >> 2) * SPHEROID_DROP_CYCLE_FRAMES;
        }
    }
    e->x += e->dx;
    e->y += e->dy;
    double hw, hh;
    enemy_extent(w, e, &hw, &hh);
    if (e->leaving) {
        if (e->x < PF_LEFT + hw || e->x > PF_RIGHT - hw || e->y < PF_TOP + hh || e->y > PF_BOTTOM - hh) return 1;
    } else {
        if (e->x < PF_LEFT + hw || e->x > PF_RIGHT - hw) {
            e->dx = -e->dx;
            if (e->x < PF_LEFT + hw) e->x = PF_LEFT + hw;
            if (e->x > PF_RIGHT - hw) e->x = PF_RIGHT - hw;
        }
        if (e->y < PF_TOP + hh || e->y > PF_BOTTOM - hh) {
            e->dy = -e->dy;
            if (e->y < PF_TOP + hh) e->y = PF_TOP + hh;
            if (e->y > PF_BOTTOM - hh) e->y = PF_BOTTOM - hh;
        }
    }
    e->pulse += 0.05;
    return 0;
}

static int count_eshots(const World *w, EnemyShotKind k)
{
    int n = 0;
    for (int i = 0; i < w->eshot_count; i++) n += w->eshots[i].kind == k;
    return n;
}

/* $53B5: aim at the player + (rand >> 3) on each axis; next aim in (rand & $1F) passes */
static void aim_enforcer(World *w, Enemy *e)
{
    int pass = prng_step(w->prng) & 0x1F;
    e->aim_passes = pass ? pass : 256;
    int jx = (prng_step(w->prng) >> 3) - 16, jy = (prng_step(w->prng) >> 3) - 16;
    double tx = w->player.x + 2 * jx, ty = w->player.y + jy;
    if (tx < PF_LEFT) tx = PF_LEFT;
    if (tx > PF_RIGHT) tx = PF_RIGHT;
    if (ty < PF_TOP) ty = PF_TOP;
    if (ty > PF_BOTTOM) ty = PF_BOTTOM;
    e->dx = (tx - e->x) * 2 / 256;
    e->dy = (ty - e->y) * 2 / 256;
}

/* $5404: aimed at the player + -16..15 (no x jitter near the left wall), then curving */
static void create_spark(World *w, double x, double y, double tx, double ty)
{
    int jx = tx < 2 * 0x17 - 6 ? 0 : (prng_step(w->prng) & 0x1F) - 16;
    int jy = (prng_step(w->prng) & 0x1F) - 16;
    double vx = (tx + 2 * jx - x) * 4 / 256, vy = (ty + jy - y) * 4 / 256;
    double ix = 2 * ((prng_step(w->prng) & 0x1F) - 16) / 256.0;
    double iy = ((prng_step(w->prng) & 0x1F) - 16) / 256.0;
    int life = (prng_step(w->prng) & 0x0F) + 0x14;
    if (w->eshot_count == MAX_ENEMY_SHOTS) return;
    EnemyShot *sp = &w->eshots[w->eshot_count++];
    memset(sp, 0, sizeof *sp);
    sp->kind = ES_SPARK;
    sfx(w, SND_ENFORCER_FIRE);
    sp->x = x;
    sp->y = y;
    sp->dx = vx;
    sp->dy = vy;
    sp->ix = ix;
    sp->iy = iy;
    sp->life = life;
    sp->pass_timer = SPARK_PASS_FRAMES;
    sp->frame = 0;
}

static void update_enforcer(World *w, Enemy *e)
{
    e->age += 1;
    if (e->age < ENFORCER_MATERIALIZE_FRAMES) {
        int f = (int)(e->age / 8);
        e->frame = 1 + (f < 4 ? f : 4);
        return;
    }
    if (!e->active) {
        e->active = 1;
        e->frame = 0;
        aim_enforcer(w, e);
    }
    e->pass_timer -= 1;
    while (e->pass_timer <= 0) {
        e->pass_timer += ENFORCER_PASS_FRAMES;
        if (--e->aim_passes <= 0) aim_enforcer(w, e);
        if (--e->shoot_passes <= 0) {
            e->shoot_passes = prng_le(w->prng, w->pacing.params[P_ENFORCER_SHOT]);
            if (w->player.alive && count_eshots(w, ES_SPARK) < MAX_SPARKS) create_spark(w, e->x, e->y, w->player.x, w->player.y);
        }
    }
    double hw, hh;
    enemy_extent(w, e, &hw, &hh);
    move_blocked(&e->x, &e->y, hw, hh, e->dx, e->dy);
}

/* $207B: aim a cruise missile at the player (8 directions) */
static void aim_missile(World *w, EnemyShot *m, double tx, double ty)
{
    m->step_x = m->step_y = 0;
    int do_y = 1;
    if (prng_step(w->prng) & 0x80) {
        int jx = (prng_step(w->prng) & 0x0F) - 6;
        m->step_x = tx + 2 * jx >= m->x ? 2 : -2;
        do_y = !(prng_step(w->prng) & 0x80);
    }
    if (do_y) {
        int jy = (prng_step(w->prng) & 0x0F) - 6;
        m->step_y = ty + jy >= m->y ? 1 : -1;
    }
    m->aim_passes = prng_le(w->prng, 7);
}

static double clampd(double v, double lo, double hi) { return v < lo ? lo : v > hi ? hi : v; }

/* $6006 */
static void create_missile(World *w, double x, double y, double tx, double ty)
{
    if (w->eshot_count == MAX_ENEMY_SHOTS) return;
    EnemyShot *m = &w->eshots[w->eshot_count++];
    memset(m, 0, sizeof *m);
    m->kind = ES_MISSILE;
    sfx(w, SND_BRAIN_FIRE);
    m->x = clampd(js_round(x), MISSILE_X0, MISSILE_X1);
    m->y = clampd(js_round(y), MISSILE_Y0, MISSILE_Y1);
    m->pass_timer = MISSILE_PASS_FRAMES;
    aim_missile(w, m, tx, ty);
}

/* $20C7: one move, reversing an axis that would leave the playfield */
static void move_missile(EnemyShot *m)
{
    if (m->trail_len == MISSILE_TRAIL) {
        memmove(m->trail[0], m->trail[1], sizeof m->trail[0] * (MISSILE_TRAIL - 1));
        m->trail_len--;
    }
    m->trail[m->trail_len][0] = m->x;
    m->trail[m->trail_len][1] = m->y;
    m->trail_len++;
    double nx = m->x + m->step_x;
    if (nx < MISSILE_X0 || nx > MISSILE_X1) { m->step_x = -m->step_x; nx = m->x + m->step_x; }
    double ny = m->y + m->step_y;
    if (ny < MISSILE_Y0 || ny > MISSILE_Y1) { m->step_y = -m->step_y; ny = m->y + m->step_y; }
    m->x = nx;
    m->y = ny;
}

/* Tank shell: reaches the aim point in 8192 / $BE65 frames, bounces twice ($8E98) */
static void create_shell(World *w, double x, double y, double tx, double ty)
{
    if (w->eshot_count == MAX_ENEMY_SHOTS) return;
    EnemyShot *sh = &w->eshots[w->eshot_count++];
    memset(sh, 0, sizeof *sh);
    sh->kind = ES_SHELL;
    sfx(w, SND_TANK_FIRE);
    double frames = 8192.0 / w->pacing.params[P_TANK_SHELL_SPEED];
    sh->x = x;
    sh->y = y;
    sh->dx = (tx - x) / frames;
    sh->dy = (ty - y) / frames;
    if (!sh->dx && !sh->dy) sh->dy = 1;
    sh->bounces = TANK_SHELL_BOUNCES;
}

static void update_enemy_shots(World *w)
{
    for (int i = w->eshot_count - 1; i >= 0; i--) {
        EnemyShot *sp = &w->eshots[i];
        if (sp->kind == ES_SPARK) {
            int gone = 0;
            sp->pass_timer -= 1;
            while (sp->pass_timer <= 0) {
                sp->pass_timer += SPARK_PASS_FRAMES;
                sp->dx += sp->ix;
                sp->dy += sp->iy;
                sp->frame = (sp->frame + 1) % 4;
                if (--sp->life <= 0) { gone = 1; break; }
            }
            if (gone) REMOVE_AT(w->eshots, w->eshot_count, i);
            else move_blocked(&sp->x, &sp->y, w->spark_w / 2.0, w->spark_h / 2.0, sp->dx, sp->dy);
        } else if (sp->kind == ES_MISSILE) {
            sp->pass_timer -= 1;
            while (sp->pass_timer <= 0) {
                sp->pass_timer += MISSILE_PASS_FRAMES;
                if (--sp->aim_passes <= 0) aim_missile(w, sp, w->player.x, w->player.y);
                move_missile(sp);
                move_missile(sp);
            }
        } else {
            int bounced = 0;
            sp->x += sp->dx;
            sp->y += sp->dy;
            if (sp->x <= PF_LEFT || sp->x >= PF_RIGHT) {
                if (sp->bounces > 0) {
                    bounced = 1;
                    sp->dx = -sp->dx;
                    sp->bounces--;
                    sp->x = clampd(sp->x, PF_LEFT + 1, PF_RIGHT - 1);
                } else {
                    REMOVE_AT(w->eshots, w->eshot_count, i);
                    continue;
                }
            }
            if (sp->y <= PF_TOP || sp->y >= PF_BOTTOM) {
                if (sp->bounces > 0) {
                    bounced = 1;
                    sp->dy = -sp->dy;
                    sp->bounces--;
                    sp->y = clampd(sp->y, PF_TOP + 1, PF_BOTTOM - 1);
                } else {
                    REMOVE_AT(w->eshots, w->eshot_count, i);
                    continue;
                }
            }
            if (bounced) sfx(w, SND_SHELL_BOUNCE);
        }
    }
}

static void human_extent(const World *w, const Human *h, double *hw, double *hh);

/* convertToProg: the human, reprogrammed, walks at the player */
static void prog_offsets(World *w, Human *p)
{
    p->offset_x = 2 * (32 - 4 * prng_le(w->prng, 0x0F));
    p->offset_y = 20 - 2 * prng_le(w->prng, 0x12);
}

static void prog_home(World *w, Human *p)
{
    if (w->state == W_DEMO) return; /* homes on the game's player, who is gone in the demo */
    if (prng_step(w->prng) & 0x80) {
        int up = w->player.y + p->offset_y <= p->y;
        p->dir_base = up ? 9 : 6;
        p->step_x = 0;
        p->step_y = up ? -PROG_STEP : PROG_STEP;
    } else {
        int left = w->player.x + p->offset_x <= p->x;
        p->dir_base = left ? 0 : 3;
        p->step_x = left ? -PROG_STEP : PROG_STEP;
        p->step_y = 0;
    }
}

static void convert_to_prog(World *w, Human *h)
{
    sfx(w, SND_HUMAN_TO_PROG);
    h->prog = 1;
    h->frame = 0;
    h->walk = 3;
    h->pass_timer = 0;
    h->trail_len = 0;
    prog_offsets(w, h);
    prog_home(w, h);
}

/* One 3-frame pass of $5EAB */
static void prog_pass(World *w, Human *p)
{
    p->walk = (p->walk + 1) % 4;
    int tex = p->dir_base + PROG_WALK[p->walk];
    double nx = p->x + p->step_x, ny = p->y + p->step_y, hw, hh;
    human_extent(w, p, &hw, &hh);
    if (nx < PF_LEFT + hw || nx > PF_RIGHT - hw || ny < PF_TOP + hh || ny > PF_BOTTOM - hh) {
        prog_home(w, p); /* walked into a wall */
        return;
    }
    if (p->trail_len == PROG_TRAIL) {
        memmove(&p->trail[0], &p->trail[1], sizeof p->trail[0] * (PROG_TRAIL - 1));
        p->trail_len--;
    }
    p->trail[p->trail_len].x = p->x;
    p->trail[p->trail_len].y = p->y;
    p->trail[p->trail_len].frame = p->frame;
    p->trail_len++;
    p->frame = tex;
    p->x = nx;
    p->y = ny;
    if (prng_step(w->prng) > 0xF8) prog_offsets(w, p);
    if (prng_step(w->prng) > 0xE4) prog_home(w, p);
}

/* brain_move_ctrl ($5BEE) with brain_find_nearest_human ($5B95) */
static void update_brain(World *w, Enemy *e)
{
    double tx = w->player.x, ty = w->player.y, best = 1e30;
    Human *target = NULL;
    for (int i = 0; i < w->human_count; i++) {
        Human *h = &w->humans[i];
        if (h->prog || h->rescued) continue;
        double d = fabs(h->x - e->x) + fabs(h->y - e->y);
        if (d < best) {
            best = d;
            tx = h->x;
            ty = h->y;
            target = h;
        }
    }
    /* a brain converts a human on contact */
    if (target && best < 7) convert_to_prog(w, target);

    e->step_timer -= 1;
    while (e->step_timer <= 0) {
        e->step_timer += w->pacing.params[P_BRAIN_STEP];
        double dx_bytes = js_round((tx - e->x) / 2);
        int sx = fabs(dx_bytes) > 2 ? (dx_bytes > 0) - (dx_bytes < 0) : 0;
        int sy = ty >= e->y ? 1 : -1;
        e->x += 2 * sx;
        e->y += sy;
        int seq = sx > 0 ? 1 : sx < 0 ? 0 : sy >= 0 ? 2 : 3;
        if (seq != e->walk_table) {
            e->walk_table = seq;
            e->walk_idx = 0;
        } else {
            e->walk_idx = (e->walk_idx + 1) % 4;
        }
        e->frame = BRAIN_WALK[seq][e->walk_idx];
        if (--e->missile_steps <= 0) {
            e->missile_steps = prng_le(w->prng, w->pacing.params[P_BRAIN_MISSILE]);
            if (w->player.alive && count_eshots(w, ES_MISSILE) < MAX_MISSILES) {
                double hw, hh;
                enemy_extent(w, e, &hw, &hh);
                /* $6041: from the brain's top-left + 3 bytes, 4 lines */
                create_missile(w, e->x - hw + 6, e->y - hh + 4, w->player.x, w->player.y);
            }
        }
    }
    double hw, hh;
    enemy_extent(w, e, &hw, &hh);
    clamp_to_playfield(&e->x, &e->y, hw, hh);
}

/* Tank ($8D63/$8D99) */
static void update_tank(World *w, Enemy *e)
{
    if (e->materialize > 0) {
        e->materialize -= 1;
        return;
    }
    e->pass_timer -= 1;
    while (e->pass_timer <= 0) {
        e->pass_timer += TANK_PASS_FRAMES;
        if (--e->retarget <= 0) {
            int aim_player = prng_step(w->prng) <= 0x60;
            double tx = aim_player ? w->player.x : PF_LEFT + prng_bounded(w->prng, PF_RIGHT - PF_LEFT + 1);
            double ty = aim_player ? w->player.y : PF_TOP + prng_bounded(w->prng, PF_BOTTOM - PF_TOP + 1);
            e->step_x = tx >= e->x ? 1 : -1;
            e->step_y = fabs(ty - e->y) < 16 ? 0 : ty >= e->y ? 1 : -1;
            e->retarget = (prng_step(w->prng) & 31) + 1;
        }
        e->x += e->step_x;
        e->y += e->step_y;
        if (--e->shoot_passes <= 0) {
            e->shoot_passes = w->pacing.params[P_TANK_SHOT];
            if (w->player.alive && count_eshots(w, ES_SHELL) < MAX_SHELLS) {
                double ax = w->player.x + ((prng_step(w->prng) & 31) - 16) * 2;
                double ay = w->player.y + (prng_step(w->prng) & 31) - 16;
                create_shell(w, e->x, e->y, ax, ay);
            }
        }
    }
    double bx = e->x, by = e->y, hw, hh;
    enemy_extent(w, e, &hw, &hh);
    clamp_to_playfield(&e->x, &e->y, hw, hh);
    if (e->x != bx || e->y != by) e->retarget = 0; /* hit a wall: re-aim */
}

/* Quark ($8B36). Returns 1 when it has left the playfield. */
static int update_quark(World *w, Enemy *e, int *live_tanks)
{
    if (!e->leaving) {
        e->move_timer -= 1;
        if (e->move_timer <= 0) {
            e->move_timer = ((prng_step(w->prng) & 31) + 1) * QUARK_PASS_FRAMES;
            double sp = prng_le(w->prng, w->pacing.params[P_QUARK_SPEED]) / 32.0;
            e->dx = sp * (prng_step(w->prng) & 0x80 ? -1 : 1);
            sp = prng_le(w->prng, w->pacing.params[P_QUARK_SPEED]) / 32.0;
            e->dy = sp * (prng_step(w->prng) & 0x80 ? -1 : 1);
        }
        e->drop_timer -= 1;
        if (e->drop_timer <= 0) {
            if (!e->dropping) {
                e->dropping = 1;
            } else if (*live_tanks < MAX_TANKS) {
                create_tank(w, e->x, e->y);
                (*live_tanks)++;
                if (--e->drops_left <= 0) {
                    e->leaving = 1;
                    e->dx = 0;
                    e->dy = prng_step(w->prng) & 0x80 ? -QUARK_EXIT_SPEED : QUARK_EXIT_SPEED;
                }
            }
            e->drop_timer = prng_le(w->prng, (w->pacing.params[P_QUARK_DROP] >> 1) + 1) * QUARK_PASS_FRAMES;
        }
    }
    e->x += e->dx;
    e->y += e->dy;
    double hw, hh;
    enemy_extent(w, e, &hw, &hh);
    if (e->leaving)
        return e->x < PF_LEFT + hw || e->x > PF_RIGHT - hw || e->y < PF_TOP + hh || e->y > PF_BOTTOM - hh;
    if (e->x < PF_LEFT + hw || e->x > PF_RIGHT - hw) {
        e->dx = -e->dx;
        e->x = clampd(e->x, PF_LEFT + hw, PF_RIGHT - hw);
    }
    if (e->y < PF_TOP + hh || e->y > PF_BOTTOM - hh) {
        e->dy = -e->dy;
        e->y = clampd(e->y, PF_TOP + hh, PF_BOTTOM - hh);
    }
    return 0;
}

static void update_enemies(World *w)
{
    int live_grunts = 0, live_enforcers = 0, live_tanks = 0;
    for (int i = 0; i < w->enemy_count; i++) {
        if (w->enemies[i].kind == EN_GRUNT) live_grunts++;
        else if (w->enemies[i].kind == EN_ENFORCER) live_enforcers++;
        else if (w->enemies[i].kind == EN_TANK) live_tanks++;
    }
    int ticks = pacing_update(&w->pacing, live_grunts);
    const Player *pl = &w->player;
    for (int i = w->enemy_count - 1; i >= 0; i--) {
        Enemy *e = &w->enemies[i];
        if (e->kind == EN_GRUNT) {
            /* flat_grunt_move $79CE: every 4 frames each grunt counts down and steps
               diagonally toward the player (Y +-4 lines, X +-2 bytes) */
            if (e->step_countdown == 0) e->step_countdown = pacing_next_grunt_delay(&w->pacing, w->prng);
            for (int t = 0; t < ticks; t++) {
                if (--e->step_countdown > 0) continue;
                e->step_countdown = pacing_next_grunt_delay(&w->pacing, w->prng);
                double dy = js_round(e->y - pl->y);
                if (dy >= 2) e->y -= 4;
                else if (dy == 0 || dy <= -2) e->y += 4;
                double dx_bytes = js_round((e->x - pl->x) / 2);
                e->x += dx_bytes > 0 ? -4 : 4;
                clamp_to_playfield(&e->x, &e->y, w->enemy_w[EN_GRUNT] / 2.0, w->enemy_h[EN_GRUNT] / 2.0);
                e->frame = (e->frame + 1) % 3;
            }
        } else if (e->kind == EN_HULK) {
            update_hulk(w, e);
        } else if (e->kind == EN_SPHEROID) {
            if (update_spheroid(w, e, &live_enforcers)) REMOVE_AT(w->enemies, w->enemy_count, i);
        } else if (e->kind == EN_ENFORCER) {
            update_enforcer(w, e);
        } else if (e->kind == EN_BRAIN) {
            update_brain(w, e);
        } else if (e->kind == EN_TANK) {
            update_tank(w, e);
        } else if (e->kind == EN_QUARK) {
            if (update_quark(w, e, &live_tanks)) REMOVE_AT(w->enemies, w->enemy_count, i);
        }
    }
}

static int electrode_blocks(const World *w, double x, double y, double hw, double hh)
{
    double ow, oh;
    electrode_extent(w, &ow, &oh);
    for (int i = 0; i < w->electrode_count; i++)
        if (fabs(x - w->electrodes[i].x) < hw + ow && fabs(y - w->electrodes[i].y) < hh + oh) return 1;
    return 0;
}

static void human_step(World *w, Human *h)
{
    const int *e = HUMAN_WALK[h->walk_table][h->walk_idx];
    h->walk_idx = (h->walk_idx + 1) % 4;
    h->frame = e[0];
    double nx = h->x + e[1], ny = h->y + e[2], hw, hh;
    human_size(w, h->kind, &hw, &hh);
    int blocked = nx < PF_LEFT + hw || nx > PF_RIGHT - hw || ny < PF_TOP + hh || ny > PF_BOTTOM - hh ||
                  electrode_blocks(w, nx, ny, hw, hh);
    if (blocked) {
        human_rehome(w, h);
        return;
    }
    h->x = nx;
    h->y = ny;
    if (--h->walk_steps == 0) human_rehome(w, h);
}

static void update_humans(World *w)
{
    for (int i = 0; i < w->human_count; i++) {
        Human *h = &w->humans[i];
        if (h->rescued) {
            REMOVE_AT(w->humans, w->human_count, i);
            i--;
            continue;
        }
        if (h->prog) {
            h->pass_timer -= 1;
            while (h->pass_timer <= 0) {
                h->pass_timer += PROG_PASS_FRAMES;
                prog_pass(w, h);
            }
        } else {
            h->step_timer -= 1;
            while (h->step_timer <= 0) {
                h->step_timer += HUMAN_STEP_FRAMES;
                human_step(w, h);
            }
        }
        double hw, hh;
        human_size(w, h->kind, &hw, &hh);
        clamp_to_playfield(&h->x, &h->y, hw, hh);
    }
}

static void kill_electrode(World *w, int i)
{
    if (w->dying_count < MAX_ELECTRODES) {
        DyingElectrode *d = &w->dying[w->dying_count++];
        d->x = w->electrodes[i].x;
        d->y = w->electrodes[i].y;
        d->frame = 0;
        d->left = world_electrode_look(w)->frames[0].hold;
    }
    REMOVE_AT(w->electrodes, w->electrode_count, i);
}

static void update_electrodes(World *w)
{
    const ElectrodeLook *look = world_electrode_look(w);
    long c = palette_cycle(look->entry, *w->clock, w->cycle);
    if (c >= 0) w->electrode_tint = (uint32_t)c;
    for (int i = w->dying_count - 1; i >= 0; i--) {
        DyingElectrode *d = &w->dying[i];
        d->left -= 1;
        while (d->left <= 0) {
            d->frame++;
            if (d->frame >= look->nframes) break;
            d->left += look->frames[d->frame].hold;
        }
        if (d->frame >= look->nframes) REMOVE_AT(w->dying, w->dying_count, i);
    }
}

/* Where an enemy shot is tested: sparks and shells at their centre, a missile at its head's top-left. */
static uint32_t enemy_color(EnemyKind k)
{
    switch (k) {
    case EN_ENFORCER: return 0x00AAFF;
    case EN_BRAIN: return 0xFF88FF;
    case EN_TANK: return 0xAAAAAA;
    case EN_QUARK: return 0xF0F0F0;
    default: return 0xFF0000;
    }
}

/* checkCollisions (PLAYING), in the web build's order */
static void check_collisions(World *w)
{
    Player *pl = &w->player;

    for (int i = w->shot_count - 1; i >= 0; i--) {
        Shot *s = &w->shots[i];
        int spent = 0;
        /* player shot vs enemy */
        for (int j = w->enemy_count - 1; j >= 0; j--) {
            Enemy *e = &w->enemies[j];
            if (!e->visible) continue;
            if (e->kind == EN_HULK) {
                /* bullets don't kill a hulk: they nudge it 2 px along their travel */
                if (!near(s->x, s->y, e->x, e->y, 6)) continue;
                double mag = sqrt(s->dx * s->dx + s->dy * s->dy);
                if (mag == 0) mag = 1;
                e->x += s->dx / mag * 2;
                e->y += s->dy / mag * 2;
                REMOVE_AT(w->shots, w->shot_count, i);
                spent = 1;
                break;
            }
            if (!near(s->x, s->y, e->x, e->y, 5)) continue;
            REMOVE_AT(w->shots, w->shot_count, i);
            spent = 1;
            if (--e->health <= 0) {
                EnemyKind k = e->kind;
                unsigned points = (unsigned)e->points;
                double ex = e->x, ey = e->y;
                if (k == EN_SPHEROID) popup(w, ex, ey, points); /* the 1000 shows instead of an explosion */
                else explosion(w, ex, ey, enemy_color(k));
                static const SoundId pop[EN_KINDS] = { SND_GRUNT_POP, SND_GRUNT_POP, SND_SPHEROID_POP, SND_ENFORCER_POP,
                                                       SND_BRAIN_POP, SND_TANK_POP, SND_QUARK_POP };
                sfx(w, pop[k]);
                REMOVE_AT(w->enemies, w->enemy_count, j);
                if (k == EN_GRUNT) pacing_grunt_killed(&w->pacing);
                if (w->state == W_PLAYING) add_score(w, points);
            }
            break;
        }
        /* the web build leaves checkCollisions once a shot is spent on an enemy */
        if (spent) return;

        /* player shot vs prog */
        for (int k = w->human_count - 1; k >= 0; k--) {
            Human *h = &w->humans[k];
            if (!h->prog || !near(s->x, s->y, h->x, h->y, 5)) continue;
            REMOVE_AT(w->shots, w->shot_count, i);
            explosion(w, h->x, h->y, 0xFF55FF);
            sfx(w, SND_PROG_DESTROY);
            REMOVE_AT(w->humans, w->human_count, k);
            if (w->state == W_PLAYING) add_score(w, POINTS_PROG);
            break;
        }
    }

    if (pl->alive && pl->visible) {
        int invulnerable = pl->invuln_ms > 0;

        /* enemy shot vs player */
        for (int i = w->eshot_count - 1; i >= 0; i--) {
            if (!invulnerable && near(w->eshots[i].x, w->eshots[i].y, pl->x, pl->y, 5)) {
                REMOVE_AT(w->eshots, w->eshot_count, i);
                player_hit(w);
                break;
            }
        }

        if (!invulnerable) {
            for (int i = w->enemy_count - 1; i >= 0; i--) {
                const Enemy *e = &w->enemies[i];
                if (e->visible && near(pl->x, pl->y, e->x, e->y, 8)) {
                    player_hit(w);
                    break;
                }
            }
            for (int i = w->human_count - 1; i >= 0; i--) {
                const Human *h = &w->humans[i];
                if (h->prog && near(pl->x, pl->y, h->x, h->y, 8)) {
                    player_hit(w);
                    break;
                }
            }
            for (int i = w->electrode_count - 1; i >= 0; i--) {
                if (near(pl->x, pl->y, w->electrodes[i].x, w->electrodes[i].y, 6)) {
                    player_hit(w);
                    break;
                }
            }
        }

        /* grunt vs electrode: both die, 100 points */
        for (int oi = w->electrode_count - 1; oi >= 0; oi--) {
            for (int ei = w->enemy_count - 1; ei >= 0; ei--) {
                Enemy *e = &w->enemies[ei];
                if (e->kind != EN_GRUNT) continue;
                if (near(w->electrodes[oi].x, w->electrodes[oi].y, e->x, e->y, 5)) {
                    explosion(w, e->x, e->y, 0xFF0000);
                    sfx(w, SND_GRUNT_POP);
                    REMOVE_AT(w->enemies, w->enemy_count, ei);
                    pacing_grunt_killed(&w->pacing);
                    kill_electrode(w, oi);
                    if (w->state == W_PLAYING) add_score(w, POINTS_GRUNT);
                    break;
                }
            }
        }

        /* player shot vs electrode: one shot destroys it, no points */
        for (int pi = w->shot_count - 1; pi >= 0; pi--) {
            for (int oi = w->electrode_count - 1; oi >= 0; oi--) {
                if (near(w->shots[pi].x, w->shots[pi].y, w->electrodes[oi].x, w->electrodes[oi].y, 5)) {
                    REMOVE_AT(w->shots, w->shot_count, pi);
                    kill_electrode(w, oi);
                    break;
                }
            }
        }

        /* player shot vs enemy shot: sparks, missiles and shells die for 25 points */
        for (int pi = w->shot_count - 1; pi >= 0; pi--) {
            for (int ei = w->eshot_count - 1; ei >= 0; ei--) {
                if (near(w->shots[pi].x, w->shots[pi].y, w->eshots[ei].x, w->eshots[ei].y, 5)) {
                    EnemyShotKind k = w->eshots[ei].kind;
                    REMOVE_AT(w->shots, w->shot_count, pi);
                    REMOVE_AT(w->eshots, w->eshot_count, ei);
                    sfx(w, SND_SUB_QUARK_POP);
                    if (w->state == W_PLAYING)
                        add_score(w, k == ES_SPARK ? POINTS_SPARK : k == ES_MISSILE ? POINTS_MISSILE : POINTS_SHELL);
                    break;
                }
            }
        }

        /* rescue */
        for (int i = w->human_count - 1; i >= 0; i--) {
            Human *h = &w->humans[i];
            if (h->prog || h->rescued || !near(pl->x, pl->y, h->x, h->y, 18)) continue;
            h->rescued = 1;
            popup(w, h->x, h->y, w->bonus);
            if (w->state == W_PLAYING) {
                add_score(w, w->bonus);
                sfx(w, SND_HUMAN_RESCUE);
                if (w->bonus < MAX_BONUS) w->bonus += BONUS_STEP;
            }
        }
    }

    /* tank shell vs human */
    for (int i = w->eshot_count - 1; i >= 0; i--) {
        if (w->eshots[i].kind != ES_SHELL) continue;
        for (int j = w->human_count - 1; j >= 0; j--) {
            const Human *h = &w->humans[j];
            if (h->prog || !near(w->eshots[i].x, w->eshots[i].y, h->x, h->y, 5)) continue;
            explosion(w, h->x, h->y, 0xCCCCCC);
            sfx(w, SND_HUMAN_DEATH);
            REMOVE_AT(w->eshots, w->eshot_count, i);
            REMOVE_AT(w->humans, w->human_count, j);
            break;
        }
    }

    /* hulk vs human: trampled (the rescue bonus is not reset) */
    for (int i = w->enemy_count - 1; i >= 0; i--) {
        const Enemy *e = &w->enemies[i];
        if (e->kind != EN_HULK) continue;
        for (int j = w->human_count - 1; j >= 0; j--) {
            const Human *h = &w->humans[j];
            if (h->prog || h->rescued || !near(e->x, e->y, h->x, h->y, 10)) continue;
            explosion(w, h->x, h->y, 0xCCCCCC);
            sfx(w, SND_HUMAN_DEATH);
            REMOVE_AT(w->humans, w->human_count, j);
        }
    }
}

static void check_wave_completion(World *w)
{
    if (w->state != W_PLAYING) return;
    for (int i = 0; i < w->enemy_count; i++)
        if (w->enemies[i].kind != EN_HULK) return;
    start_wave_clear(w);
}

/* Things the web build animates on its ticker, every frame whatever the state. */
static void ticker(World *w)
{
    for (int i = 0; i < w->enemy_count; i++) {
        Enemy *e = &w->enemies[i];
        /* AnimatedSprites: animationSpeed 0.2 / 0.1 / 0.2 over 8 / 4 / 3 frames */
        if (e->kind == EN_SPHEROID) {
            e->anim += 0.2;
            e->frame = (int)e->anim % 8;
        } else if (e->kind == EN_TANK) {
            e->anim += 0.1;
            e->frame = (int)e->anim % 4;
        } else if (e->kind == EN_QUARK) {
            e->anim += 0.2;
            e->frame = (int)e->anim % 3;
        }
    }
}

/* ---- public ------------------------------------------------------------------ */

int world_can_play(const Assets *a)
{
    return a->have_waves && a->have_params && a->have_electrodes;
}

static void atlas_size(const Assets *a, const char *name, int *w, int *h, int dw, int dh)
{
    const AtlasFrame *f = atlas_frame(&a->atlas, name);
    *w = f ? f->w : dw;
    *h = f ? f->h : dh;
}

static void world_init(World *w, const Assets *a, Prng *prng, const unsigned long *clock, CycleA *cycle);

unsigned world_player_score(const World *w, int player)
{
    return player == w->current ? w->score : w->slots[player].score;
}

unsigned world_best_score(const World *w)
{
    unsigned best = w->score;
    for (int i = 0; i < w->player_count; i++)
        if (i != w->current && w->slots[i].score > best) best = w->slots[i].score;
    return best;
}

void world_start(World *w, const Assets *a, Prng *prng, const unsigned long *clock, CycleA *cycle,
                 const OperatorSettings *op, int players)
{
    w->op = *op;
    world_init(w, a, prng, clock, cycle);
    w->player_count = players == 2 ? 2 : 1;
    for (int i = 0; i < w->player_count; i++) {
        w->slots[i].lives = w->op.turns;
        w->slots[i].wave = 1;
        w->slots[i].bonus = INITIAL_BONUS;
        w->slots[i].next_extra = (unsigned)w->op.extra_man_every;
    }
    sfx(w, SND_WAVE_START); /* pressing start: the game-start sound */
    start_next_wave(w);
    start_beam_in(w);
}

static void world_init(World *w, const Assets *a, Prng *prng, const unsigned long *clock, CycleA *cycle)
{
    unsigned qualify = w->qualify_min, cursor = w->hulk_cursor;
    OperatorSettings op = w->op;
    memset(w, 0, sizeof *w);
    w->op = op;
    if (w->op.turns < 1) w->op = OPERATOR_FACTORY; /* demo / unset */
    w->qualify_min = qualify;
    w->hulk_cursor = cursor;
    w->assets = a;
    w->prng = prng;
    w->clock = clock;
    w->cycle = cycle;
    prng_reset(&w->fx);
    prng_seed(&w->aux, 0x00, 0x13, 0x37);
    pacing_init(&w->pacing, a, w->op.difficulty, w->op.turns);
    atlas_size(a, "player_0", &w->player_w, &w->player_h, 8, 12);
    atlas_size(a, "grunt_0", &w->enemy_w[EN_GRUNT], &w->enemy_h[EN_GRUNT], 10, 13);
    atlas_size(a, "hulk_0", &w->enemy_w[EN_HULK], &w->enemy_h[EN_HULK], 14, 16);
    atlas_size(a, "spheroid_0", &w->enemy_w[EN_SPHEROID], &w->enemy_h[EN_SPHEROID], 16, 15);
    atlas_size(a, "enforcer_spawn_0", &w->enemy_w[EN_ENFORCER], &w->enemy_h[EN_ENFORCER], 10, 11);
    atlas_size(a, "spark_0", &w->spark_w, &w->spark_h, 8, 7);
    atlas_size(a, "brain_0", &w->enemy_w[EN_BRAIN], &w->enemy_h[EN_BRAIN], 14, 16);
    atlas_size(a, "tank_0", &w->enemy_w[EN_TANK], &w->enemy_h[EN_TANK], 14, 16);
    atlas_size(a, "quark_0", &w->enemy_w[EN_QUARK], &w->enemy_h[EN_QUARK], 10, 10);
    atlas_size(a, "mommy_0", &w->human_w[HU_MOMMY], &w->human_h[HU_MOMMY], 8, 14);
    atlas_size(a, "daddy_0", &w->human_w[HU_DADDY], &w->human_h[HU_DADDY], 10, 13);
    atlas_size(a, "mikey_0", &w->human_w[HU_MIKEY], &w->human_h[HU_MIKEY], 6, 11);

    /* resetGameVariables */
    w->lives = w->op.turns;
    w->extra_man_every = w->op.extra_man_every;
    w->next_extra = (unsigned)w->op.extra_man_every;
    w->bonus = INITIAL_BONUS;
    w->border_visible = 1;
    w->hud_visible = 1;
    border_set_wave(w, 1);

    /* createPlayer */
    player_center(w);
    w->player.frame = 6;
    w->player.walk_seq = -1;
    w->player.alive = 1;
    w->player.visible = 1;
    w->player.alpha = 1;
    w->player.invuln_ms = RESPAWN_INVULNERABILITY_MS;
}

void world_start_demo(World *w, const Assets *a, Prng *prng, const unsigned long *clock, CycleA *cycle)
{
    world_init(w, a, prng, clock, cycle);
    w->state = W_DEMO;
    w->hud_visible = 0;
    w->wave = 1;
    w->player.invuln_ms = 0;
    w->player.x = PF_LEFT + (PF_RIGHT - PF_LEFT) * 0.25;
    w->player.y = PF_TOP + (PF_BOTTOM - PF_TOP) * 0.5;
    w->demo_move_timer = 0;
    w->demo_shoot_timer = 0;
#define PX(f) (PF_LEFT + (PF_RIGHT - PF_LEFT) * (f))
#define PY(f) (PF_TOP + (PF_BOTTOM - PF_TOP) * (f))
    Enemy *e = create_grunt(w);
    e->x = PX(0.75);
    e->y = PY(0.25);
    e = create_enemy(w, EN_HULK, 1 << 30, 0);
    e->x = PX(0.7);
    e->y = PY(0.6);
    e = create_brain(w);
    e->x = PX(0.75);
    e->y = PY(0.75);
    Human *h = create_human(w, (HumanKind)(int)(aux_float(w) * 3));
    h->x = PX(0.6);
    h->y = PY(0.3);
#undef PX
#undef PY
}

/* updateDemoPlayerAI: random headings (the demo man never moves: Player.update
   only runs while PLAYING) and a shot at the nearest destructible enemy */
static void demo_ai(World *w)
{
    Player *p = &w->player;
    if (--w->demo_move_timer <= 0) {
        double dx = (aux_float(w) - 0.5) * 2, dy = (aux_float(w) - 0.5) * 2, len = sqrt(dx * dx + dy * dy);
        p->dx = len > 0 ? dx / len : dx;
        p->dy = len > 0 ? dy / len : dy;
        w->demo_move_timer = 60 + aux_float(w) * 60;
    }
    if (--w->demo_shoot_timer <= 0) {
        const Enemy *nearest = NULL;
        double best = 1e30;
        for (int i = 0; i < w->enemy_count; i++) {
            const Enemy *e = &w->enemies[i];
            if (e->kind == EN_HULK) continue;
            double d = (p->x - e->x) * (p->x - e->x) + (p->y - e->y) * (p->y - e->y);
            if (d < best) { best = d; nearest = e; }
        }
        double sx = (aux_float(w) - 0.5) * 2, sy = (aux_float(w) - 0.5) * 2;
        if (nearest) {
            double ang = atan2(nearest->y - p->y, nearest->x - p->x);
            sx = cos(ang);
            sy = sin(ang);
        }
        double len = sqrt(sx * sx + sy * sy);
        if (len > 0 && w->shot_count < MAX_PLAYER_SHOTS) {
            Shot *s = &w->shots[w->shot_count++];
            s->x = p->x;
            s->y = p->y;
            s->dx = sx / len * PROJECTILE_SPEED;
            s->dy = sy / len * PROJECTILE_SPEED;
        }
        w->demo_shoot_timer = 90 + aux_float(w) * 30;
    }
}

void world_step(World *w, const PlayInput *in)
{
    w->frame++;
    border_tick(w);
    update_popups(w);
    ticker(w);
    if (w->inter_frames > 0 && --w->inter_frames == 0 && w->state != W_GAME_OVER && w->state != W_DONE) {
        /* the incoming player's wave starts fresh; restore the player even if a
           wave clear took over meanwhile */
        if (w->state == W_PLAYING) start_next_wave(w);
        player_center(w);
        w->player.visible = 1;
        w->player.alive = 1;
        w->player.invuln_ms = RESPAWN_INVULNERABILITY_MS;
    }

    switch (w->state) {
    case W_PLAYING:
        if (w->player.invuln_ms > 0) {
            w->player.invuln_ms -= FRAME_MS;
            if (w->player.invuln_ms < 0) w->player.invuln_ms = 0;
        }
        player_input_and_update(w, in);
        update_shots(w);
        update_enemy_shots(w);
        update_enemies(w);
        update_humans(w);
        update_electrodes(w);
        update_particles(w);
        check_collisions(w);
        check_extra_life(w);
        check_wave_completion(w);
        break;
    case W_BEAM_IN:
        step_beam_in(w);
        break;
    case W_WAVE_CLEAR:
        step_wave_clear(w);
        break;
    case W_DEATH:
        if (beat_step(w)) {
            if (w->swap_after_beat) {
                /* swapAfterDeath: play runs on unmanned under the PLAYER N interstitial */
                w->state = W_PLAYING;
                w->player.visible = 0;
                w->inter_frames = INTERSTITIAL_FRAMES;
            } else {
                relay_wave(w);
            }
        }
        break;
    case W_GAME_OVER:
        step_game_over(w);
        break;
    case W_DONE:
        break;
    case W_DEMO:
        demo_ai(w);
        update_shots(w);
        update_enemy_shots(w);
        update_enemies(w);
        update_humans(w);
        update_particles(w);
        check_collisions(w);
        break;
    }
}
