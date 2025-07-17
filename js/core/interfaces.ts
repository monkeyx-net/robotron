import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';
import { GameObject } from './GameObject';

/**
 * Core interfaces for the Robotron game systems
 */

// Game Engine Interface
export interface IGameEngine {
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    update(deltaTime: number): void;
    render(): void;
    isRunning(): boolean;
    isPaused(): boolean;
}

// Game State Interface
export interface IGameState {
    name: string;
    enter(): void;
    exit(): void;
    update(deltaTime: number): void;
    render(): void;
    handleInput(input: InputEvent): void;
}

// Renderer Interface
export interface IRenderer {
    render(objects: GameObject[]): void;
    clear(): void;
    setViewport(x: number, y: number, width: number, height: number): void;
}

// Input Handler Interface
export interface IInputHandler {
    update(): void;
    isKeyDown(key: string): boolean;
    isKeyPressed(key: string): boolean;
    isKeyReleased(key: string): boolean;
    getMousePosition(): Vector2;
    isMouseButtonDown(button: number): boolean;
    getGamepadInput(index: number): GamepadInput | null;
}

// Collision System Interface
export interface ICollisionSystem {
    addObject(object: GameObject): void;
    removeObject(object: GameObject): void;
    checkCollisions(): CollisionPair[];
    clear(): void;
    setGridSize(size: number): void;
}

// Asset Manager Interface
export interface IAssetManager {
    loadTexture(path: string, id: string): Promise<any>;
    loadSound(path: string, id: string): Promise<any>;
    getTexture(id: string): any;
    getSound(id: string): any;
    isLoaded(id: string): boolean;
    preloadAssets(assets: AssetDefinition[]): Promise<void>;
}

// Event System Interface
export interface IEventSystem {
    subscribe(eventType: string, callback: EventCallback): void;
    unsubscribe(eventType: string, callback: EventCallback): void;
    emit(eventType: string, data?: any): void;
    clear(): void;
}

// Error Handler Interface
export interface IErrorHandler {
    handleError(error: GameError): void;
    registerRecoveryStrategy(errorType: ErrorType, strategy: IRecoveryStrategy): void;
    getErrorLog(): ErrorLogEntry[];
    clearErrorLog(): void;
}

// Recovery Strategy Interface
export interface IRecoveryStrategy {
    canRecover(error: GameError): boolean;
    recover(error: GameError): boolean;
}

// Object Pool Interface
export interface IObjectPool<T> {
    acquire(): T;
    release(object: T): void;
    clear(): void;
    size(): number;
    available(): number;
}

// AI Strategy Interface
export interface IAIStrategy {
    update(entity: GameObject, deltaTime: number, context: AIContext): void;
    getName(): string;
}

// Weapon System Interface
export interface IWeaponSystem {
    fire(position: Vector2, direction: Vector2): void;
    canFire(): boolean;
    getFireRate(): number;
    setFireRate(rate: number): void;
}

// Data Types and Structures

export interface GamepadInput {
    leftStick: Vector2;
    rightStick: Vector2;
    buttons: boolean[];
    triggers: number[];
}

export interface CollisionPair {
    objectA: GameObject;
    objectB: GameObject;
    normal: Vector2;
    penetration: number;
}

export interface AssetDefinition {
    id: string;
    path: string;
    type: 'texture' | 'sound' | 'data';
}

export interface GameError {
    type: ErrorType;
    message: string;
    stack?: string;
    context?: any;
    timestamp: number;
}

export interface ErrorLogEntry {
    error: GameError;
    recovered: boolean;
    recoveryAttempts: number;
}

export interface AIContext {
    player?: GameObject;
    enemies: GameObject[];
    projectiles: GameObject[];
    obstacles: GameObject[];
    deltaTime: number;
}

export interface GameConfig {
    gameplay: GameplayConfig;
    graphics: GraphicsConfig;
    audio: AudioConfig;
    input: InputConfig;
    performance: PerformanceConfig;
}

export interface GameplayConfig {
    playerSpeed: number;
    projectileSpeed: number;
    enemySpawnRate: number;
    difficultyScaling: number;
    lives: number;
    scoreMultiplier: number;
}

export interface GraphicsConfig {
    width: number;
    height: number;
    pixelArt: boolean;
    particleCount: number;
    effectsEnabled: boolean;
}

export interface AudioConfig {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    enabled: boolean;
}

export interface InputConfig {
    keyBindings: { [action: string]: string[] };
    gamepadEnabled: boolean;
    touchEnabled: boolean;
    deadzone: number;
}

export interface PerformanceConfig {
    targetFPS: number;
    vsync: boolean;
    cullingEnabled: boolean;
    batchingEnabled: boolean;
    maxEntities: number;
}

// Enums
export enum ErrorType {
    ASSET_LOAD_FAILED = 'ASSET_LOAD_FAILED',
    RENDER_ERROR = 'RENDER_ERROR',
    AUDIO_ERROR = 'AUDIO_ERROR',
    INPUT_ERROR = 'INPUT_ERROR',
    COLLISION_ERROR = 'COLLISION_ERROR',
    GAME_LOGIC_ERROR = 'GAME_LOGIC_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum GameStateType {
    TITLE = 'TITLE',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    GAME_OVER = 'GAME_OVER',
    HIGH_SCORE = 'HIGH_SCORE',
    SETTINGS = 'SETTINGS',
    LOADING = 'LOADING'
}

export enum EntityType {
    PLAYER = 'PLAYER',
    ENEMY = 'ENEMY',
    PROJECTILE = 'PROJECTILE',
    HUMAN = 'HUMAN',
    OBSTACLE = 'OBSTACLE',
    EFFECT = 'EFFECT',
    PICKUP = 'PICKUP'
}

export enum CollisionLayer {
    PLAYER = 1 << 0,
    ENEMY = 1 << 1,
    PROJECTILE = 1 << 2,
    OBSTACLE = 1 << 3,
    HUMAN = 1 << 4,
    PICKUP = 1 << 5,
    EFFECT = 1 << 6
}

// Type Aliases
export type EventCallback = (data?: any) => void;
export type UpdateFunction = (deltaTime: number) => void;
export type RenderFunction = () => void;