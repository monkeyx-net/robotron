/**
 * InputManager - Unified input system with multi-device support
 * 
 * This module provides a comprehensive input management system that supports
 * keyboard, mouse, touch, and gamepad input with buffering, key binding,
 * and event generation capabilities.
 */

import { Vector2 } from '../utils/Vector2';
import { gameEvents } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Input device types
 */
export enum InputDevice {
    KEYBOARD = 'keyboard',
    MOUSE = 'mouse',
    TOUCH = 'touch',
    GAMEPAD = 'gamepad'
}

/**
 * Input action types
 */
export enum InputAction {
    // Movement actions
    MOVE_UP = 'move_up',
    MOVE_DOWN = 'move_down',
    MOVE_LEFT = 'move_left',
    MOVE_RIGHT = 'move_right',
    
    // Shooting actions
    SHOOT_UP = 'shoot_up',
    SHOOT_DOWN = 'shoot_down',
    SHOOT_LEFT = 'shoot_left',
    SHOOT_RIGHT = 'shoot_right',
    
    // Game actions
    START = 'start',
    SELECT = 'select',
    PAUSE = 'pause',
    MENU = 'menu'
}

/**
 * Input event interface
 */
export interface InputEvent {
    action: InputAction;
    device: InputDevice;
    pressed: boolean;
    value: number; // 0-1 for analog inputs
    timestamp: number;
    position?: Vector2; // For mouse/touch
}

/**
 * Key binding configuration
 */
export interface KeyBinding {
    action: InputAction;
    device: InputDevice;
    key?: string; // Keyboard key code
    button?: number; // Mouse/gamepad button
    axis?: number; // Gamepad axis
    axisDirection?: 'positive' | 'negative'; // For axis inputs
}/**
 
* Input buffer entry for responsive controls
 */
interface InputBufferEntry {
    action: InputAction;
    device: InputDevice;
    pressed: boolean;
    timestamp: number;
    consumed: boolean;
}

/**
 * Gamepad state tracking
 */
interface GamepadState {
    connected: boolean;
    id: string;
    buttons: boolean[];
    axes: number[];
    timestamp: number;
}

/**
 * Touch input tracking
 */
interface TouchState {
    id: number;
    position: Vector2;
    startPosition: Vector2;
    timestamp: number;
    active: boolean;
}

/**
 * Unified InputManager class
 */
export class UnifiedInputManager {
    private static instance: UnifiedInputManager;
    
    // Input state tracking
    private keyStates: Map<string, boolean> = new Map();
    private mouseButtons: Map<number, boolean> = new Map();
    private mousePosition: Vector2 = new Vector2(0, 0);
    private gamepads: Map<number, GamepadState> = new Map();
    private touches: Map<number, TouchState> = new Map();
    
    // Input buffering
    private inputBuffer: InputBufferEntry[] = [];
    private bufferSize: number = 10;
    private bufferTimeWindow: number = 500; // milliseconds - increased for better responsiveness
    
    // Key bindings
    private keyBindings: Map<string, KeyBinding> = new Map();
    private defaultBindings: KeyBinding[] = [];
    
    // Configuration
    private deadzone: number = 0.2;
    
    // Event listeners
    private eventListeners: Map<InputAction, ((event: InputEvent) => void)[]> = new Map();
    
    private constructor() {
        this.setupDefaultBindings();
        this.initializeEventListeners();
    }
    
    /**
     * Get singleton instance
     */
    static getInstance(): UnifiedInputManager {
        if (!UnifiedInputManager.instance) {
            UnifiedInputManager.instance = new UnifiedInputManager();
        }
        return UnifiedInputManager.instance;
    }   
 /**
     * Initialize the input manager
     */
    initialize(): void {
        try {
            this.setupKeyboardListeners();
            this.setupMouseListeners();
            this.setupTouchListeners();
            this.setupGamepadListeners();
            
            // Start update loop
            this.startUpdateLoop();
            
            console.log('UnifiedInputManager initialized successfully');
        } catch (error) {
            errorHandler.handleError(
                error as Error,
                ErrorCategory.CONFIGURATION,
                ErrorSeverity.HIGH,
                {},
                'UnifiedInputManager.initialize'
            );
        }
    }
    
    /**
     * Setup default key bindings
     */
    private setupDefaultBindings(): void {
        this.defaultBindings = [
            // Movement - WASD
            { action: InputAction.MOVE_UP, device: InputDevice.KEYBOARD, key: 'KeyW' },
            { action: InputAction.MOVE_DOWN, device: InputDevice.KEYBOARD, key: 'KeyS' },
            { action: InputAction.MOVE_LEFT, device: InputDevice.KEYBOARD, key: 'KeyA' },
            { action: InputAction.MOVE_RIGHT, device: InputDevice.KEYBOARD, key: 'KeyD' },
            
            // Movement - Arrow keys
            { action: InputAction.MOVE_UP, device: InputDevice.KEYBOARD, key: 'ArrowUp' },
            { action: InputAction.MOVE_DOWN, device: InputDevice.KEYBOARD, key: 'ArrowDown' },
            { action: InputAction.MOVE_LEFT, device: InputDevice.KEYBOARD, key: 'ArrowLeft' },
            { action: InputAction.MOVE_RIGHT, device: InputDevice.KEYBOARD, key: 'ArrowRight' },
            
            // Shooting - IJKL
            { action: InputAction.SHOOT_UP, device: InputDevice.KEYBOARD, key: 'KeyI' },
            { action: InputAction.SHOOT_DOWN, device: InputDevice.KEYBOARD, key: 'KeyK' },
            { action: InputAction.SHOOT_LEFT, device: InputDevice.KEYBOARD, key: 'KeyJ' },
            { action: InputAction.SHOOT_RIGHT, device: InputDevice.KEYBOARD, key: 'KeyL' },
            
            // Shooting - Arrow keys (dual binding)
            { action: InputAction.SHOOT_UP, device: InputDevice.KEYBOARD, key: 'ArrowUp' },
            { action: InputAction.SHOOT_DOWN, device: InputDevice.KEYBOARD, key: 'ArrowDown' },
            { action: InputAction.SHOOT_LEFT, device: InputDevice.KEYBOARD, key: 'ArrowLeft' },
            { action: InputAction.SHOOT_RIGHT, device: InputDevice.KEYBOARD, key: 'ArrowRight' },
            
            // Game controls
            { action: InputAction.START, device: InputDevice.KEYBOARD, key: 'Enter' },
            { action: InputAction.START, device: InputDevice.KEYBOARD, key: 'NumpadEnter' },
            { action: InputAction.SELECT, device: InputDevice.KEYBOARD, key: 'Space' },
            { action: InputAction.PAUSE, device: InputDevice.KEYBOARD, key: 'Escape' },
            { action: InputAction.MENU, device: InputDevice.KEYBOARD, key: 'Tab' },
            
            // Gamepad bindings
            { action: InputAction.MOVE_UP, device: InputDevice.GAMEPAD, axis: 1, axisDirection: 'negative' },
            { action: InputAction.MOVE_DOWN, device: InputDevice.GAMEPAD, axis: 1, axisDirection: 'positive' },
            { action: InputAction.MOVE_LEFT, device: InputDevice.GAMEPAD, axis: 0, axisDirection: 'negative' },
            { action: InputAction.MOVE_RIGHT, device: InputDevice.GAMEPAD, axis: 0, axisDirection: 'positive' },
            
            { action: InputAction.SHOOT_UP, device: InputDevice.GAMEPAD, axis: 3, axisDirection: 'negative' },
            { action: InputAction.SHOOT_DOWN, device: InputDevice.GAMEPAD, axis: 3, axisDirection: 'positive' },
            { action: InputAction.SHOOT_LEFT, device: InputDevice.GAMEPAD, axis: 2, axisDirection: 'negative' },
            { action: InputAction.SHOOT_RIGHT, device: InputDevice.GAMEPAD, axis: 2, axisDirection: 'positive' },
            
            // D-pad (standard mapping buttons 12-15) also moves
            { action: InputAction.MOVE_UP, device: InputDevice.GAMEPAD, button: 12 },
            { action: InputAction.MOVE_DOWN, device: InputDevice.GAMEPAD, button: 13 },
            { action: InputAction.MOVE_LEFT, device: InputDevice.GAMEPAD, button: 14 },
            { action: InputAction.MOVE_RIGHT, device: InputDevice.GAMEPAD, button: 15 },

            // Face buttons fire in their compass direction, for pads
            // without a right stick (Y=up, A=down, X=left, B=right)
            { action: InputAction.SHOOT_UP, device: InputDevice.GAMEPAD, button: 3 },
            { action: InputAction.SHOOT_DOWN, device: InputDevice.GAMEPAD, button: 0 },
            { action: InputAction.SHOOT_LEFT, device: InputDevice.GAMEPAD, button: 2 },
            { action: InputAction.SHOOT_RIGHT, device: InputDevice.GAMEPAD, button: 1 },

            { action: InputAction.START, device: InputDevice.GAMEPAD, button: 9 }, // Start button
            { action: InputAction.SELECT, device: InputDevice.GAMEPAD, button: 8 }, // Select button
        ];
        
        // Apply default bindings
        this.applyKeyBindings(this.defaultBindings);
    }   
 /**
     * Setup keyboard event listeners
     */
    private setupKeyboardListeners(): void {
        window.addEventListener('keydown', (event) => {
            this.handleKeyboardEvent(event.code, true, event.timeStamp || Date.now());
            
            // Prevent default for game keys to avoid browser shortcuts
            if (this.isGameKey(event.code)) {
                event.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (event) => {
            this.handleKeyboardEvent(event.code, false, event.timeStamp || Date.now());
        });
        
        // Handle focus loss
        window.addEventListener('blur', () => {
            this.clearAllInputStates();
        });
    }
    
    /**
     * Handle keyboard input events
     */
    private handleKeyboardEvent(keyCode: string, pressed: boolean, timestamp: number): void {
        const wasPressed = this.keyStates.get(keyCode) || false;
        
        this.keyStates.set(keyCode, pressed);
        
        // Only process state changes
        if (wasPressed !== pressed) {
            const binding = this.findKeyBinding(InputDevice.KEYBOARD, keyCode);
            
            if (binding) {
                const inputEvent: InputEvent = {
                    action: binding.action,
                    device: InputDevice.KEYBOARD,
                    pressed: pressed,
                    value: pressed ? 1.0 : 0.0,
                    timestamp: timestamp
                };
                
                this.processInputEvent(inputEvent);
            }
        }
    }
    
    /**
     * Check if a key is a game key that should prevent default browser behavior
     */
    private isGameKey(keyCode: string): boolean {
        const gameKeys = [
            'KeyW', 'KeyA', 'KeyS', 'KeyD',
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'KeyI', 'KeyJ', 'KeyK', 'KeyL',
            'Space', 'Enter', 'Escape', 'Tab'
        ];
        return gameKeys.includes(keyCode);
    }    /**

     * Setup mouse event listeners
     */
    private setupMouseListeners(): void {
        window.addEventListener('mousedown', (event) => {
            this.handleMouseButtonEvent(event.button, true, event.timeStamp);
            this.updateMousePosition(event.clientX, event.clientY);
        });
        
        window.addEventListener('mouseup', (event) => {
            this.handleMouseButtonEvent(event.button, false, event.timeStamp);
            this.updateMousePosition(event.clientX, event.clientY);
        });
        
        window.addEventListener('mousemove', (event) => {
            this.updateMousePosition(event.clientX, event.clientY);
        });
        
        // Prevent context menu on right click
        window.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    
    /**
     * Handle mouse button events
     */
    private handleMouseButtonEvent(button: number, pressed: boolean, timestamp: number): void {
        const wasPressed = this.mouseButtons.get(button) || false;
        this.mouseButtons.set(button, pressed);
        
        if (wasPressed !== pressed) {
            const binding = this.findMouseButtonBinding(button);
            if (binding) {
                const inputEvent: InputEvent = {
                    action: binding.action,
                    device: InputDevice.MOUSE,
                    pressed: pressed,
                    value: pressed ? 1.0 : 0.0,
                    timestamp: timestamp,
                    position: this.mousePosition.clone()
                };
                
                this.processInputEvent(inputEvent);
            }
        }
    }
    
    /**
     * Update mouse position
     */
    private updateMousePosition(x: number, y: number): void {
        this.mousePosition.x = x;
        this.mousePosition.y = y;
    }  
  /**
     * Setup touch event listeners
     */
    private setupTouchListeners(): void {
        window.addEventListener('touchstart', (event) => {
            event.preventDefault();
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                this.handleTouchStart(touch, event.timeStamp);
            }
        }, { passive: false });
        
        window.addEventListener('touchmove', (event) => {
            event.preventDefault();
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                this.handleTouchMove(touch, event.timeStamp);
            }
        }, { passive: false });
        
        window.addEventListener('touchend', (event) => {
            event.preventDefault();
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                this.handleTouchEnd(touch, event.timeStamp);
            }
        }, { passive: false });
        
        window.addEventListener('touchcancel', (event) => {
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                this.handleTouchEnd(touch, event.timeStamp);
            }
        });
    }
    
    /**
     * Handle touch start
     */
    private handleTouchStart(touch: Touch, timestamp: number): void {
        const position = new Vector2(touch.clientX, touch.clientY);
        const touchState: TouchState = {
            id: touch.identifier,
            position: position,
            startPosition: position.clone(),
            timestamp: timestamp,
            active: true
        };
        
        this.touches.set(touch.identifier, touchState);
        this.processTouchInput(touchState, true);
    }
    
    /**
     * Handle touch move
     */
    private handleTouchMove(touch: Touch, timestamp: number): void {
        const touchState = this.touches.get(touch.identifier);
        if (touchState) {
            touchState.position.x = touch.clientX;
            touchState.position.y = touch.clientY;
            touchState.timestamp = timestamp;
            this.processTouchInput(touchState, true);
        }
    }
    
    /**
     * Handle touch end
     */
    private handleTouchEnd(touch: Touch, timestamp: number): void {
        const touchState = this.touches.get(touch.identifier);
        if (touchState) {
            touchState.active = false;
            touchState.timestamp = timestamp;
            this.processTouchInput(touchState, false);
            this.touches.delete(touch.identifier);
        }
    }    /**
  
   * Setup gamepad event listeners
     */
    private setupGamepadListeners(): void {
        window.addEventListener('gamepadconnected', (event) => {
            console.log(`Gamepad connected: ${event.gamepad.id} (mapping: "${event.gamepad.mapping}", ${event.gamepad.axes.length} axes, ${event.gamepad.buttons.length} buttons)`);
            this.addGamepad(event.gamepad);
        });
        
        window.addEventListener('gamepaddisconnected', (event) => {
            console.log(`Gamepad disconnected: ${event.gamepad.id}`);
            this.removeGamepad(event.gamepad.index);
        });
    }
    
    /**
     * Add a gamepad to tracking
     */
    private addGamepad(gamepad: Gamepad): void {
        const gamepadState: GamepadState = {
            connected: true,
            id: gamepad.id,
            buttons: gamepad.buttons.map(button => button.pressed),
            axes: [...gamepad.axes],
            timestamp: gamepad.timestamp
        };
        
        this.gamepads.set(gamepad.index, gamepadState);
        
        // Emit gamepad connected event
        gameEvents.emit({
            type: 'input:gamepad_connected',
            timestamp: Date.now(),
            source: 'UnifiedInputManager',
            data: {
                gamepadIndex: gamepad.index,
                gamepadId: gamepad.id
            }
        });
    }
    
    /**
     * Remove a gamepad from tracking
     */
    private removeGamepad(index: number): void {
        this.gamepads.delete(index);
        
        // Emit gamepad disconnected event
        gameEvents.emit({
            type: 'input:gamepad_disconnected',
            timestamp: Date.now(),
            source: 'UnifiedInputManager',
            data: {
                gamepadIndex: index
            }
        });
    }
    
    /**
     * Update gamepad states
     */
    private updateGamepads(): void {
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;
            
            const gamepadState = this.gamepads.get(i);
            if (!gamepadState) {
                this.addGamepad(gamepad);
                continue;
            }
            
            // Skip if no new data
            if (gamepad.timestamp === gamepadState.timestamp) continue;
            
            // Check button changes
            for (let buttonIndex = 0; buttonIndex < gamepad.buttons.length; buttonIndex++) {
                const button = gamepad.buttons[buttonIndex];
                const wasPressed = gamepadState.buttons[buttonIndex] || false;
                const isPressed = button.pressed;
                
                if (wasPressed !== isPressed) {
                    gamepadState.buttons[buttonIndex] = isPressed;
                    this.handleGamepadButtonEvent(i, buttonIndex, isPressed, gamepad.timestamp);
                }
            }
            
            // Check axis changes
            for (let axisIndex = 0; axisIndex < gamepad.axes.length; axisIndex++) {
                const axisValue = gamepad.axes[axisIndex];
                const previousValue = gamepadState.axes[axisIndex] || 0;
                
                if (Math.abs(axisValue - previousValue) > 0.01) {
                    gamepadState.axes[axisIndex] = axisValue;
                    this.handleGamepadAxisEvent(i, axisIndex, axisValue, gamepad.timestamp);
                }
            }
            
            gamepadState.timestamp = gamepad.timestamp;
        }
    }    /**
  
   * Handle gamepad button events
     */
    private handleGamepadButtonEvent(_gamepadIndex: number, buttonIndex: number, pressed: boolean, timestamp: number): void {
        const binding = this.findGamepadButtonBinding(buttonIndex);
        if (binding) {
            const inputEvent: InputEvent = {
                action: binding.action,
                device: InputDevice.GAMEPAD,
                pressed: pressed,
                value: pressed ? 1.0 : 0.0,
                timestamp: timestamp
            };
            
            this.processInputEvent(inputEvent);
        }
    }
    
    /**
     * Handle gamepad axis events
     */
    private handleGamepadAxisEvent(_gamepadIndex: number, axisIndex: number, value: number, timestamp: number): void {
        const bindings = this.findGamepadAxisBindings(axisIndex);
        
        for (const binding of bindings) {
            let actionValue = 0;
            let pressed = false;
            
            if (binding.axisDirection === 'positive' && value > this.deadzone) {
                actionValue = value;
                pressed = true;
            } else if (binding.axisDirection === 'negative' && value < -this.deadzone) {
                actionValue = Math.abs(value);
                pressed = true;
            }
            
            const inputEvent: InputEvent = {
                action: binding.action,
                device: InputDevice.GAMEPAD,
                pressed: pressed,
                value: actionValue,
                timestamp: timestamp
            };
            
            this.processInputEvent(inputEvent);
        }
    }
    
    /**
     * Process touch input and convert to actions
     */
    private processTouchInput(touchState: TouchState, active: boolean): void {
        // Simple touch-to-movement mapping
        // This could be enhanced with virtual joysticks or gesture recognition
        const screenCenter = new Vector2(window.innerWidth / 2, window.innerHeight / 2);
        const touchOffset = touchState.position.clone().subtract(screenCenter);
        
        if (touchOffset.magnitude() > 50) { // Minimum touch distance
            const normalizedOffset = touchOffset.normalize();
            
            // Determine primary direction
            let action: InputAction;
            if (Math.abs(normalizedOffset.x) > Math.abs(normalizedOffset.y)) {
                action = normalizedOffset.x > 0 ? InputAction.MOVE_RIGHT : InputAction.MOVE_LEFT;
            } else {
                action = normalizedOffset.y > 0 ? InputAction.MOVE_DOWN : InputAction.MOVE_UP;
            }
            
            const inputEvent: InputEvent = {
                action: action,
                device: InputDevice.TOUCH,
                pressed: active,
                value: active ? Math.min(touchOffset.magnitude() / 100, 1.0) : 0.0,
                timestamp: touchState.timestamp,
                position: touchState.position.clone()
            };
            
            this.processInputEvent(inputEvent);
        }
    }
    
    /**
     * Process an input event
     */
    private processInputEvent(inputEvent: InputEvent): void {
        // Add to input buffer
        this.addToInputBuffer(inputEvent);
        
        // Emit event
        this.emitInputEvent(inputEvent);
        
        // Call registered listeners
        this.callEventListeners(inputEvent);
    }   
 /**
     * Add input event to buffer
     */
    private addToInputBuffer(inputEvent: InputEvent): void {
        const bufferEntry: InputBufferEntry = {
            action: inputEvent.action,
            device: inputEvent.device,
            pressed: inputEvent.pressed,
            timestamp: inputEvent.timestamp,
            consumed: false
        };
        
        this.inputBuffer.push(bufferEntry);
        
        // Maintain buffer size
        if (this.inputBuffer.length > this.bufferSize) {
            this.inputBuffer.shift();
        }
        
        // Clean old entries
        const currentTime = Date.now();
        this.inputBuffer = this.inputBuffer.filter(entry => 
            currentTime - entry.timestamp < this.bufferTimeWindow
        );
    }
    
    /**
     * Emit input event to the global event system
     */
    private emitInputEvent(inputEvent: InputEvent): void {
        gameEvents.emit({
            type: `input:${inputEvent.action}`,
            timestamp: inputEvent.timestamp,
            source: 'UnifiedInputManager',
            data: {
                device: inputEvent.device,
                pressed: inputEvent.pressed,
                value: inputEvent.value,
                position: inputEvent.position
            }
        });
    }
    
    /**
     * Call registered event listeners
     */
    private callEventListeners(inputEvent: InputEvent): void {
        const listeners = this.eventListeners.get(inputEvent.action);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(inputEvent);
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.LOW,
                        { action: inputEvent.action },
                        'UnifiedInputManager.callEventListeners'
                    );
                }
            }
        }
    }
    
    /**
     * Start the update loop
     */
    private startUpdateLoop(): void {
        const update = () => {
            this.updateGamepads();
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
    
    /**
     * Clear all input states (useful when window loses focus)
     */
    private clearAllInputStates(): void {
        this.keyStates.clear();
        this.mouseButtons.clear();
        this.touches.clear();
        
        // Clear gamepad button states
        for (const gamepadState of this.gamepads.values()) {
            gamepadState.buttons.fill(false);
            gamepadState.axes.fill(0);
        }
    }   
 /**
     * Apply key bindings
     */
    private applyKeyBindings(bindings: KeyBinding[]): void {
        this.keyBindings.clear();
        
        for (const binding of bindings) {
            const key = this.getBindingKey(binding);
            this.keyBindings.set(key, binding);
        }
    }
    
    /**
     * Get a unique key for a binding
     */
    private getBindingKey(binding: KeyBinding): string {
        if (binding.key) {
            return `${binding.device}:key:${binding.key}`;
        } else if (binding.button !== undefined) {
            return `${binding.device}:button:${binding.button}`;
        } else if (binding.axis !== undefined) {
            return `${binding.device}:axis:${binding.axis}:${binding.axisDirection}`;
        }
        return `${binding.device}:unknown`;
    }
    
    /**
     * Find key binding for keyboard input
     */
    private findKeyBinding(device: InputDevice, key: string): KeyBinding | undefined {
        return this.keyBindings.get(`${device}:key:${key}`);
    }
    
    /**
     * Find key binding for mouse button
     */
    private findMouseButtonBinding(button: number): KeyBinding | undefined {
        return this.keyBindings.get(`${InputDevice.MOUSE}:button:${button}`);
    }
    
    /**
     * Find key binding for gamepad button
     */
    private findGamepadButtonBinding(button: number): KeyBinding | undefined {
        return this.keyBindings.get(`${InputDevice.GAMEPAD}:button:${button}`);
    }
    
    /**
     * Find key bindings for gamepad axis
     */
    private findGamepadAxisBindings(axis: number): KeyBinding[] {
        const bindings: KeyBinding[] = [];
        const positiveKey = `${InputDevice.GAMEPAD}:axis:${axis}:positive`;
        const negativeKey = `${InputDevice.GAMEPAD}:axis:${axis}:negative`;
        
        const positiveBinding = this.keyBindings.get(positiveKey);
        const negativeBinding = this.keyBindings.get(negativeKey);
        
        if (positiveBinding) bindings.push(positiveBinding);
        if (negativeBinding) bindings.push(negativeBinding);
        
        return bindings;
    }
    
    /**
     * Initialize event listeners map
     */
    private initializeEventListeners(): void {
        for (const action of Object.values(InputAction)) {
            this.eventListeners.set(action, []);
        }
    }
    
    /**
     * Get all key bindings for a specific action
     */
    private getKeyBindingsForAction(action: InputAction): KeyBinding[] {
        const bindings: KeyBinding[] = [];
        for (const binding of this.keyBindings.values()) {
            if (binding.action === action) {
                bindings.push(binding);
            }
        }
        return bindings;
    }
    
    // Public API Methods
    
    /**
     * Check if an action is currently pressed
     */
    isActionPressed(action: InputAction): boolean {
        // Check current key states directly for keyboard input
        const keyBindings = this.getKeyBindingsForAction(action);
        
        for (const binding of keyBindings) {
            if (binding.device === InputDevice.KEYBOARD && binding.key) {
                const isPressed = this.keyStates.get(binding.key) || false;
                if (isPressed) {
                    return true;
                }
            }
        }
        
        // Check live gamepad state (axes and buttons) for gamepad input
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : null;
        if (gamepads) {
            for (const binding of keyBindings) {
                if (binding.device !== InputDevice.GAMEPAD) continue;
                for (let i = 0; i < gamepads.length; i++) {
                    const gamepad = gamepads[i];
                    if (!gamepad) continue;
                    if (binding.axis !== undefined && gamepad.axes[binding.axis] !== undefined) {
                        const axisValue = gamepad.axes[binding.axis];
                        if (binding.axisDirection === 'positive' && axisValue > this.deadzone) {
                            return true;
                        } else if (binding.axisDirection === 'negative' && axisValue < -this.deadzone) {
                            return true;
                        }
                    } else if (binding.button !== undefined && gamepad.buttons[binding.button]?.pressed) {
                        return true;
                    }
                }
            }
        }
        
        // Fallback to buffer-based detection
        const currentTime = Date.now();
        const result = this.inputBuffer.some(entry => 
            entry.action === action && 
            entry.pressed && 
            !entry.consumed &&
            currentTime - entry.timestamp < this.bufferTimeWindow
        );
        
        return result;
    }
    
    /**
     * Get the value of an action (0-1 for analog inputs)
     */
    getActionValue(action: InputAction): number {
        const currentTime = Date.now();
        const recentEntry = this.inputBuffer
            .filter(entry => 
                entry.action === action && 
                !entry.consumed &&
                currentTime - entry.timestamp < this.bufferTimeWindow
            )
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        return recentEntry?.pressed ? 1.0 : 0.0;
    }
    
    /**
     * Consume an input from the buffer (for responsive controls)
     */
    consumeAction(action: InputAction): boolean {
        const currentTime = Date.now();
        const entry = this.inputBuffer.find(entry => 
            entry.action === action && 
            entry.pressed &&
            !entry.consumed &&
            currentTime - entry.timestamp < this.bufferTimeWindow
        );
        
        if (entry) {
            entry.consumed = true;
            return true;
        }
        
        return false;
    }
    
    /**
     * Get movement vector from input
     */
    getMovementVector(): Vector2 {
        const movement = new Vector2(0, 0);
        
        const leftPressed = this.isActionPressed(InputAction.MOVE_LEFT);
        const rightPressed = this.isActionPressed(InputAction.MOVE_RIGHT);
        const upPressed = this.isActionPressed(InputAction.MOVE_UP);
        const downPressed = this.isActionPressed(InputAction.MOVE_DOWN);
        
        if (leftPressed) movement.x -= 1;
        if (rightPressed) movement.x += 1;
        if (upPressed) movement.y -= 1;
        if (downPressed) movement.y += 1;
        
        // Normalize diagonal movement
        if (movement.magnitude() > 1) {
            movement.normalize();
        }
        
        return movement;
    }
    
    /**
     * Get shooting vector from input
     */
    getShootingVector(): Vector2 {
        const shooting = new Vector2(0, 0);
        
        const leftPressed = this.isActionPressed(InputAction.SHOOT_LEFT);
        const rightPressed = this.isActionPressed(InputAction.SHOOT_RIGHT);
        const upPressed = this.isActionPressed(InputAction.SHOOT_UP);
        const downPressed = this.isActionPressed(InputAction.SHOOT_DOWN);
        
        if (leftPressed) shooting.x -= 1;
        if (rightPressed) shooting.x += 1;
        if (upPressed) shooting.y -= 1;
        if (downPressed) shooting.y += 1;
        
        // Shooting actions detected (debug logging removed)
        
        // Normalize diagonal shooting
        if (shooting.magnitude() > 1) {
            shooting.normalize();
        }
        
        return shooting;
    }
    
    /**
     * Add event listener for an action
     */
    addEventListener(action: InputAction, listener: (event: InputEvent) => void): void {
        const listeners = this.eventListeners.get(action);
        if (listeners) {
            listeners.push(listener);
        }
    }
    
    /**
     * Remove event listener for an action
     */
    removeEventListener(action: InputAction, listener: (event: InputEvent) => void): void {
        const listeners = this.eventListeners.get(action);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    /**
     * Set custom key bindings
     */
    setKeyBindings(bindings: KeyBinding[]): void {
        this.applyKeyBindings(bindings);
        
        // Save to localStorage for persistence
        try {
            localStorage.setItem('robotron_key_bindings', JSON.stringify(bindings));
        } catch (error) {
            console.warn('Failed to save key bindings to localStorage:', error);
        }
    }
    
    /**
     * Load key bindings from localStorage
     */
    loadKeyBindings(): void {
        try {
            const saved = localStorage.getItem('robotron_key_bindings');
            if (saved) {
                const bindings = JSON.parse(saved) as KeyBinding[];
                this.applyKeyBindings(bindings);
            }
        } catch (error) {
            console.warn('Failed to load key bindings from localStorage:', error);
            this.applyKeyBindings(this.defaultBindings);
        }
    }
    
    /**
     * Reset to default key bindings
     */
    resetKeyBindings(): void {
        this.applyKeyBindings(this.defaultBindings);
        localStorage.removeItem('robotron_key_bindings');
    }
    
    /**
     * Set deadzone for analog inputs
     */
    setDeadzone(deadzone: number): void {
        this.deadzone = Math.max(0, Math.min(1, deadzone));
    }
    
    /**
     * Get current mouse position
     */
    getMousePosition(): Vector2 {
        return this.mousePosition.clone();
    }
    
    /**
     * Check if any gamepad is connected
     */
    isGamepadConnected(): boolean {
        return this.gamepads.size > 0;
    }
    
    /**
     * Get connected gamepad count
     */
    getGamepadCount(): number {
        return this.gamepads.size;
    }
}

/**
 * Global input manager instance
 */
export const inputManager = UnifiedInputManager.getInstance();