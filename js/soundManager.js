(function(Howler) {
    // gameState will be a global dependency for now
    // let gameState = 'TITLE_SCREEN'; // Placeholder, will be managed globally

    const SoundManager = {
        sounds: {},
        // Don't play sounds during demo mode
        canPlaySound() {
            // This relies on a global gameState variable that will be defined in main.js or gameLogic.js
            return window.gameState !== 'DEMO_PLAY';
        },
        init() {
            // Player sounds
            this.sounds.shoot = new Howl({
                src: ['sounds/shoot.wav'],
                volume: 0.5
            });
            this.sounds.playerDeath = new Howl({
                src: ['sounds/player_death.wav'],
                volume: 0.7
            });

            // Enemy sounds
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

            // Human sounds
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

            // Game event sounds
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
        play(soundName) {
            if (this.sounds[soundName] && this.canPlaySound()) {
                try {
                    this.sounds[soundName].play();
                } catch(e) {
                    console.warn(`Sound play failed (${soundName}):`, e);
                }
            }
        },
        stop(soundName) {
            if (this.sounds[soundName]) {
                try {
                    this.sounds[soundName].stop();
                } catch(e) {
                    console.warn(`Sound stop failed (${soundName}):`, e);
                }
            }
        },
        stopAll() {
            Object.values(this.sounds).forEach(sound => {
                try {
                    sound.stop();
                } catch(e) {
                    console.warn('Sound stop failed:', e);
                }
            });
        }
    };

    function initAudio() {
        if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'suspended') {
            Howler.ctx.resume().then(() => {
                console.log('AudioContext resumed successfully');
                SoundManager.init();
            });
        } else if (typeof Howler !== 'undefined') {
            SoundManager.init();
        }
    }

    window.SoundManager = SoundManager;
    window.initAudio = initAudio;

})(window.Howler);
