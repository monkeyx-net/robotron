(function() {
    window.GameConfig = {};

    // Gameplay and Physics Constants
    window.GameConfig.GAME_WIDTH = 292;
    window.GameConfig.GAME_HEIGHT = 240;
    window.GameConfig.PLAYER_SPEED = 2;
    window.GameConfig.PROJECTILE_SPEED = 4;
    window.GameConfig.ENFORCER_PROJECTILE_SPEED = 2.5;
    window.GameConfig.BRAIN_PROJECTILE_SPEED = 2;
    window.GameConfig.TANK_SHELL_SPEED = 1.8;

    // Attract mode timing constants
    window.GameConfig.TITLE_SCREEN_DURATION = 300;
    window.GameConfig.HIGH_SCORE_DURATION = 180;
    window.GameConfig.DEMO_PLAY_DURATION = 450;

    // Enemy speeds
    window.GameConfig.GRUNT_SPEED = 0.6;
    window.GameConfig.GRUNT_ACCELERATION = 0.03;
    window.GameConfig.GRUNT_MAX_SPEED = 1.0;
    window.GameConfig.GRUNT_TURN_RATE = 0.08;
    window.GameConfig.HULK_SPEED = 0.3;
    window.GameConfig.HULK_CHARGE_SPEED = 1.2;
    window.GameConfig.ENFORCER_SPEED = 0.8;
    window.GameConfig.BRAIN_SPEED = 0.6;
    window.GameConfig.TANK_SPEED = 0.4;
    window.GameConfig.SPHEROID_SPEED = 0.7;
    window.GameConfig.QUARK_SPEED = 1.2;
    window.GameConfig.SUB_QUARK_SPEED = 1.5;
    window.GameConfig.PROG_SPEED = 1.3;
    window.GameConfig.HUMAN_SPEED = 0.3;

    // Enemy timings
    window.GameConfig.ENFORCER_SHOOT_DELAY = 120;
    window.GameConfig.BRAIN_SHOOT_DELAY = 150;
    window.GameConfig.TANK_SHOOT_DELAY = 180;
    window.GameConfig.BRAIN_REPROGRAM_RANGE = 20;
    window.GameConfig.BRAIN_REPROGRAM_DURATION = 120;
    window.GameConfig.SPHEROID_SPAWN_ENFORCER_DELAY = 300;
    window.GameConfig.QUARK_SPAWN_SUB_QUARK_DELAY = 180;

    // Game mechanics
    window.GameConfig.INITIAL_LIVES = 30;
    window.GameConfig.MAX_PLAYER_PROJECTILES = 10;
    window.GameConfig.RESPAWN_INVULNERABILITY_TIME = 2000;
    window.GameConfig.INITIAL_HUMAN_RESCUE_BONUS = 1000;
    window.GameConfig.MAX_HUMAN_RESCUE_BONUS = 5000;
    window.GameConfig.HUMAN_RESCUE_BONUS_INCREMENT = 1000;
    window.GameConfig.HUMAN_RESCUE_BONUS_DECAY_DURATION = 300;
    window.GameConfig.TANK_SHELL_BOUNCES = 2;
    window.GameConfig.MAX_SUB_QUARKS_PER_QUARK = 3;
    window.GameConfig.ELECTRODE_FLASH_RATE = 0.1;
    window.GameConfig.EXTRA_LIFE_SCORE_INTERVAL = 25000;
    window.GameConfig.INSERT_COIN_FLASH_INTERVAL = 30;
    window.GameConfig.ATTRACT_MODE_CYCLE_TIME = 400; // Simplified for now, just title screen
    window.GameConfig.GAMEPAD_DEADZONE = 0.2; // Minimum analog stick value to register movement
    window.GameConfig.PLAYER_SHOOT_RATE = 100; // 166 is ~6 shots per second

    // Standard gamepad button indices
    window.GameConfig.GAMEPAD_START_BUTTON_INDEX = 9; // Start button
    window.GameConfig.GAMEPAD_SELECT_BUTTON_INDEX = 8; // Select/Back button
    window.GameConfig.GAMEPAD_A_BUTTON_INDEX = 0; // A/Cross button
    // Demo play duration is defined in game constants section

    // Enemy point values
    window.GameConfig.POINTS = {
        GRUNT: 100,
        ENFORCER: 150,
        SPHEROID: 1000,
        BRAIN: 500,
        TANK: 300,
        PROG: 100,
        QUARK: 1000,
        SUB_QUARK: 500
    };
})();
