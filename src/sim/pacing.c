#include "sim/pacing.h"

#include <stdlib.h>
#include <string.h>

#define RAMP_FIRST_TICKS 18
#define RAMP_TICKS 15
#define RAMP_TICK_FRAMES 15

void wave_params(const Assets *a, int wave, int difficulty, int lives, int out[PARAM_COUNT])
{
    int b = difficulty < 0 ? 0 : difficulty > 10 ? 10 : difficulty;
    if (b < 5) {
        if (wave >= 14) b = 5;
        if (wave >= 5 && lives >= 3) b = 5;
    }
    int d = b - 5;
    int w = wave < 1 ? 1 : wave;
    while (w > 40) w -= 20;
    for (int i = 0; i < PARAM_COUNT; i++) {
        const unsigned char *t = a->params[i];
        int hdr = t[0], min = t[1], max = t[2], v = t[2 + w];
        int p = v * ((abs(d) * (hdr & 0x1F)) & 0xFF);
        int delta = (p >> 8) + ((p >> 7) & 1); /* MUL then ADCA #0 (round) */
        int negative = ((d & 0xFF) ^ hdr) & 0x80;
        int r;
        if (negative) {
            r = v - delta;
            if (r < 0) r = min;
        } else {
            r = v + delta;
            if (r > 0xFF) r = max;
        }
        out[i] = r < min ? min : r > max ? max : r;
    }
}

static void apply_mercy(Pacing *p, int reserve)
{
    if (p->wave < 1 || p->wave > 4) return;
    if (reserve == 0 || (p->wave <= 2 && reserve < p->turns - 1)) {
        const unsigned char *m = p->assets->mercy[p->wave - 1];
        p->params[P_SPHEROID_DROP] = m[0];
        p->params[P_ENFORCER_SHOT] = m[1];
        p->bound = m[2];
        p->floor = m[3];
    }
}

static void restart_ramp(Pacing *p)
{
    p->ramp_ticks = RAMP_FIRST_TICKS;
    p->ramp_frames = 0;
    p->score_events = 0;
}

void pacing_init(Pacing *p, const Assets *a, int difficulty, int turns)
{
    memset(p, 0, sizeof *p);
    p->assets = a;
    p->difficulty = difficulty;
    p->turns = turns;
    p->wave = 1;
    wave_params(a, 1, difficulty, 3, p->wave_params);
    memcpy(p->params, p->wave_params, sizeof p->params);
    p->bound = p->params[P_GRUNT_BOUND];
    p->floor = p->params[P_GRUNT_FLOOR];
    restart_ramp(p);
}

void pacing_begin_wave(Pacing *p, int wave, int reserve)
{
    p->wave = wave < 1 ? 1 : wave;
    wave_params(p->assets, p->wave, p->difficulty, reserve, p->wave_params);
    memcpy(p->params, p->wave_params, sizeof p->params);
    p->bound = p->params[P_GRUNT_BOUND];
    p->floor = p->params[P_GRUNT_FLOOR];
    apply_mercy(p, reserve);
    restart_ramp(p);
}

void pacing_on_death(Pacing *p, int reserve)
{
    memcpy(p->params, p->wave_params, sizeof p->params);
    p->floor = p->wave_params[P_GRUNT_FLOOR];
    if (p->bound < p->floor) p->bound = p->floor;
    apply_mercy(p, reserve);
    restart_ramp(p);
}

void pacing_note_score(Pacing *p)
{
    p->score_events++;
}

void pacing_grunt_killed(Pacing *p)
{
    int next = (p->bound * 0xE0) >> 8;
    if (next >= p->floor) p->bound = next;
}

int pacing_update(Pacing *p, int live_grunts)
{
    if (++p->ramp_frames >= RAMP_TICK_FRAMES) {
        p->ramp_frames -= RAMP_TICK_FRAMES;
        if (--p->ramp_ticks <= 0) {
            p->ramp_ticks = RAMP_TICKS;
            if (live_grunts < 30) {
                int df = p->score_events ? -1 : -2, db = p->score_events ? -2 : -4;
                p->score_events = 0;
                p->floor = p->floor + df < 1 ? 1 : p->floor + df;
                p->bound = p->bound + db < p->floor ? p->floor : p->bound + db;
            }
        }
    }
    if (++p->grunt_clock >= GRUNT_TICK_FRAMES) {
        p->grunt_clock -= GRUNT_TICK_FRAMES;
        return 1;
    }
    return 0;
}

int pacing_next_grunt_delay(Pacing *p, Prng *r)
{
    return ((prng_step(r) * p->bound) >> 8) + 1;
}

int prng_le(Prng *r, int a)
{
    int v = prng_step(r);
    while (v > a) v >>= 1;
    return v ? v : 1;
}

int pacing_child_count(Pacing *p, Prng *r)
{
    int n = prng_le(r, p->params[P_CHILD_BOUND]);
    return (n >> 1) + (n & 1);
}
