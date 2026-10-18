/*
 * Gameplay flow checks on the sim (needs the extracted ROM tables):
 *   - a game starts on wave 1 with the ROM's counts and beams in, then plays
 *   - clearing the grunts runs the wave-clear sequence into wave 2
 *   - a hit costs a man and re-lays the wave; the last man ends the game
 *
 *   test_world   (finds assets like the game: ROBOTRON_ASSETS / build/assets)
 */
#include <stdio.h>
#include <string.h>

#include "assets/assets.h"
#include "sim/world.h"

static int failures;
#define CHECK(cond, ...)                                                    \
    do {                                                                    \
        if (!(cond)) {                                                      \
            failures++;                                                     \
            fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__);            \
            fprintf(stderr, __VA_ARGS__);                                   \
            fputc('\n', stderr);                                            \
        }                                                                   \
    } while (0)

static Assets assets;
static World w;
static Prng prng;
static unsigned long clk;
static CycleA cycle;
static const PlayInput idle = {0};

static int run_until(WorldState s, int max)
{
    for (int i = 0; i < max; i++) {
        if (w.state == s) return i;
        clk++;
        world_step(&w, &idle);
    }
    return -1;
}

int main(int argc, char **argv)
{
    char err[512];
    if (assets_load(&assets, argc > 1 ? argv[1] : NULL, err, sizeof err)) {
        fprintf(stderr, "%s\n", err);
        return 1;
    }
    if (!world_can_play(&assets)) {
        fprintf(stderr, "ROM tables missing (run robotron --extract)\n");
        return 1;
    }
    prng_reset(&prng);
    cycle_a_init(&cycle);
    w.qualify_min = 1u << 30; /* never qualifies: the full erase runs */
    world_start(&w, &assets, &prng, &clk, &cycle, &OPERATOR_FACTORY, 1);

    /* wave 1 from the ROM table, beaming in */
    CHECK(w.wave == 1 && w.lives == 3 && w.score == 0, "start: wave %d lives %d", w.wave, w.lives);
    CHECK(w.enemy_count == assets.waves[0][W_GRUNTS], "grunts %d", w.enemy_count);
    CHECK(w.electrode_count == assets.waves[0][W_ELECTRODES], "electrodes %d", w.electrode_count);
    int family = assets.waves[0][W_MOMMIES] + assets.waves[0][W_DADDIES] + assets.waves[0][W_MIKEYS];
    CHECK(w.human_count == family, "family %d", w.human_count);
    CHECK(w.state == W_BEAM_IN && !w.player.visible, "beam-in");
    int n = run_until(W_PLAYING, 200);
    CHECK(n > 20 && n < 100, "beam-in took %d frames", n);
    CHECK(w.player.visible && w.player.invuln_ms > 0, "player shown, invulnerable");
    for (int i = 0; i < w.enemy_count; i++) {
        const Enemy *e = &w.enemies[i];
        CHECK(e->x >= PF_LEFT && e->x <= PF_RIGHT && e->y >= PF_TOP && e->y <= PF_BOTTOM, "grunt %d in playfield", i);
    }

    /* clear the wave: rings, then wave 2 beams in */
    w.enemy_count = 0;
    clk++;
    world_step(&w, &idle);
    CHECK(w.state == W_WAVE_CLEAR && w.human_count == 0 && !w.border_visible, "wave clear starts");
    n = run_until(W_BEAM_IN, 200);
    CHECK(n == 66, "next wave after %d frames (66 in WaveTransition.ts)", n);
    int expect2 = assets.waves[1][W_GRUNTS] + assets.waves[1][W_HULKS] + assets.waves[1][W_SPHEROIDS];
    CHECK(w.wave == 2 && w.enemy_count == expect2 && w.border_visible, "wave 2 laid: %d of %d", w.enemy_count, expect2);
    CHECK(run_until(W_PLAYING, 200) > 0, "wave 2 plays");

    /* hulks walk and are only nudged by shots; the spheroid drops an enforcer, which fires sparks */
    int hulk = -1;
    for (int i = 0; i < w.enemy_count; i++)
        if (w.enemies[i].kind == EN_HULK) { hulk = i; break; }
    CHECK(hulk >= 0, "a hulk on wave 2");
    double hx = w.enemies[hulk].x, hy = w.enemies[hulk].y;
    w.player.invuln_ms = 1e9; /* keep the player alive while the wave runs */
    int enforcers = 0, sparks = 0;
    for (int f = 0; f < 1500 && w.state == W_PLAYING; f++) {
        clk++;
        world_step(&w, &idle);
        for (int i = 0; i < w.enemy_count; i++) enforcers |= w.enemies[i].kind == EN_ENFORCER;
        sparks |= w.eshot_count > 0;
        w.player.invuln_ms = 1e9;
    }
    CHECK(w.state == W_PLAYING, "still playing");
    for (int i = 0; i < w.enemy_count; i++)
        if (w.enemies[i].kind == EN_HULK) { hulk = i; break; }
    CHECK(w.enemies[hulk].x != hx || w.enemies[hulk].y != hy, "hulk walked");
    CHECK(enforcers, "spheroid dropped an enforcer");
    CHECK(sparks, "enforcer fired sparks");
    double nx = w.enemies[hulk].x;
    w.shots[0].x = w.enemies[hulk].x - 3;
    w.shots[0].y = w.enemies[hulk].y;
    w.shots[0].dx = 4;
    w.shots[0].dy = 0;
    w.shot_count = 1;
    int count = w.enemy_count;
    w.player.invuln_ms = 1e9;
    clk++;
    world_step(&w, &idle);
    CHECK(w.enemy_count >= count && w.shot_count == 0, "shot spent on the hulk, hulk alive");
    CHECK(w.enemies[hulk].x > nx, "hulk nudged right (%.1f -> %.1f)", nx, w.enemies[hulk].x);
    w.player.invuln_ms = 0;

    /* a hit: the death beat, then the wave re-lays with what is left (enforcers and sparks go) */
    int grunts = 0;
    for (int i = 0; i < w.enemy_count; i++) grunts += w.enemies[i].kind != EN_ENFORCER;
    w.player.invuln_ms = 0;
    w.enemies[0].x = w.player.x;
    w.enemies[0].y = w.player.y;
    clk++;
    world_step(&w, &idle);
    CHECK(w.state == W_DEATH && w.lives == 2 && w.bonus == 1000, "hit: state %d lives %d", w.state, w.lives);
    n = run_until(W_BEAM_IN, 200);
    CHECK(n == 104, "re-lay after %d frames (DeathBeat: 104)", n);
    CHECK(w.enemy_count == grunts && w.eshot_count == 0 && w.wave == 2, "same wave, %d of %d survivors", w.enemy_count, grunts);
    CHECK(run_until(W_PLAYING, 200) > 0, "plays again");

    /* jump to a wave: clear this one with the wave counter set just below */
    #define GOTO_WAVE(n)                                                     \
        do {                                                                 \
            w.wave = (n) - 1;                                                \
            w.enemy_count = 0;                                               \
            run_until(W_WAVE_CLEAR, 5);                                      \
            run_until(W_PLAYING, 400);                                       \
        } while (0)

    /* wave 5: brains turn humans into progs and fire cruise missiles */
    GOTO_WAVE(5);
    CHECK(w.wave == 5 && w.state == W_PLAYING, "wave 5");
    int brains = 0;
    for (int i = 0; i < w.enemy_count; i++) brains += w.enemies[i].kind == EN_BRAIN;
    CHECK(brains == assets.waves[4][W_BRAINS], "brains %d", brains);
    int progs = 0, missiles = 0;
    for (int f = 0; f < 1500 && w.state == W_PLAYING; f++) {
        w.player.invuln_ms = 1e9;
        clk++;
        world_step(&w, &idle);
        for (int i = 0; i < w.human_count; i++) progs |= w.humans[i].prog;
        for (int i = 0; i < w.eshot_count; i++) missiles |= w.eshots[i].kind == ES_MISSILE;
    }
    CHECK(progs, "a human was reprogrammed");
    CHECK(missiles, "a brain fired a cruise missile");

    /* wave 7: quarks drop tanks, which fire shells */
    GOTO_WAVE(7);
    CHECK(w.wave == 7 && w.state == W_PLAYING, "wave 7");
    int quarks = 0, tanks = 0, shells = 0;
    for (int i = 0; i < w.enemy_count; i++) quarks += w.enemies[i].kind == EN_QUARK;
    CHECK(quarks == assets.waves[6][W_QUARKS], "quarks %d", quarks);
    for (int f = 0; f < 2000 && w.state == W_PLAYING; f++) {
        w.player.invuln_ms = 1e9;
        clk++;
        world_step(&w, &idle);
        for (int i = 0; i < w.enemy_count; i++) tanks |= w.enemies[i].kind == EN_TANK;
        for (int i = 0; i < w.eshot_count; i++) shells |= w.eshots[i].kind == ES_SHELL;
    }
    CHECK(tanks, "a quark dropped a tank");
    CHECK(shells, "a tank fired a shell");
    /* every wave lays out and plays (waves past 40 cycle 21-40) */
    for (int wave = 8; wave <= 41; wave++) {
        GOTO_WAVE(wave);
        int idx = wave > 40 ? wave - 20 : wave;
        int expect = 0;
        for (int k = W_GRUNTS; k <= W_QUARKS; k++)
            if (k == W_GRUNTS || k == W_HULKS || k == W_BRAINS || k == W_SPHEROIDS || k == W_QUARKS)
                expect += assets.waves[idx - 1][k];
        CHECK(w.wave == wave && w.enemy_count == expect, "wave %d: %d of %d enemies", wave, w.enemy_count, expect);
        for (int f = 0; f < 120 && w.state == W_PLAYING; f++) {
            w.player.invuln_ms = 1e9;
            clk++;
            world_step(&w, &idle);
        }
        for (int i = 0; i < w.enemy_count; i++) {
            const Enemy *e = &w.enemies[i];
            CHECK(e->x >= PF_LEFT - 8 && e->x <= PF_RIGHT + 8 && e->y >= PF_TOP - 8 && e->y <= PF_BOTTOM + 8,
                  "wave %d enemy %d (kind %d) at %.0f,%.0f", wave, i, e->kind, e->x, e->y);
        }
    }
    w.player.invuln_ms = 0;

    /* last man: game over, then done */
    w.lives = 1;
    w.player.invuln_ms = 0;
    w.enemies[0].x = w.player.x;
    w.enemies[0].y = w.player.y;
    clk++;
    world_step(&w, &idle);
    CHECK(w.state == W_GAME_OVER && !w.hud_visible, "game over");
    n = run_until(W_DONE, 400);
    CHECK(n == 246, "done after %d frames (120 death + 120 text + 6 erase)", n);

    /* 2 players: a death hands over after the beat and the PLAYER 2 interstitial */
    w.qualify_min = 1u << 30;
    world_start(&w, &assets, &prng, &clk, &cycle, &OPERATOR_FACTORY, 2);
    CHECK(w.player_count == 2 && w.current == 0 && w.lives == 3, "2P start");
    run_until(W_PLAYING, 200);
    w.score = 1234;
    w.player.invuln_ms = 0;
    w.enemies[0].x = w.player.x;
    w.enemies[0].y = w.player.y;
    clk++;
    world_step(&w, &idle);
    CHECK(w.state == W_DEATH && w.swap_after_beat && w.current == 1, "swap to player 2");
    CHECK(w.slots[0].score == 1234 && w.slots[0].lives == 2 && w.score == 0 && w.lives == 3, "slots kept");
    run_until(W_PLAYING, 200);
    CHECK(w.inter_frames > 0 && !w.player.visible, "interstitial, player 2 not yet in");
    for (int i = 0; i < 108; i++) {
        clk++;
        world_step(&w, &idle);
    }
    CHECK(w.inter_frames == 0 && w.player.visible && w.player.alive && w.wave == 1, "player 2 on wave 1");
    CHECK(world_player_score(&w, 0) == 1234 && world_player_score(&w, 1) == 0, "scores per player");
    /* both out: game over, best score kept */
    w.slots[0].lives = 0;
    w.lives = 1;
    w.score = 99;
    run_until(W_PLAYING, 200);
    w.player.invuln_ms = 0;
    w.enemies[0].x = w.player.x;
    w.enemies[0].y = w.player.y;
    clk++;
    world_step(&w, &idle);
    CHECK(w.state == W_GAME_OVER, "2P game over when both are out");
    run_until(W_DONE, 400);
    CHECK(w.score == 1234, "best score goes on: %u", w.score);

    if (failures) {
        fprintf(stderr, "world tests FAILED: %d\n", failures);
        return 1;
    }
    printf("world tests passed: start, beam-in, wave clear, death re-lay, waves 2/5/7 enemies, game over\n");
    return 0;
}
