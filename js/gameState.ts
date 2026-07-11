export interface GameState {
    score: number;
    lives: number;
    wave: number;
    currentHumanRescueBonus: number;
    humanRescueBonusDecayTimer: number;
    nextExtraLifeScore: number;
    highScore: number;
    playerInvulnerableTime: number;
    currentGameState: 'TITLE_SCREEN' | 'HIGH_SCORE_DISPLAY_SCREEN' | 'DEMO_PLAY' | 'PLAYING' | 'WAVE_TRANSITION' | 'GAME_OVER' | 'HIGH_SCORE_ENTRY';
    /** max simultaneous quark-spawned tanks for the current wave */
    tankCap?: number;
}

export const gameState: GameState = {
    score: 0,
    lives: 0,
    wave: 0,
    currentHumanRescueBonus: 0,
    humanRescueBonusDecayTimer: 0,
    nextExtraLifeScore: 0,
    highScore: 0,
    playerInvulnerableTime: 0,
    currentGameState: 'TITLE_SCREEN',
};

// Input State
export const keys: { [key: string]: boolean } = {};

// Gamepad State
export let gamepadMovementX = 0;
export let gamepadMovementY = 0;
export let gamepadShootingX = 0;
export let gamepadShootingY = 0;
export let gamepadConnected = false;

export function setGamepadState(connected: boolean, moveX: number = 0, moveY: number = 0, shootX: number = 0, shootY: number = 0) {
    gamepadConnected = connected;
    gamepadMovementX = moveX;
    gamepadMovementY = moveY;
    gamepadShootingX = shootX;
    gamepadShootingY = shootY;
}
