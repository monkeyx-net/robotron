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
    world_start(&w, &assets, &prng, &clk, &cycle);

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
    CHECK(w.wave == 2 && w.enemy_count == assets.waves[1][W_GRUNTS] && w.border_visible, "wave 2 laid");
    CHECK(run_until(W_PLAYING, 200) > 0, "wave 2 plays");

    /* a hit: the death beat, then the wave re-lays with what is left */
    int grunts = w.enemy_count;
    w.player.invuln_ms = 0;
    w.enemies[0].x = w.player.x;
    w.enemies[0].y = w.player.y;
    clk++;
    world_step(&w, &idle);
    CHECK(w.state == W_DEATH && w.lives == 2 && w.bonus == 1000, "hit: state %d lives %d", w.state, w.lives);
    n = run_until(W_BEAM_IN, 200);
    CHECK(n == 104, "re-lay after %d frames (DeathBeat: 104)", n);
    CHECK(w.enemy_count == grunts && w.wave == 2, "same wave, %d of %d grunts", w.enemy_count, grunts);
    CHECK(run_until(W_PLAYING, 200) > 0, "plays again");

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

    if (failures) {
        fprintf(stderr, "world tests FAILED: %d\n", failures);
        return 1;
    }
    printf("world tests passed: start, beam-in, wave clear, death re-lay, game over\n");
    return 0;
}
