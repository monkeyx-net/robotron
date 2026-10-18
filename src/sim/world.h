/*
 * The gameplay simulation (waves 1-4): player, shots, grunts, hulks,
 * spheroids, enforcers and their sparks, electrodes and the family, wave start and clear, death and game over,
 * scoring. A port of the web build's gameLogic.ts, player.ts, projectiles.ts,
 * enemies.ts, humans.ts, obstacles.ts, WaveTransition.ts and DeathBeat.ts,
 * stepping once per 60 Hz frame. Pure C: no SDL, no drawing (gfx/play.c).
 *
 * Gameplay randomness comes from the ROM PRNG in the web build's call order;
 * the web build's untraced Math.random gameplay (spheroid wander) from `aux`;
 * cosmetic randomness (explosions, beam-in, death flashes) from `fx`.
 */
#ifndef ROBOTRON_WORLD_H
#define ROBOTRON_WORLD_H

#include "assets/assets.h"
#include "sim/pacing.h"
#include "sim/prng.h"
#include "gfx/palette.h"

/* GameConfig */
#define PF_LEFT 7
#define PF_TOP 17
#define PF_RIGHT 285
#define PF_BOTTOM 229
#define GAME_W 292
#define GAME_H 240

#define MAX_ENEMIES 256
#define MAX_HUMANS 64
#define MAX_ELECTRODES 64
#define MAX_PLAYER_SHOTS 10
#define MAX_ENEMY_SHOTS 64
#define MAX_PARTICLES 1024
#define MAX_POPUPS 16

typedef enum {
    W_PLAYING,          /* gameplay runs */
    W_BEAM_IN,          /* WAVE_TRANSITION: enemies beam in, then the player */
    W_WAVE_CLEAR,       /* WAVE_TRANSITION: rings, flash, then the next wave */
    W_DEATH,            /* WAVE_TRANSITION: the death beat, then the wave re-lays */
    W_GAME_OVER,        /* death beat, GAME OVER, erase */
    W_DONE              /* game finished: the caller shows the heroes screen */
} WorldState;

typedef enum { EN_GRUNT, EN_HULK, EN_SPHEROID, EN_ENFORCER, EN_KINDS } EnemyKind;
typedef enum { HU_MOMMY, HU_DADDY, HU_MIKEY } HumanKind;

typedef struct {
    double x, y;          /* centre */
    double dx, dy;        /* velocity: movement vector * 2 (only the sign moves it) */
    int frame;            /* walk frame 0-11 (left 0-2, right 3-5, down 6-8, up 9-11) */
    int walk_seq;         /* -1 none, else 0-3 (left, right, down, up) */
    int walk_pos, walk_tick;
    double last_shot_ms;
    int alive, visible;
    double invuln_ms;     /* playerInvulnerableTime */
    double alpha;         /* pulses while invulnerable */
    int shield;           /* the invulnerability circle is shown */
} Player;

typedef struct {
    EnemyKind kind;
    double x, y;
    double dx, dy;        /* spheroid / enforcer velocity */
    int frame;            /* atlas frame within the family */
    int health, points;
    int visible;
    int step_countdown;   /* grunt: 0 = not armed yet */
    /* hulk */
    int walk_table, walk_idx, walk_steps, target_id; /* walk_table -1 = not started; target 0 = player */
    double step_timer;
    /* spheroid */
    int drops_left, dropping, leaving;
    double drop_timer, pulse, anim;
    /* enforcer */
    double age, pass_timer;
    int aim_passes, shoot_passes, active;
} Enemy;

typedef struct {
    int id;               /* unique per human, for hulk targets */
    HumanKind kind;
    double x, y;
    int frame;
    int walk_table, walk_idx, walk_steps;
    double step_timer;
    int rescued;
} Human;

typedef struct {
    double x, y;          /* centre of the look's frame */
} Electrode;

typedef struct {
    double x, y;
    int frame;            /* look frame being shown */
    double left;          /* frames left on it */
} DyingElectrode;

typedef struct {
    double x, y, dx, dy;
} Shot;

/* Enforcer spark ($5404 / $54A8) */
typedef struct {
    double x, y, dx, dy, ix, iy, pass_timer;
    int life, frame;
} Spark;

typedef struct {
    double x, y, vx, vy, life, max_life, rotation, rotation_speed, size;
    double alpha, scale;  /* as drawn: set from life before it ticks down */
    int ring;
    uint32_t color;
} Particle;

typedef struct {
    double x, y;
    unsigned points;
    int frames;
} Popup;

/* One enemy's beam-in (WaveTransition.materialize). */
typedef struct {
    int horizontal;
    double delay, dur, spread;
    int done;
} Beam;

typedef struct {
    int move_x, move_y;   /* -1, 0, 1 */
    int fire_x, fire_y;
} PlayInput;

typedef struct {
    const Assets *assets;
    Prng *prng;           /* the shared ROM PRNG */
    const unsigned long *clock; /* global frame clock (colour cycling) */
    CycleA *cycle;        /* palette entry A, shared with the HUD */
    Prng fx;              /* cosmetic */
    Prng aux;             /* untraced gameplay randomness (web Math.random) */
    Pacing pacing;

    WorldState state;
    unsigned long frame;  /* updates since the game started */
    int wave, lives;
    unsigned score, next_extra, bonus;
    int extra_man_every;

    Player player;
    Enemy enemies[MAX_ENEMIES];
    int enemy_count;
    Human humans[MAX_HUMANS];
    int human_count;
    Electrode electrodes[MAX_ELECTRODES];
    int electrode_count;
    uint32_t electrode_tint;   /* set while electrodes update (frozen otherwise) */
    DyingElectrode dying[MAX_ELECTRODES];
    int dying_count;
    Shot shots[MAX_PLAYER_SHOTS];
    int shot_count;
    Spark sparks[MAX_ENEMY_SHOTS];
    int spark_count;
    int next_human_id;
    unsigned hulk_cursor; /* round-robin hulk targets; persists across games, as in the web build */
    Particle particles[MAX_PARTICLES];
    int particle_count;
    Popup popups[MAX_POPUPS];
    int popup_count;

    /* transitions */
    int t_frame;              /* frames into the current transition */
    Beam beams[MAX_ENEMIES];  /* one per enemy during W_BEAM_IN */
    int star_start;           /* frame the player starburst began, -1 before */
    int border_visible;
    int border_wave;          /* ArcadeBorder style */
    int border_frames, border_step;
    uint32_t border_color;

    /* death beat (DeathBeat.ts) */
    int beat_active, beat_frames, beat_slot;
    double beat_x, beat_y;
    int beat_frame;           /* player frame frozen at death */
    int beat_visible;
    uint32_t beat_color;

    /* game over (ui.ts showGameOverScreen) */
    int go_frames;
    int go_text;              /* GAME OVER shown */
    int go_erase_x;           /* > 0: black from this x rightwards */
    int hud_visible;
    unsigned qualify_min; /* a score above this earns initials (set by the caller) */

    /* sizes from the atlas */
    int player_w, player_h;
    int enemy_w[EN_KINDS], enemy_h[EN_KINDS];
    int spark_w, spark_h;
    int human_w[3], human_h[3];
} World;

/* Can a game start? Needs the extracted ROM tables. */
int world_can_play(const Assets *a);
/* startGameFromTitle: reset, wave 1, beam in. */
void world_start(World *w, const Assets *a, Prng *prng, const unsigned long *clock, CycleA *cycle);
void world_step(World *w, const PlayInput *in);

/* Palette entry for electrodes on the current wave, and the look. */
const ElectrodeLook *world_electrode_look(const World *w);

#endif
