import { Howl, Howler } from 'howler';
import { gameState } from './gameState';

interface SoundsCollection {
    [key: string]: Howl;
}

// Bump when any file in sounds/ is replaced so browsers fetch the new audio
// instead of a cached copy (Howler strips the query when sniffing format).
const SOUND_VERSION = 2;
const snd = (file: string) => [`sounds/${file}?v=${SOUND_VERSION}`];

export const SoundManager = {
    sounds: {} as SoundsCollection,
    canPlaySound(): boolean {
        return gameState.currentGameState !== 'DEMO_PLAY';
    },
    init(): void {
        this.sounds.shoot = new Howl({
            src: snd('shoot.wav'),
            volume: 0.5
        });
        this.sounds.playerDeath = new Howl({
            src: snd('player_death.wav'),
            volume: 0.7
        });
        this.sounds.gruntPop = new Howl({
            src: snd('grunt_pop.wav'),
            volume: 0.6
        });
        this.sounds.spheroidPop = new Howl({
            src: snd('spheroid_pop.wav'),
            volume: 0.6
        });
        this.sounds.enforcerPop = new Howl({
            src: snd('enforcer_pop.wav'),
            volume: 0.6
        });
        this.sounds.enforcerFire = new Howl({
            src: snd('enforcer_fire.wav'),
            volume: 0.5
        });
        this.sounds.brainPop = new Howl({
            src: snd('brain_pop.wav'),
            volume: 0.6
        });
        this.sounds.brainFire = new Howl({
            src: snd('brain_fire.wav'),
            volume: 0.5
        });
        this.sounds.tankPop = new Howl({
            src: snd('tank_pop.wav'),
            volume: 0.6
        });
        this.sounds.tankFire = new Howl({
            src: snd('tank_fire.wav'),
            volume: 0.5
        });
        this.sounds.shellBounce = new Howl({
            src: snd('shell_bounce.wav'),
            volume: 0.4
        });
        this.sounds.progDestroy = new Howl({
            src: snd('prog_destroy.wav'),
            volume: 0.6
        });
        this.sounds.quarkPop = new Howl({
            src: snd('quark_pop.wav'),
            volume: 0.6
        });
        this.sounds.subQuarkPop = new Howl({
            src: snd('sub_quark_pop.wav'),
            volume: 0.5
        });
        this.sounds.humanRescue = new Howl({
            src: snd('human_rescue.wav'),
            volume: 0.7
        });
        this.sounds.humanDeathByEnemy = new Howl({
            src: snd('human_death.wav'),
            volume: 0.7
        });
        this.sounds.humanToProg = new Howl({
            src: snd('human_to_prog.wav'),
            volume: 0.6
        });
        this.sounds.waveStart = new Howl({
            src: snd('wave_start.wav'),
            volume: 0.7
        });
        this.sounds.gameOver = new Howl({
            src: snd('game_over.wav'),
            volume: 0.8
        });
        this.sounds.extraLife = new Howl({
            src: snd('extra_life.wav'),
            volume: 0.7
        });
        this.sounds.insertCoin = new Howl({
            src: snd('insert_coin.wav'),
            volume: 0.7
        });
        // ROM-captured (MAME): wave-clear sound (cmd $0E re-sent every 4
        // frames for 1.86 s, plus its sustained tail), spheroid launching an
        // enforcer (cmd $18), and the initials-entry music.
        this.sounds.waveComplete = new Howl({
            src: snd('wave_complete.wav'),
            volume: 0.7
        });
        this.sounds.enforcerSpawn = new Howl({
            src: snd('enforcer_spawn.wav'),
            volume: 0.6
        });
        this.sounds.highScoreEntry = new Howl({
            src: snd('high_score_entry.wav'),
            volume: 0.7
        });
    },
    /**
     * Mixing model (modern, not the arcade's single hard-cut channel):
     * sounds overlap, and hand over with a short crossfade instead of a cut.
     * A new sound fades out playing voices of equal or lower priority over
     * CROSSFADE_MS; higher-priority voices (rescue, death, wave clear...)
     * keep playing to the end underneath it. Priorities follow the ROM
     * track tables: each track's first byte, which play_music_track ($D3C7)
     * compares with the playing one (robotron-re REVERSE.md Phase 21 "Sound
     * priorities"). Equal priority replaces, as in the ROM.
     */
    PRIORITIES: {
        // not in the flat ROM (sound board / bank-switched): kept in order
        highScoreEntry: 0xFE, gameOver: 0xFD, extraLife: 0xF8,
        waveComplete: 0xFF,      // $8607 track $4143 (prio $FF) is the likely match, unconfirmed
        insertCoin: 0xF0,        // $673A track $26E6
        playerDeath: 0xEE,       // $70EF track $26D9
        waveStart: 0xE0,         // $6A9C track $26EB
        humanDeathByEnemy: 0xE0, // $438A track $0026 (hulk kills a human)
        humanToProg: 0xD8,       // $5D7E track $1AEF
        enforcerSpawn: 0xD8,     // $5377 track $114C
        spheroidPop: 0xD1,       // $52EA track $1151
        humanRescue: 0xD0,       // $7221 track $26F0
        gruntPop: 0xD0,          // $7A8E track $3898
        enforcerPop: 0xD0,       // $54A1 track $115B
        brainPop: 0xD0,          // $5E09 track $1ACD
        progDestroy: 0xD0,       // $5F5B track $1ADA
        quarkPop: 0xD0,          // $8BEB track $4B29
        tankPop: 0xD0,           // $8E0A track $4B0C
        subQuarkPop: 0xD0,       // $8FE7 track $4B1E (shell, spark, missile shot)
        enforcerFire: 0xD0,      // $547B track $1156
        brainFire: 0xC8,         // $6053 track $1AE2 (cruise missile)
        tankFire: 0xC8,          // $8F8C track $4B11
        shellBounce: 0xC8,       // $8FCD track $4B16
        shoot: 0x20,             // player fire: not in the flat ROM; lowest so it never cuts anything
    } as Record<string, number>,

    CROSSFADE_MS: 140,
    MAX_VOICES: 6,

    _voices: [] as { name: string; priority: number; id: number }[],

    _fadeOut(v: { name: string; id: number }): void {
        const h = this.sounds[v.name];
        if (!h || !h.playing(v.id)) return;
        try {
            const vol = h.volume(v.id) as number;
            h.fade(vol, 0, this.CROSSFADE_MS, v.id);
            h.once('fade', () => h.stop(v.id), v.id);
        } catch { /* noop */ }
    },

    play(soundName: string): void {
        const sound = this.sounds[soundName];
        if (!sound || !this.canPlaySound()) return;
        const priority = this.PRIORITIES[soundName] ?? 0x40;
        this._voices = this._voices.filter(v => this.sounds[v.name]?.playing(v.id));
        this._voices = this._voices.filter(v => {
            if (v.priority > priority) return true;   // keeps playing under the new sound
            this._fadeOut(v);
            return false;
        });
        while (this._voices.length >= this.MAX_VOICES) {
            const oldest = this._voices.shift();
            if (oldest) this._fadeOut(oldest);
        }
        try {
            const id = sound.play();
            sound.volume(sound.volume() as number, id);   // a reused voice may still be faded down
            this._voices.push({ name: soundName, priority, id });
        } catch(e) {
            console.warn(`Sound play failed (${soundName}):`, e);
        }
    },
    stop(soundName: string): void {
        this._voices = this._voices.filter(v => v.name !== soundName);
        if (this.sounds[soundName]) {
            try {
                this.sounds[soundName].stop();
            } catch(e) {
                console.warn(`Sound stop failed (${soundName}):`, e);
            }
        }
    },
    stopAll(): void {
        this._voices = [];
        Object.values(this.sounds).forEach(sound => {
            try {
                sound.stop();
            } catch(e) {
                console.warn('Sound stop failed:', e);
            }
        });
    }
};

export function initAudio(): void {
    if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume().then(() => {
            console.log('AudioContext resumed successfully');
            SoundManager.init();
        });
    } else if (typeof Howler !== 'undefined') {
        SoundManager.init();
    }
}
