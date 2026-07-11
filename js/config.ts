export const GameConfig = {
    // Gameplay and Physics Constants
    GAME_WIDTH: 292,
    GAME_HEIGHT: 240,
    // Arena rectangle (arcade: the border is inset — the score row sits
    // ABOVE it and the WAVE label BELOW it, outside the playfield)
    PLAYFIELD: { LEFT: 7, TOP: 17, RIGHT: 285, BOTTOM: 229 },
    PLAYER_SPEED: 2,
    PROJECTILE_SPEED: 4,
    ENFORCER_PROJECTILE_SPEED: 2.5,
    BRAIN_PROJECTILE_SPEED: 2,
    TANK_SHELL_SPEED: 1.8,

    // Attract mode timing constants
    TITLE_SCREEN_DURATION: 300,
    HIGH_SCORE_DURATION: 180,
    DEMO_PLAY_DURATION: 450,

    // Enemy speeds
    GRUNT_SPEED: 0.6,
    GRUNT_ACCELERATION: 0.03,
    GRUNT_MAX_SPEED: 1.0,
    GRUNT_TURN_RATE: 0.08,
    HULK_SPEED: 0.3,
    HULK_CHARGE_SPEED: 1.2,
    ENFORCER_SPEED: 0.8,
    BRAIN_SPEED: 0.6,
    TANK_SPEED: 0.4,
    SPHEROID_SPEED: 0.7,
    QUARK_SPEED: 1.2,
    SUB_QUARK_SPEED: 1.5,
    PROG_SPEED: 1.3,
    HUMAN_SPEED: 0.4, // Very slow wandering pace as per requirements
    HUMAN_SCALE: 2.0, // Make humans more visible
    HUMAN_WANDER_RADIUS: 60, // Larger wander area
    HUMAN_WANDER_INTERVAL: 2000, // 2 second average wander interval
    HUMAN_RESCUE_RADIUS: 18, // Collision radius for rescue

    // Enemy timings
    ENFORCER_SHOOT_DELAY: 120,
    BRAIN_SHOOT_DELAY: 150,
    TANK_SHOOT_DELAY: 180,
    BRAIN_REPROGRAM_RANGE: 20,
    BRAIN_REPROGRAM_DURATION: 120,
    SPHEROID_SPAWN_ENFORCER_DELAY: 300,
    QUARK_SPAWN_SUB_QUARK_DELAY: 180,

    // Game mechanics
    INITIAL_LIVES: 3, // arcade default
    MAX_PLAYER_PROJECTILES: 10,
    RESPAWN_INVULNERABILITY_TIME: 2000,
    INITIAL_HUMAN_RESCUE_BONUS: 1000,
    MAX_HUMAN_RESCUE_BONUS: 5000,
    HUMAN_RESCUE_BONUS_INCREMENT: 1000,
    HUMAN_RESCUE_BONUS_DECAY_DURATION: 300,
    TANK_SHELL_BOUNCES: 2,
    MAX_SUB_QUARKS_PER_QUARK: 3,
    ELECTRODE_FLASH_RATE: 0.1,
    EXTRA_LIFE_SCORE_INTERVAL: 25000,
    INSERT_COIN_FLASH_INTERVAL: 30,
    ATTRACT_MODE_CYCLE_TIME: 400, // Simplified for now, just title screen
    GAMEPAD_DEADZONE: 0.2, // Minimum analog stick value to register movement
    PLAYER_SHOOT_RATE: 100, // 166 is ~6 shots per second

    // Standard gamepad button indices
    GAMEPAD_START_BUTTON_INDEX: 9, // Start button
    GAMEPAD_SELECT_BUTTON_INDEX: 8, // Select/Back button
    GAMEPAD_A_BUTTON_INDEX: 0, // A/Cross button
    // Demo play duration is defined in game constants section

    // Enemy point values (arcade-authentic)
    POINTS: {
        GRUNT: 100,
        HULK: 0,          // indestructible — bullets only nudge it
        ENFORCER: 150,
        ENFORCER_SPARK: 25,
        SPHEROID: 1000,
        BRAIN: 500,
        CRUISE_MISSILE: 25,
        TANK: 200,
        TANK_SHELL: 25,
        PROG: 100,
        QUARK: 1000,
        ELECTRODE: 0
    }
};
