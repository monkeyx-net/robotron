import { Howl, Howler } from 'howler';
import { gameState } from './gameState';

interface SoundsCollection {
    [key: string]: Howl;
}

export const SoundManager = {
    sounds: {} as SoundsCollection,
    canPlaySound(): boolean {
        return gameState.currentGameState !== 'DEMO_PLAY';
    },
    init(): void {
        this.sounds.shoot = new Howl({
            src: ['sounds/shoot.wav'],
            volume: 0.5
        });
        this.sounds.playerDeath = new Howl({
            src: ['sounds/player_death.wav'],
            volume: 0.7
        });
        this.sounds.gruntPop = new Howl({
            src: ['sounds/grunt_pop.wav'],
            volume: 0.6
        });
        this.sounds.spheroidPop = new Howl({
            src: ['sounds/spheroid_pop.wav'],
            volume: 0.6
        });
        this.sounds.enforcerPop = new Howl({
            src: ['sounds/enforcer_pop.wav'],
            volume: 0.6
        });
        this.sounds.enforcerFire = new Howl({
            src: ['sounds/enforcer_fire.wav'],
            volume: 0.5
        });
        this.sounds.brainPop = new Howl({
            src: ['sounds/brain_pop.wav'],
            volume: 0.6
        });
        this.sounds.brainFire = new Howl({
            src: ['sounds/brain_fire.wav'],
            volume: 0.5
        });
        this.sounds.tankPop = new Howl({
            src: ['sounds/tank_pop.wav'],
            volume: 0.6
        });
        this.sounds.tankFire = new Howl({
            src: ['sounds/tank_fire.wav'],
            volume: 0.5
        });
        this.sounds.shellBounce = new Howl({
            src: ['sounds/shell_bounce.wav'],
            volume: 0.4
        });
        this.sounds.progDestroy = new Howl({
            src: ['sounds/prog_destroy.wav'],
            volume: 0.6
        });
        this.sounds.quarkPop = new Howl({
            src: ['sounds/quark_pop.wav'],
            volume: 0.6
        });
        this.sounds.subQuarkPop = new Howl({
            src: ['sounds/sub_quark_pop.wav'],
            volume: 0.5
        });
        this.sounds.humanRescue = new Howl({
            src: ['sounds/human_rescue.wav'],
            volume: 0.7
        });
        this.sounds.humanDeathByEnemy = new Howl({
            src: ['sounds/human_death.wav'],
            volume: 0.7
        });
        this.sounds.humanToProg = new Howl({
            src: ['sounds/human_to_prog.wav'],
            volume: 0.6
        });
        this.sounds.waveStart = new Howl({
            src: ['sounds/wave_start.wav'],
            volume: 0.7
        });
        this.sounds.gameOver = new Howl({
            src: ['sounds/game_over.wav'],
            volume: 0.8
        });
        this.sounds.extraLife = new Howl({
            src: ['sounds/extra_life.wav'],
            volume: 0.7
        });
        this.sounds.insertCoin = new Howl({
            src: ['sounds/insert_coin.wav'],
            volume: 0.7
        });
    },
    /**
     * Track priorities mirroring the ROM's play_music_track ($D3C7): the
     * Williams sound board is a single channel — a playing track suppresses
     * requests of LOWER priority and is preempted by equal-or-higher ones.
     * Values follow the priorities found in the ROM track tables (Ph20):
     * high-score jingle $EF, death fanfares high, enemy pops ~$70-77,
     * fire sounds low.
     */
    PRIORITIES: {
        insertCoin: 0xF0, highScoreEntry: 0xEF, gameOver: 0xD8,
        playerDeath: 0xD0, extraLife: 0xC8, waveStart: 0xC0,
        humanRescue: 0x90, humanToProg: 0x80, humanDeathByEnemy: 0x80,
        spheroidPop: 0x77, quarkPop: 0x77, tankPop: 0x77, brainPop: 0x77,
        gruntPop: 0x70, enforcerPop: 0x70, progDestroy: 0x70,
        enforcerFire: 0x50, brainFire: 0x50, tankFire: 0x50, shellBounce: 0x50,
        shoot: 0x20,
    } as Record<string, number>,

    _current: null as { name: string; priority: number; id: number } | null,

    play(soundName: string): void {
        const sound = this.sounds[soundName];
        if (!sound || !this.canPlaySound()) return;
        const priority = this.PRIORITIES[soundName] ?? 0x40;
        const cur = this._current;
        if (cur && this.sounds[cur.name]?.playing(cur.id)) {
            if (cur.priority > priority) return;   // suppressed by higher-priority track
            try { this.sounds[cur.name].stop(cur.id); } catch { /* noop */ }
        }
        try {
            const id = sound.play();
            this._current = { name: soundName, priority, id };
            sound.once('end', () => {
                if (this._current && this._current.id === id) this._current = null;
            }, id);
        } catch(e) {
            console.warn(`Sound play failed (${soundName}):`, e);
        }
    },
    stop(soundName: string): void {
        if (this.sounds[soundName]) {
            try {
                this.sounds[soundName].stop();
            } catch(e) {
                console.warn(`Sound stop failed (${soundName}):`, e);
            }
        }
    },
    stopAll(): void {
        this._current = null;
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
