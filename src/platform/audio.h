/*
 * Sound playback through SDL: the web build's mixing model (soundManager.ts).
 * Sounds overlap; a new one fades out playing voices of equal or lower
 * priority over 140 ms while higher-priority ones play on underneath; at most
 * 6 voices are tracked, the oldest fading out first. Plays nothing if the
 * WAVs or an audio device are missing.
 */
#ifndef ROBOTRON_AUDIO_H
#define ROBOTRON_AUDIO_H

#include "sim/sound.h"

/* Open the device and load <asset dir>/sounds. Returns 1 if sound is available. */
int audio_init(const char *argv0);
void audio_play(SoundId id);
void audio_stop_all(void);
void audio_shutdown(void);

#endif
