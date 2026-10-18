/*
 * Sound effects as the web build's SoundManager plays them: file, volume and
 * ROM track priority (play_music_track $D3C7 compares a track's first byte).
 * The sim queues SoundIds; platform/audio.c mixes them.
 */
#ifndef ROBOTRON_SOUND_H
#define ROBOTRON_SOUND_H

typedef enum {
    SND_SHOOT, SND_PLAYER_DEATH, SND_GRUNT_POP, SND_SPHEROID_POP, SND_ENFORCER_POP, SND_ENFORCER_FIRE,
    SND_BRAIN_POP, SND_BRAIN_FIRE, SND_TANK_POP, SND_TANK_FIRE, SND_SHELL_BOUNCE, SND_PROG_DESTROY,
    SND_QUARK_POP, SND_SUB_QUARK_POP, SND_HUMAN_RESCUE, SND_HUMAN_DEATH, SND_HUMAN_TO_PROG, SND_WAVE_START,
    SND_GAME_OVER, SND_EXTRA_LIFE, SND_INSERT_COIN, SND_WAVE_COMPLETE, SND_ENFORCER_SPAWN, SND_HIGH_SCORE_ENTRY,
    SND_COUNT
} SoundId;

typedef struct {
    const char *file;     /* under <asset dir>/sounds/ */
    float volume;
    int priority;         /* a new sound fades out playing voices of equal or lower priority */
} SoundInfo;

static const SoundInfo SOUND_INFO[SND_COUNT] = {
    [SND_SHOOT] = { "shoot.wav", 0.5f, 0x20 },
    [SND_PLAYER_DEATH] = { "player_death.wav", 0.7f, 0xEE },
    [SND_GRUNT_POP] = { "grunt_pop.wav", 0.6f, 0xD0 },
    [SND_SPHEROID_POP] = { "spheroid_pop.wav", 0.6f, 0xD1 },
    [SND_ENFORCER_POP] = { "enforcer_pop.wav", 0.6f, 0xD0 },
    [SND_ENFORCER_FIRE] = { "enforcer_fire.wav", 0.5f, 0xD0 },
    [SND_BRAIN_POP] = { "brain_pop.wav", 0.6f, 0xD0 },
    [SND_BRAIN_FIRE] = { "brain_fire.wav", 0.5f, 0xC8 },
    [SND_TANK_POP] = { "tank_pop.wav", 0.6f, 0xD0 },
    [SND_TANK_FIRE] = { "tank_fire.wav", 0.5f, 0xC8 },
    [SND_SHELL_BOUNCE] = { "shell_bounce.wav", 0.4f, 0xC8 },
    [SND_PROG_DESTROY] = { "prog_destroy.wav", 0.6f, 0xD0 },
    [SND_QUARK_POP] = { "quark_pop.wav", 0.6f, 0xD0 },
    [SND_SUB_QUARK_POP] = { "sub_quark_pop.wav", 0.5f, 0xD0 },
    [SND_HUMAN_RESCUE] = { "human_rescue.wav", 0.7f, 0xD0 },
    [SND_HUMAN_DEATH] = { "human_death.wav", 0.7f, 0xE0 },
    [SND_HUMAN_TO_PROG] = { "human_to_prog.wav", 0.6f, 0xD8 },
    [SND_WAVE_START] = { "wave_start.wav", 0.7f, 0xE0 },
    [SND_GAME_OVER] = { "game_over.wav", 0.8f, 0xFD },
    [SND_EXTRA_LIFE] = { "extra_life.wav", 0.7f, 0xF8 },
    [SND_INSERT_COIN] = { "insert_coin.wav", 0.7f, 0xF0 },
    [SND_WAVE_COMPLETE] = { "wave_complete.wav", 0.7f, 0xFF },
    [SND_ENFORCER_SPAWN] = { "enforcer_spawn.wav", 0.6f, 0xD8 },
    [SND_HIGH_SCORE_ENTRY] = { "high_score_entry.wav", 0.7f, 0xFE },
};

#endif
