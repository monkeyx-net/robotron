import { GameState } from '../gameState';
import { gameEvents } from './EventSystem';

/**
 * Interface for saveable game data
 */
export interface SaveData {
    version: string;
    timestamp: number;
    gameState: Partial<GameState>;
    settings: GameSettings;
    statistics: GameStatistics;
    achievements?: Achievement[];
}

/**
 * Game settings that can be saved
 */
export interface GameSettings {
    soundEnabled: boolean;
    musicEnabled: boolean;
    soundVolume: number;
    musicVolume: number;
    keyBindings: KeyBindings;
    difficulty: 'easy' | 'normal' | 'hard';
    screenShakeEnabled: boolean;
    particleEffectsEnabled: boolean;
}

/**
 * Key binding configuration
 */
export interface KeyBindings {
    moveUp: string;
    moveDown: string;
    moveLeft: string;
    moveRight: string;
    shootUp: string;
    shootDown: string;
    shootLeft: string;
    shootRight: string;
    pause: string;
}

/**
 * Game statistics for tracking player progress
 */
export interface GameStatistics {
    totalGamesPlayed: number;
    totalScore: number;
    highestWave: number;
    totalHumansRescued: number;
    totalEnemiesDestroyed: number;
    totalPlayTime: number; // in milliseconds
    averageScore: number;
    gamesWon: number;
    lastPlayedDate: number;
}

/**
 * Achievement system data
 */
export interface Achievement {
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
    unlockedDate?: number;
    progress?: number;
    maxProgress?: number;
}

/**
 * Save system error types
 */
export enum SaveSystemError {
    STORAGE_NOT_AVAILABLE = 'STORAGE_NOT_AVAILABLE',
    SAVE_FAILED = 'SAVE_FAILED',
    LOAD_FAILED = 'LOAD_FAILED',
    INVALID_DATA = 'INVALID_DATA',
    VERSION_MISMATCH = 'VERSION_MISMATCH',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

/**
 * Save system class for managing game persistence
 */
export class SaveSystem {
    private static readonly SAVE_KEY = 'robotron_save_data';
    private static readonly SETTINGS_KEY = 'robotron_settings';
    private static readonly STATISTICS_KEY = 'robotron_statistics';
    private static readonly ACHIEVEMENTS_KEY = 'robotron_achievements';
    private static readonly CURRENT_VERSION = '1.0.0';
    
    private static instance: SaveSystem;
    private isAvailable: boolean = false;
    private defaultSettings!: GameSettings;
    private defaultStatistics!: GameStatistics;
    
    private constructor() {
        this.checkStorageAvailability();
        this.initializeDefaults();
        this.setupEventListeners();
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(): SaveSystem {
        if (!SaveSystem.instance) {
            SaveSystem.instance = new SaveSystem();
        }
        return SaveSystem.instance;
    }
    
    /**
     * Check if localStorage is available
     */
    private checkStorageAvailability(): void {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            this.isAvailable = true;
        } catch (error) {
            console.warn('localStorage not available:', error);
            this.isAvailable = false;
            
            gameEvents.emit({
                type: 'save:storage_unavailable',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { error: SaveSystemError.STORAGE_NOT_AVAILABLE }
            });
        }
    }
    
    /**
     * Initialize default settings and statistics
     */
    private initializeDefaults(): void {
        this.defaultSettings = {
            soundEnabled: true,
            musicEnabled: true,
            soundVolume: 0.7,
            musicVolume: 0.5,
            keyBindings: {
                moveUp: 'KeyW',
                moveDown: 'KeyS',
                moveLeft: 'KeyA',
                moveRight: 'KeyD',
                shootUp: 'ArrowUp',
                shootDown: 'ArrowDown',
                shootLeft: 'ArrowLeft',
                shootRight: 'ArrowRight',
                pause: 'KeyP'
            },
            difficulty: 'normal',
            screenShakeEnabled: false, // Disabled by default to reduce jarring effects
            particleEffectsEnabled: true
        };
        
        this.defaultStatistics = {
            totalGamesPlayed: 0,
            totalScore: 0,
            highestWave: 0,
            totalHumansRescued: 0,
            totalEnemiesDestroyed: 0,
            totalPlayTime: 0,
            averageScore: 0,
            gamesWon: 0,
            lastPlayedDate: 0
        };
    }
    
    /**
     * Setup event listeners for automatic saving
     */
    private setupEventListeners(): void {
        // Auto-save on game state changes
        gameEvents.on('game:score_changed', () => this.autoSave());
        gameEvents.on('game:wave_completed', () => this.autoSave());
        gameEvents.on('game:over', () => this.saveGameEnd());
        gameEvents.on('human:rescued', () => this.updateStatistics('humanRescued'));
        gameEvents.on('enemy:destroyed', () => this.updateStatistics('enemyDestroyed'));
        
        // Save settings when they change
        gameEvents.on('settings:changed', (event) => this.saveSettings(event.data));
        
        // Auto-save periodically during gameplay
        setInterval(() => {
            if (this.shouldAutoSave()) {
                this.autoSave();
            }
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Save complete game data
     */
    public saveGame(gameState: GameState): boolean {
        if (!this.isAvailable) {
            console.warn('Cannot save game: localStorage not available');
            return false;
        }
        
        try {
            const saveData: SaveData = {
                version: SaveSystem.CURRENT_VERSION,
                timestamp: Date.now(),
                gameState: {
                    score: gameState.score,
                    lives: gameState.lives,
                    wave: gameState.wave,
                    currentHumanRescueBonus: gameState.currentHumanRescueBonus,
                    humanRescueBonusDecayTimer: gameState.humanRescueBonusDecayTimer,
                    nextExtraLifeScore: gameState.nextExtraLifeScore,
                    highScore: gameState.highScore,
                    currentGameState: gameState.currentGameState
                },
                settings: this.loadSettings(),
                statistics: this.loadStatistics()
            };
            
            const serializedData = JSON.stringify(saveData);
            localStorage.setItem(SaveSystem.SAVE_KEY, serializedData);
            
            gameEvents.emit({
                type: 'save:game_saved',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { success: true, size: serializedData.length }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            
            gameEvents.emit({
                type: 'save:save_failed',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { error: SaveSystemError.SAVE_FAILED, details: error }
            });
            
            return false;
        }
    }
    
    /**
     * Load complete game data
     */
    public loadGame(): SaveData | null {
        if (!this.isAvailable) {
            console.warn('Cannot load game: localStorage not available');
            return null;
        }
        
        try {
            const savedData = localStorage.getItem(SaveSystem.SAVE_KEY);
            if (!savedData) {
                return null;
            }
            
            const saveData: SaveData = JSON.parse(savedData);
            
            // Validate save data version
            if (!this.validateSaveData(saveData)) {
                console.warn('Invalid save data detected');
                return null;
            }
            
            gameEvents.emit({
                type: 'save:game_loaded',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { 
                    success: true, 
                    version: saveData.version,
                    timestamp: saveData.timestamp
                }
            });
            
            return saveData;
        } catch (error) {
            console.error('Failed to load game:', error);
            
            gameEvents.emit({
                type: 'save:load_failed',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { error: SaveSystemError.LOAD_FAILED, details: error }
            });
            
            return null;
        }
    }
    
    /**
     * Save game settings
     */
    public saveSettings(settings: Partial<GameSettings>): boolean {
        if (!this.isAvailable) return false;
        
        try {
            const currentSettings = this.loadSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            
            localStorage.setItem(SaveSystem.SETTINGS_KEY, JSON.stringify(updatedSettings));
            
            gameEvents.emit({
                type: 'save:settings_saved',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { settings: updatedSettings }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }
    
    /**
     * Load game settings
     */
    public loadSettings(): GameSettings {
        if (!this.isAvailable) {
            return { ...this.defaultSettings };
        }
        
        try {
            const savedSettings = localStorage.getItem(SaveSystem.SETTINGS_KEY);
            if (!savedSettings) {
                return { ...this.defaultSettings };
            }
            
            const settings = JSON.parse(savedSettings);
            return { ...this.defaultSettings, ...settings };
        } catch (error) {
            console.error('Failed to load settings:', error);
            return { ...this.defaultSettings };
        }
    }
    
    /**
     * Save game statistics
     */
    public saveStatistics(statistics: Partial<GameStatistics>): boolean {
        if (!this.isAvailable) return false;
        
        try {
            const currentStats = this.loadStatistics();
            const updatedStats = { ...currentStats, ...statistics };
            
            // Calculate derived statistics
            if (updatedStats.totalGamesPlayed > 0) {
                updatedStats.averageScore = updatedStats.totalScore / updatedStats.totalGamesPlayed;
            }
            
            localStorage.setItem(SaveSystem.STATISTICS_KEY, JSON.stringify(updatedStats));
            
            gameEvents.emit({
                type: 'save:statistics_saved',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { statistics: updatedStats }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to save statistics:', error);
            return false;
        }
    }
    
    /**
     * Load game statistics
     */
    public loadStatistics(): GameStatistics {
        if (!this.isAvailable) {
            return { ...this.defaultStatistics };
        }
        
        try {
            const savedStats = localStorage.getItem(SaveSystem.STATISTICS_KEY);
            if (!savedStats) {
                return { ...this.defaultStatistics };
            }
            
            const statistics = JSON.parse(savedStats);
            return { ...this.defaultStatistics, ...statistics };
        } catch (error) {
            console.error('Failed to load statistics:', error);
            return { ...this.defaultStatistics };
        }
    }
    
    /**
     * Clear all saved data
     */
    public clearAllData(): boolean {
        if (!this.isAvailable) return false;
        
        try {
            localStorage.removeItem(SaveSystem.SAVE_KEY);
            localStorage.removeItem(SaveSystem.SETTINGS_KEY);
            localStorage.removeItem(SaveSystem.STATISTICS_KEY);
            localStorage.removeItem(SaveSystem.ACHIEVEMENTS_KEY);
            
            gameEvents.emit({
                type: 'save:data_cleared',
                timestamp: Date.now(),
                source: 'SaveSystem',
                data: { success: true }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to clear save data:', error);
            return false;
        }
    }
    
    /**
     * Get storage usage information
     */
    public getStorageInfo(): { used: number; available: boolean; quota?: number } {
        if (!this.isAvailable) {
            return { used: 0, available: false };
        }
        
        try {
            let used = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key) && key.startsWith('robotron_')) {
                    used += localStorage[key].length;
                }
            }
            
            return {
                used,
                available: true,
                quota: this.estimateQuota()
            };
        } catch (error) {
            return { used: 0, available: false };
        }
    }
    
    /**
     * Validate save data structure and version
     */
    private validateSaveData(saveData: any): saveData is SaveData {
        if (!saveData || typeof saveData !== 'object') {
            return false;
        }
        
        // Check required fields
        if (!saveData.version || !saveData.timestamp || !saveData.gameState) {
            return false;
        }
        
        // Check version compatibility
        if (saveData.version !== SaveSystem.CURRENT_VERSION) {
            console.warn(`Save data version mismatch: ${saveData.version} vs ${SaveSystem.CURRENT_VERSION}`);
            // For now, we'll try to migrate or use default values
            // In the future, implement version migration logic
        }
        
        return true;
    }
    
    /**
     * Auto-save current game state
     */
    private autoSave(): void {
        // This would need access to the current game state
        // For now, emit an event that the game can listen to
        gameEvents.emit({
            type: 'save:auto_save_requested',
            timestamp: Date.now(),
            source: 'SaveSystem',
            data: {}
        });
    }
    
    /**
     * Determine if auto-save should occur
     */
    private shouldAutoSave(): boolean {
        // Auto-save during gameplay, but not during title screen or game over
        const currentState = this.getCurrentGameState();
        return currentState === 'PLAYING' || currentState === 'WAVE_TRANSITION';
    }
    
    /**
     * Get current game state (this would be injected or accessed differently in real implementation)
     */
    private getCurrentGameState(): string {
        // This is a placeholder - in real implementation, this would access the actual game state
        return 'PLAYING';
    }
    
    /**
     * Handle game end for statistics tracking
     */
    private saveGameEnd(): void {
        const stats = this.loadStatistics();
        stats.totalGamesPlayed++;
        stats.lastPlayedDate = Date.now();
        this.saveStatistics(stats);
    }
    
    /**
     * Update statistics for specific events
     */
    private updateStatistics(event: 'humanRescued' | 'enemyDestroyed'): void {
        const stats = this.loadStatistics();
        
        switch (event) {
            case 'humanRescued':
                stats.totalHumansRescued++;
                break;
            case 'enemyDestroyed':
                stats.totalEnemiesDestroyed++;
                break;
        }
        
        this.saveStatistics(stats);
    }
    
    /**
     * Estimate localStorage quota
     */
    private estimateQuota(): number {
        try {
            // Try to estimate quota by attempting to store data
            let testData = '';
            let quota = 0;
            
            // This is a rough estimation - actual quota detection is complex
            // Most browsers have 5-10MB for localStorage
            return 5 * 1024 * 1024; // 5MB estimate
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Export save data as JSON string (for backup/sharing)
     */
    public exportSaveData(): string | null {
        const saveData = this.loadGame();
        if (!saveData) return null;
        
        return JSON.stringify(saveData, null, 2);
    }
    
    /**
     * Import save data from JSON string
     */
    public importSaveData(jsonData: string): boolean {
        try {
            const saveData = JSON.parse(jsonData);
            if (!this.validateSaveData(saveData)) {
                return false;
            }
            
            localStorage.setItem(SaveSystem.SAVE_KEY, JSON.stringify(saveData));
            return true;
        } catch (error) {
            console.error('Failed to import save data:', error);
            return false;
        }
    }
    
    /**
     * Check if save data exists
     */
    public hasSaveData(): boolean {
        if (!this.isAvailable) return false;
        return localStorage.getItem(SaveSystem.SAVE_KEY) !== null;
    }
    
    /**
     * Get save data timestamp
     */
    public getSaveTimestamp(): number | null {
        const saveData = this.loadGame();
        return saveData ? saveData.timestamp : null;
    }
}

// Export singleton instance
export const saveSystem = SaveSystem.getInstance();