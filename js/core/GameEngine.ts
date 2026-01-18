/**
 * GameEngine - Enhanced game loop with fixed timestep and separated update/render
 * 
 * This module provides a robust game engine with fixed timestep physics,
 * separated update and render loops, frame rate monitoring, and performance metrics.
 * This ensures consistent physics simulation regardless of frame rate.
 */

import { gameEvents } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Game loop state
 */
export enum GameLoopState {
    STOPPED = 'stopped',
    RUNNING = 'running',
    PAUSED = 'paused'
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    fps: number;
    averageFps: number;
    frameTime: number;
    updateTime: number;
    renderTime: number;
    totalFrames: number;
    droppedFrames: number;
    lastFrameTimestamp: number;
}

/**
 * Game engine configuration
 */
export interface GameEngineConfig {
    targetFps: number;
    fixedTimeStep: number; // in milliseconds
    maxFrameTime: number; // maximum frame time to prevent spiral of death
    enableVSync: boolean;
    enablePerformanceMonitoring: boolean;
    performanceUpdateInterval: number; // how often to update performance metrics
}

/**
 * Default game engine configuration
 */
const DEFAULT_CONFIG: GameEngineConfig = {
    targetFps: 60,
    fixedTimeStep: 1000 / 60, // 16.67ms for 60 FPS
    maxFrameTime: 1000 / 20, // 50ms maximum (20 FPS minimum)
    enableVSync: true,
    enablePerformanceMonitoring: true,
    performanceUpdateInterval: 1000 // Update performance metrics every second
};

/**
 * Game system interface
 */
export interface GameSystem {
    name: string;
    priority: number;
    enabled: boolean;
    update(deltaTime: number, totalTime: number): void;
    render?(interpolation: number): void;
    onPause?(): void;
    onResume?(): void;
    onDestroy?(): void;
}

/**
 * Enhanced game engine with fixed timestep
 */
export class GameEngine {
    private config: GameEngineConfig;
    private state: GameLoopState = GameLoopState.STOPPED;
    private systems: GameSystem[] = [];
    
    // Timing variables
    private lastTime: number = 0;
    private accumulator: number = 0;
    private currentTime: number = 0;
    private frameId: number = 0;
    
    // Performance tracking
    private metrics: PerformanceMetrics = {
        fps: 0,
        averageFps: 0,
        frameTime: 0,
        updateTime: 0,
        renderTime: 0,
        totalFrames: 0,
        droppedFrames: 0,
        lastFrameTimestamp: 0
    };
    
    private performanceHistory: number[] = [];
    private lastPerformanceUpdate: number = 0;
    
    // Event callbacks
    private onUpdateCallback?: (deltaTime: number, totalTime: number) => void;
    private onRenderCallback?: (interpolation: number) => void;
    private onPerformanceUpdateCallback?: (metrics: PerformanceMetrics) => void;
    
    constructor(config: Partial<GameEngineConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        // Bind methods to preserve context
        this.gameLoop = this.gameLoop.bind(this);
        
        console.log('GameEngine initialized:', {
            targetFps: this.config.targetFps,
            fixedTimeStep: this.config.fixedTimeStep,
            enableVSync: this.config.enableVSync
        });
    }
    
    /**
     * Add a game system
     */
    addSystem(system: GameSystem): void {
        // Check if system already exists
        const existingIndex = this.systems.findIndex(s => s.name === system.name);
        if (existingIndex !== -1) {
            console.warn(`GameEngine: System '${system.name}' already exists, replacing...`);
            this.systems[existingIndex] = system;
        } else {
            this.systems.push(system);
        }
        
        // Sort systems by priority (higher priority first)
        this.systems.sort((a, b) => b.priority - a.priority);
        
        console.log(`GameEngine: Added system '${system.name}' with priority ${system.priority}`);
    }
    
    /**
     * Remove a game system
     */
    removeSystem(systemName: string): boolean {
        const index = this.systems.findIndex(s => s.name === systemName);
        if (index !== -1) {
            const system = this.systems[index];
            
            // Call destroy callback if available
            if (system.onDestroy) {
                try {
                    system.onDestroy();
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.MEDIUM,
                        { systemName },
                        'GameEngine.removeSystem'
                    );
                }
            }
            
            this.systems.splice(index, 1);
            console.log(`GameEngine: Removed system '${systemName}'`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Get a system by name
     */
    getSystem(systemName: string): GameSystem | undefined {
        return this.systems.find(s => s.name === systemName);
    }
    
    /**
     * Enable or disable a system
     */
    setSystemEnabled(systemName: string, enabled: boolean): boolean {
        const system = this.getSystem(systemName);
        if (system) {
            system.enabled = enabled;
            console.log(`GameEngine: System '${systemName}' ${enabled ? 'enabled' : 'disabled'}`);
            return true;
        }
        return false;
    }
    
    /**
     * Set update callback
     */
    setUpdateCallback(callback: (deltaTime: number, totalTime: number) => void): void {
        this.onUpdateCallback = callback;
    }
    
    /**
     * Set render callback
     */
    setRenderCallback(callback: (interpolation: number) => void): void {
        this.onRenderCallback = callback;
    }
    
    /**
     * Set performance update callback
     */
    setPerformanceCallback(callback: (metrics: PerformanceMetrics) => void): void {
        this.onPerformanceUpdateCallback = callback;
    }
    
    /**
     * Start the game loop
     */
    start(): void {
        if (this.state === GameLoopState.RUNNING) {
            console.warn('GameEngine: Already running');
            return;
        }
        
        this.state = GameLoopState.RUNNING;
        this.lastTime = performance.now();
        this.currentTime = this.lastTime;
        this.accumulator = 0;
        
        // Reset performance metrics
        this.metrics.totalFrames = 0;
        this.metrics.droppedFrames = 0;
        this.performanceHistory.length = 0;
        
        // Start the game loop
        if (this.config.enableVSync) {
            this.frameId = requestAnimationFrame(this.gameLoop);
        } else {
            // Use setTimeout for non-VSync mode
            this.frameId = setTimeout(this.gameLoop, 0) as any;
        }
        
        // Emit start event
        gameEvents.emit({
            type: 'engine:started',
            timestamp: Date.now(),
            source: 'GameEngine',
            data: { config: this.config }
        });
        
        console.log('GameEngine: Started');
    }
    
    /**
     * Stop the game loop
     */
    stop(): void {
        if (this.state === GameLoopState.STOPPED) {
            return;
        }
        
        this.state = GameLoopState.STOPPED;
        
        // Cancel the animation frame or timeout
        if (this.config.enableVSync) {
            cancelAnimationFrame(this.frameId);
        } else {
            clearTimeout(this.frameId);
        }
        
        // Emit stop event
        gameEvents.emit({
            type: 'engine:stopped',
            timestamp: Date.now(),
            source: 'GameEngine',
            data: { metrics: this.metrics }
        });
        
        console.log('GameEngine: Stopped');
    }
    
    /**
     * Pause the game loop
     */
    pause(): void {
        if (this.state !== GameLoopState.RUNNING) {
            return;
        }
        
        this.state = GameLoopState.PAUSED;
        
        // Notify systems
        for (const system of this.systems) {
            if (system.enabled && system.onPause) {
                try {
                    system.onPause();
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.LOW,
                        { systemName: system.name },
                        'GameEngine.pause'
                    );
                }
            }
        }
        
        console.log('GameEngine: Paused');
    }
    
    /**
     * Resume the game loop
     */
    resume(): void {
        if (this.state !== GameLoopState.PAUSED) {
            return;
        }
        
        this.state = GameLoopState.RUNNING;
        this.lastTime = performance.now(); // Reset timing to prevent large delta
        
        // Notify systems
        for (const system of this.systems) {
            if (system.enabled && system.onResume) {
                try {
                    system.onResume();
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.LOW,
                        { systemName: system.name },
                        'GameEngine.resume'
                    );
                }
            }
        }
        
        console.log('GameEngine: Resumed');
    }
    
    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }
    
    /**
     * Get current game loop state
     */
    getState(): GameLoopState {
        return this.state;
    }
    
    /**
     * Update engine configuration
     */
    updateConfig(newConfig: Partial<GameEngineConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('GameEngine: Configuration updated', newConfig);
    }
    
    /**
     * Main game loop with fixed timestep
     */
    private gameLoop(timestamp: number): void {
        if (this.state !== GameLoopState.RUNNING) {
            return;
        }
        
        const frameStartTime = performance.now();
        
        // Calculate frame time
        const frameTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        // Clamp frame time to prevent spiral of death
        const clampedFrameTime = Math.min(frameTime, this.config.maxFrameTime);
        
        // Track dropped frames
        if (frameTime > this.config.maxFrameTime) {
            this.metrics.droppedFrames++;
        }
        
        // Add to accumulator
        this.accumulator += clampedFrameTime;
        
        // Fixed timestep updates
        const updateStartTime = performance.now();
        let updateSteps = 0;
        const maxUpdateSteps = 5; // Prevent infinite loop
        
        while (this.accumulator >= this.config.fixedTimeStep && updateSteps < maxUpdateSteps) {
            this.currentTime += this.config.fixedTimeStep;
            
            // Update all systems
            this.updateSystems(this.config.fixedTimeStep, this.currentTime);
            
            // Call update callback
            if (this.onUpdateCallback) {
                try {
                    this.onUpdateCallback(this.config.fixedTimeStep, this.currentTime);
                } catch (error) {
                    errorHandler.handleError(
                        error as Error,
                        ErrorCategory.GAME_LOGIC,
                        ErrorSeverity.HIGH,
                        { deltaTime: this.config.fixedTimeStep },
                        'GameEngine.gameLoop.update'
                    );
                }
            }
            
            this.accumulator -= this.config.fixedTimeStep;
            updateSteps++;
        }
        
        const updateEndTime = performance.now();
        
        // Calculate interpolation for smooth rendering
        const interpolation = this.accumulator / this.config.fixedTimeStep;
        
        // Render with interpolation
        const renderStartTime = performance.now();
        
        this.renderSystems(interpolation);
        
        // Call render callback
        if (this.onRenderCallback) {
            try {
                this.onRenderCallback(interpolation);
            } catch (error) {
                errorHandler.handleError(
                    error as Error,
                    ErrorCategory.RENDERING,
                    ErrorSeverity.HIGH,
                    { interpolation },
                    'GameEngine.gameLoop.render'
                );
            }
        }
        
        const renderEndTime = performance.now();
        
        // Update performance metrics
        this.updatePerformanceMetrics(frameStartTime, updateStartTime, updateEndTime, renderStartTime, renderEndTime);
        
        // Schedule next frame
        if (this.config.enableVSync) {
            this.frameId = requestAnimationFrame(this.gameLoop);
        } else {
            this.frameId = setTimeout(this.gameLoop, 1000 / this.config.targetFps) as any;
        }
    }
    
    /**
     * Update all enabled systems
     */
    private updateSystems(deltaTime: number, totalTime: number): void {
        for (const system of this.systems) {
            if (!system.enabled) {
                continue;
            }
            
            try {
                system.update(deltaTime, totalTime);
            } catch (error) {
                errorHandler.handleError(
                    error as Error,
                    ErrorCategory.GAME_LOGIC,
                    ErrorSeverity.MEDIUM,
                    { systemName: system.name, deltaTime, totalTime },
                    'GameEngine.updateSystems'
                );
                
                // Disable problematic system to prevent cascade failures
                system.enabled = false;
                console.warn(`GameEngine: Disabled system '${system.name}' due to error`);
            }
        }
    }
    
    /**
     * Render all enabled systems
     */
    private renderSystems(interpolation: number): void {
        for (const system of this.systems) {
            if (!system.enabled || !system.render) {
                continue;
            }
            
            try {
                system.render(interpolation);
            } catch (error) {
                errorHandler.handleError(
                    error as Error,
                    ErrorCategory.RENDERING,
                    ErrorSeverity.MEDIUM,
                    { systemName: system.name, interpolation },
                    'GameEngine.renderSystems'
                );
            }
        }
    }
    
    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(
        frameStart: number,
        updateStart: number,
        updateEnd: number,
        renderStart: number,
        renderEnd: number
    ): void {
        if (!this.config.enablePerformanceMonitoring) {
            return;
        }
        
        const now = performance.now();
        const frameTime = now - frameStart;
        
        // Update metrics
        this.metrics.frameTime = frameTime;
        this.metrics.updateTime = updateEnd - updateStart;
        this.metrics.renderTime = renderEnd - renderStart;
        this.metrics.totalFrames++;
        this.metrics.lastFrameTimestamp = now;
        
        // Calculate FPS
        this.metrics.fps = 1000 / frameTime;
        
        // Add to performance history for average calculation
        this.performanceHistory.push(this.metrics.fps);
        if (this.performanceHistory.length > 60) { // Keep last 60 frames
            this.performanceHistory.shift();
        }
        
        // Update average FPS
        this.metrics.averageFps = this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length;
        
        // Update performance callback periodically
        if (now - this.lastPerformanceUpdate > this.config.performanceUpdateInterval) {
            this.lastPerformanceUpdate = now;
            
            if (this.onPerformanceUpdateCallback) {
                this.onPerformanceUpdateCallback(this.metrics);
            }
            
            // Emit performance event
            gameEvents.emit({
                type: 'engine:performance',
                timestamp: Date.now(),
                source: 'GameEngine',
                data: this.metrics
            });
        }
    }
}

/**
 * Global game engine instance
 */
export const gameEngine = new GameEngine();

/**
 * Game engine utilities
 */
export const EngineUtils = {
    /**
     * Create a basic game system
     */
    createSystem(
        name: string,
        updateFn: (deltaTime: number, totalTime: number) => void,
        renderFn?: (interpolation: number) => void,
        priority: number = 0
    ): GameSystem {
        return {
            name,
            priority,
            enabled: true,
            update: updateFn,
            render: renderFn
        };
    },
    
    /**
     * Convert frame rate to time step
     */
    fpsToTimeStep(fps: number): number {
        return 1000 / fps;
    },
    
    /**
     * Convert time step to frame rate
     */
    timeStepToFps(timeStep: number): number {
        return 1000 / timeStep;
    },
    
    /**
     * Interpolate between two values
     */
    interpolate(previous: number, current: number, alpha: number): number {
        return previous + (current - previous) * alpha;
    },
    
    /**
     * Interpolate between two positions
     */
    interpolatePosition(
        prevX: number, prevY: number,
        currX: number, currY: number,
        alpha: number
    ): { x: number; y: number } {
        return {
            x: this.interpolate(prevX, currX, alpha),
            y: this.interpolate(prevY, currY, alpha)
        };
    }
};