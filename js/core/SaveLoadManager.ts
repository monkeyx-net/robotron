import { saveSystem, GameSettings, GameStatistics } from './SaveSystem';
import { gameState, GameState } from '../gameState';
import { gameEvents } from './EventSystem';

/**
 * High-level save/load manager that integrates with the game
 */
export class SaveLoadManager {
    private static instance: SaveLoadManager;
    private gameStartTime: number = 0;
    
    private constructor() {
        this.setupEventListeners();
    }
    
    public static getInstance(): SaveLoadManager {
        if (!SaveLoadManager.instance) {
            SaveLoadManager.instance = new SaveLoadManager();
        }
        return SaveLoadManager.instance;
    }
    
    /**
     * Setup event listeners for automatic save/load operations
     */
    private setupEventListeners(): void {
        // Listen for auto-save requests
        gameEvents.on('save:auto_save_requested', () => {
            this.saveCurrentGame();
        });
        
        // Listen for game events that should trigger saves
        gameEvents.on('game:score_changed', (event) => {
            this.updateScore(event.data.score);
        });
        
        gameEvents.on('game:wave_completed', (event) => {
            this.updateWave(event.data.wave);
        });
        
        gameEvents.on('game:over', (event) => {
            this.handleGameOver(event.data);
        });
        
        gameEvents.on('game:started', () => {
            this.handleGameStart();
        });
        
        gameEvents.on('human:rescued', () => {
            this.incrementStatistic('totalHumansRescued');
        });
        
        gameEvents.on('enemy:destroyed', () => {
            this.incrementStatistic('totalEnemiesDestroyed');
        });
    }
    
    /**
     * Save the current game state
     */
    public saveCurrentGame(): boolean {
        try {
            const success = saveSystem.saveGame(gameState);
            
            if (success) {
                gameEvents.emit({
                    type: 'ui:show_message',
                    timestamp: Date.now(),
                    source: 'SaveLoadManager',
                    data: { 
                        message: 'Game Saved',
                        type: 'success',
                        duration: 2000
                    }
                });
            }
            
            return success;
        } catch (error) {
            console.error('Failed to save current game:', error);
            
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'Save Failed',
                    type: 'error',
                    duration: 3000
                }
            });
            
            return false;
        }
    }
    
    /**
     * Load saved game state
     */
    public loadSavedGame(): boolean {
        try {
            const saveData = saveSystem.loadGame();
            
            if (!saveData || !saveData.gameState) {
                gameEvents.emit({
                    type: 'ui:show_message',
                    timestamp: Date.now(),
                    source: 'SaveLoadManager',
                    data: { 
                        message: 'No Save Data Found',
                        type: 'warning',
                        duration: 3000
                    }
                });
                return false;
            }
            
            // Apply loaded state to current game state
            this.applyLoadedState(saveData.gameState);
            
            gameEvents.emit({
                type: 'game:loaded',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    saveTimestamp: saveData.timestamp,
                    gameState: saveData.gameState
                }
            });
            
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'Game Loaded',
                    type: 'success',
                    duration: 2000
                }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to load saved game:', error);
            
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'Load Failed',
                    type: 'error',
                    duration: 3000
                }
            });
            
            return false;
        }
    }
    
    /**
     * Apply loaded state to current game state
     */
    private applyLoadedState(loadedState: Partial<GameState>): void {
        // Safely apply loaded values to current game state
        if (loadedState.score !== undefined) {
            gameState.score = loadedState.score;
        }
        if (loadedState.lives !== undefined) {
            gameState.lives = loadedState.lives;
        }
        if (loadedState.wave !== undefined) {
            gameState.wave = loadedState.wave;
        }
        if (loadedState.currentHumanRescueBonus !== undefined) {
            gameState.currentHumanRescueBonus = loadedState.currentHumanRescueBonus;
        }
        if (loadedState.humanRescueBonusDecayTimer !== undefined) {
            gameState.humanRescueBonusDecayTimer = loadedState.humanRescueBonusDecayTimer;
        }
        if (loadedState.nextExtraLifeScore !== undefined) {
            gameState.nextExtraLifeScore = loadedState.nextExtraLifeScore;
        }
        if (loadedState.highScore !== undefined) {
            gameState.highScore = loadedState.highScore;
        }
        if (loadedState.currentGameState !== undefined) {
            gameState.currentGameState = loadedState.currentGameState;
        }
        
        // Emit state change events
        gameEvents.emit({
            type: 'game:state_updated',
            timestamp: Date.now(),
            source: 'SaveLoadManager',
            data: { gameState }
        });
    }
    
    /**
     * Save game settings
     */
    public saveSettings(settings: Partial<GameSettings>): boolean {
        const success = saveSystem.saveSettings(settings);
        
        if (success) {
            gameEvents.emit({
                type: 'settings:applied',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { settings }
            });
        }
        
        return success;
    }
    
    /**
     * Load game settings
     */
    public loadSettings(): GameSettings {
        return saveSystem.loadSettings();
    }
    
    /**
     * Get game statistics
     */
    public getStatistics(): GameStatistics {
        return saveSystem.loadStatistics();
    }
    
    /**
     * Check if save data exists
     */
    public hasSaveData(): boolean {
        return saveSystem.hasSaveData();
    }
    
    /**
     * Get save data information
     */
    public getSaveInfo(): { exists: boolean; timestamp?: number; age?: string } {
        const exists = this.hasSaveData();
        if (!exists) {
            return { exists: false };
        }
        
        const timestamp = saveSystem.getSaveTimestamp();
        if (!timestamp) {
            return { exists: true };
        }
        
        const age = this.formatTimeSince(timestamp);
        return { exists: true, timestamp, age };
    }
    
    /**
     * Clear all save data
     */
    public clearAllData(): boolean {
        const success = saveSystem.clearAllData();
        
        if (success) {
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'All Data Cleared',
                    type: 'info',
                    duration: 2000
                }
            });
        }
        
        return success;
    }
    
    /**
     * Export save data for backup
     */
    public exportSaveData(): string | null {
        return saveSystem.exportSaveData();
    }
    
    /**
     * Import save data from backup
     */
    public importSaveData(jsonData: string): boolean {
        const success = saveSystem.importSaveData(jsonData);
        
        if (success) {
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'Save Data Imported',
                    type: 'success',
                    duration: 2000
                }
            });
        } else {
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'Import Failed',
                    type: 'error',
                    duration: 3000
                }
            });
        }
        
        return success;
    }
    
    /**
     * Handle game start for time tracking
     */
    private handleGameStart(): void {
        this.gameStartTime = Date.now();
        
        // Update statistics
        const stats = this.getStatistics();
        stats.totalGamesPlayed++;
        stats.lastPlayedDate = Date.now();
        saveSystem.saveStatistics(stats);
    }
    
    /**
     * Handle game over for statistics and saving
     */
    private handleGameOver(_data: any): void {
        const playTime = Date.now() - this.gameStartTime;
        
        // Update statistics
        const stats = this.getStatistics();
        stats.totalScore += gameState.score;
        stats.totalPlayTime += playTime;
        
        if (gameState.wave > stats.highestWave) {
            stats.highestWave = gameState.wave;
        }
        
        // Check if this was a winning game (reached a high wave)
        if (gameState.wave >= 10) { // Arbitrary win condition
            stats.gamesWon++;
        }
        
        // Recalculate average score
        if (stats.totalGamesPlayed > 0) {
            stats.averageScore = stats.totalScore / stats.totalGamesPlayed;
        }
        
        saveSystem.saveStatistics(stats);
        
        // Save final game state
        this.saveCurrentGame();
    }
    
    /**
     * Update score and trigger high score check
     */
    private updateScore(newScore: number): void {
        if (newScore > gameState.highScore) {
            gameState.highScore = newScore;
            
            gameEvents.emit({
                type: 'game:new_high_score',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { score: newScore }
            });
        }
        
        // Auto-save on significant score increases
        if (newScore > 0 && newScore % 10000 === 0) {
            this.saveCurrentGame();
        }
    }
    
    /**
     * Update wave progress
     */
    private updateWave(_newWave: number): void {
        // Auto-save on wave completion
        this.saveCurrentGame();
    }
    
    /**
     * Increment a statistic counter
     */
    private incrementStatistic(statName: keyof GameStatistics): void {
        const stats = this.getStatistics();
        if (typeof stats[statName] === 'number') {
            (stats[statName] as number)++;
            saveSystem.saveStatistics(stats);
        }
    }
    
    /**
     * Format time since timestamp
     */
    private formatTimeSince(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }
    
    /**
     * Get storage usage information
     */
    public getStorageInfo(): { used: number; available: boolean; quota?: number } {
        return saveSystem.getStorageInfo();
    }
    
    /**
     * Quick save (for hotkey)
     */
    public quickSave(): boolean {
        if (gameState.currentGameState !== 'PLAYING') {
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'Can only save during gameplay',
                    type: 'warning',
                    duration: 2000
                }
            });
            return false;
        }
        
        return this.saveCurrentGame();
    }
    
    /**
     * Quick load (for hotkey)
     */
    public quickLoad(): boolean {
        if (!this.hasSaveData()) {
            gameEvents.emit({
                type: 'ui:show_message',
                timestamp: Date.now(),
                source: 'SaveLoadManager',
                data: { 
                    message: 'No save data to load',
                    type: 'warning',
                    duration: 2000
                }
            });
            return false;
        }
        
        return this.loadSavedGame();
    }
}

// Export singleton instance
export const saveLoadManager = SaveLoadManager.getInstance();