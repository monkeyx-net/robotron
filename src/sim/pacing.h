/*
 * Per-wave enemy pacing, as js/core/WaveParams.ts and WavePacing.ts: the
 * ROM's 12 wave parameters ($BE5C-$BE67) nudged by the operator DIFFICULTY OF
 * PLAY, the grunt step bound/floor with the kill speed-up, the in-wave ramp,
 * and the waves 1-4 mercy table. Tables come from assets/data/waveparams.txt.
 */
#ifndef ROBOTRON_PACING_H
#define ROBOTRON_PACING_H

#include "assets/assets.h"
#include "sim/prng.h"

typedef enum {
    P_GRUNT_BOUND, P_GRUNT_FLOOR, P_CHILD_BOUND, P_ENFORCER_SHOT, P_SPHEROID_DROP, P_HULK_STEP,
    P_BRAIN_MISSILE, P_BRAIN_STEP, P_TANK_SHOT, P_TANK_SHELL_SPEED, P_QUARK_DROP, P_QUARK_SPEED,
    PARAM_COUNT
} ParamId;

#define GRUNT_TICK_FRAMES 4

typedef struct {
    const Assets *assets;
    int difficulty;   /* operator DIFFICULTY OF PLAY, 0-10 (5 recommended) */
    int turns;        /* operator TURNS PER PLAYER */
    int wave;
    int wave_params[PARAM_COUNT]; /* as set at wave init */
    int params[PARAM_COUNT];      /* live: wave init + mercy */
    int bound, floor;
    int score_events;             /* DP $F0 */
    int ramp_ticks, ramp_frames, grunt_clock;
} Pacing;

/* getWaveParams: parameters for a 1-based wave. */
void wave_params(const Assets *a, int wave, int difficulty, int lives, int out[PARAM_COUNT]);

void pacing_init(Pacing *p, const Assets *a, int difficulty, int turns);
void pacing_begin_wave(Pacing *p, int wave, int reserve);
void pacing_on_death(Pacing *p, int reserve);
void pacing_note_score(Pacing *p);
void pacing_grunt_killed(Pacing *p);
/* One frame; returns the grunt-process ticks that fell due. */
int pacing_update(Pacing *p, int live_grunts);
/* prng_bounded($BE5C): 1..bound */
int pacing_next_grunt_delay(Pacing *p, Prng *r);
/* ROM $D6B6: a PRNG byte halved until <= a, at least 1 */
int prng_le(Prng *r, int a);
/* ceil(prng_le($BE5E) / 2) */
int pacing_child_count(Pacing *p, Prng *r);

#endif
