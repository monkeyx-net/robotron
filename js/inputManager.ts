import { keys, gamepadMovementX, gamepadMovementY, gamepadShootingX, gamepadShootingY, gamepadConnected, setGamepadState } from './gameState';
import { GameConfig } from './config';

let lastGamepadTimestamp = 0;

export const InputManager = {
    init() {
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });
    },

    pollGamepads() {
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        if (!gps) return;

        let foundGamepad = false;
        for (const gamepad of gps) {
            if (gamepad) {
                foundGamepad = true;
                if (!gamepadConnected) { // New connection
                    console.log("Gamepad connected:", gamepad.id);
                    setGamepadState(true);
                }

                if (gamepad.timestamp === lastGamepadTimestamp) continue; // No new data
                lastGamepadTimestamp = gamepad.timestamp;

                // Update global gamepad state variables
                const deadzone = GameConfig.GAMEPAD_DEADZONE;
                const newMovementX = Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0;
                const newMovementY = Math.abs(gamepad.axes[1]) > deadzone ? gamepad.axes[1] : 0;
                const newShootingX = Math.abs(gamepad.axes[2]) > deadzone ? gamepad.axes[2] : 0;
                const newShootingY = Math.abs(gamepad.axes[3]) > deadzone ? gamepad.axes[3] : 0;
                setGamepadState(gamepadConnected, newMovementX, newMovementY, newShootingX, newShootingY);

                break; // Process first connected gamepad
            }
        }
        if (!foundGamepad && gamepadConnected) {
            console.log("Gamepad disconnected.");
            setGamepadState(false, 0, 0, 0, 0);
        }
    },

    isKeyDown(keyCode: string): boolean {
        return keys[keyCode] || false;
    },

    getGamepadMovement(): { x: number, y: number } {
        return { x: gamepadMovementX, y: gamepadMovementY };
    },

    getGamepadShooting(): { x: number, y: number } {
        return { x: gamepadShootingX, y: gamepadShootingY };
    },

    isGamepadConnected(): boolean {
        return gamepadConnected;
    }
};