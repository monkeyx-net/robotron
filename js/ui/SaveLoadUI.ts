import { saveLoadManager } from '../core/SaveLoadManager';
import { gameEvents } from '../core/EventSystem';

/**
 * UI component for save/load operations
 */
export class SaveLoadUI {
    private container: HTMLElement | null = null;
    private isVisible: boolean = false;
    
    constructor() {
        this.createUI();
        this.setupEventListeners();
    }
    
    /**
     * Create the save/load UI elements
     */
    private createUI(): void {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'save-load-ui';
        this.container.className = 'save-load-container hidden';
        
        this.container.innerHTML = `
            <div class="save-load-panel">
                <div class="panel-header">
                    <h2>Save / Load Game</h2>
                    <button class="close-btn" id="close-save-load">&times;</button>
                </div>
                
                <div class="panel-content">
                    <div class="save-section">
                        <h3>Save Game</h3>
                        <div class="save-info" id="save-info">
                            <p>No save data found</p>
                        </div>
                        <div class="save-actions">
                            <button id="save-game-btn" class="action-btn save-btn">Save Current Game</button>
                            <button id="quick-save-btn" class="action-btn">Quick Save (F5)</button>
                        </div>
                    </div>
                    
                    <div class="load-section">
                        <h3>Load Game</h3>
                        <div class="load-actions">
                            <button id="load-game-btn" class="action-btn load-btn" disabled>Load Saved Game</button>
                            <button id="quick-load-btn" class="action-btn" disabled>Quick Load (F9)</button>
                        </div>
                    </div>
                    
                    <div class="statistics-section">
                        <h3>Statistics</h3>
                        <div class="stats-grid" id="stats-grid">
                            <!-- Statistics will be populated here -->
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3>Settings</h3>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label class="setting-label">
                                    <input type="checkbox" id="screen-shake-toggle" class="setting-checkbox">
                                    <span class="setting-text">Screen Shake Effects</span>
                                </label>
                                <div class="setting-description">Enable screen shake for explosions and impacts</div>
                            </div>
                            <div class="setting-item">
                                <label class="setting-label">
                                    <input type="checkbox" id="particle-effects-toggle" class="setting-checkbox">
                                    <span class="setting-text">Particle Effects</span>
                                </label>
                                <div class="setting-description">Enable particle effects for explosions and visual feedback</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="advanced-section">
                        <h3>Advanced</h3>
                        <div class="advanced-actions">
                            <button id="export-save-btn" class="action-btn">Export Save Data</button>
                            <button id="import-save-btn" class="action-btn">Import Save Data</button>
                            <button id="clear-data-btn" class="action-btn danger-btn">Clear All Data</button>
                        </div>
                        <input type="file" id="import-file-input" accept=".json" style="display: none;">
                    </div>
                    
                    <div class="storage-info" id="storage-info">
                        <!-- Storage information will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add CSS styles
        this.addStyles();
        
        // Append to body
        document.body.appendChild(this.container);
        
        // Setup button event listeners
        this.setupButtonListeners();
    }
    
    /**
     * Add CSS styles for the save/load UI
     */
    private addStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .save-load-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                font-family: 'Courier New', monospace;
            }
            
            .save-load-container.hidden {
                display: none;
            }
            
            .save-load-panel {
                background: #1a1a1a;
                border: 2px solid #00ff00;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 80%;
                overflow-y: auto;
                color: #00ff00;
            }
            
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid #00ff00;
                background: #0a0a0a;
            }
            
            .panel-header h2 {
                margin: 0;
                color: #00ff00;
                font-size: 1.5em;
            }
            
            .close-btn {
                background: none;
                border: none;
                color: #00ff00;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .close-btn:hover {
                color: #ff0000;
            }
            
            .panel-content {
                padding: 20px;
            }
            
            .save-section, .load-section, .statistics-section, .settings-section, .advanced-section {
                margin-bottom: 25px;
                padding-bottom: 20px;
                border-bottom: 1px solid #333;
            }
            
            .save-section:last-child, .load-section:last-child, 
            .statistics-section:last-child, .settings-section:last-child, .advanced-section:last-child {
                border-bottom: none;
            }
            
            .settings-grid {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .setting-item {
                background: #0a0a0a;
                padding: 12px;
                border: 1px solid #333;
                border-radius: 4px;
            }
            
            .setting-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 0.9em;
                color: #00ff00;
            }
            
            .setting-checkbox {
                margin-right: 10px;
                width: 16px;
                height: 16px;
                accent-color: #00ff00;
            }
            
            .setting-text {
                font-weight: bold;
            }
            
            .setting-description {
                margin-top: 5px;
                font-size: 0.8em;
                color: #aaa;
                line-height: 1.3;
            }
            
            h3 {
                color: #00ff00;
                margin: 0 0 15px 0;
                font-size: 1.2em;
            }
            
            .save-info, .storage-info {
                background: #0a0a0a;
                padding: 10px;
                border: 1px solid #333;
                border-radius: 4px;
                margin-bottom: 15px;
                font-size: 0.9em;
            }
            
            .save-actions, .load-actions, .advanced-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .action-btn {
                background: #0a0a0a;
                border: 1px solid #00ff00;
                color: #00ff00;
                padding: 8px 16px;
                cursor: pointer;
                border-radius: 4px;
                font-family: inherit;
                font-size: 0.9em;
                transition: all 0.2s;
            }
            
            .action-btn:hover:not(:disabled) {
                background: #00ff00;
                color: #000;
            }
            
            .action-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                border-color: #666;
                color: #666;
            }
            
            .save-btn {
                border-color: #00aa00;
                color: #00aa00;
            }
            
            .save-btn:hover:not(:disabled) {
                background: #00aa00;
            }
            
            .load-btn {
                border-color: #0088ff;
                color: #0088ff;
            }
            
            .load-btn:hover:not(:disabled) {
                background: #0088ff;
            }
            
            .danger-btn {
                border-color: #ff4444;
                color: #ff4444;
            }
            
            .danger-btn:hover:not(:disabled) {
                background: #ff4444;
                color: #000;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
            }
            
            .stat-item {
                background: #0a0a0a;
                padding: 8px 12px;
                border: 1px solid #333;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
            }
            
            .stat-label {
                color: #aaa;
            }
            
            .stat-value {
                color: #00ff00;
                font-weight: bold;
            }
            
            .settings-section {
                margin-bottom: 25px;
                padding-bottom: 20px;
                border-bottom: 1px solid #333;
            }
            
            .settings-grid {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .setting-item {
                background: #0a0a0a;
                padding: 12px;
                border: 1px solid #333;
                border-radius: 4px;
            }
            
            .setting-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-size: 0.9em;
            }
            
            .setting-checkbox {
                margin-right: 10px;
                width: 16px;
                height: 16px;
                accent-color: #00ff00;
            }
            
            .setting-text {
                color: #00ff00;
                font-weight: bold;
            }
            
            .setting-description {
                margin-top: 5px;
                font-size: 0.8em;
                color: #aaa;
                line-height: 1.3;
            }
            
            @media (max-width: 600px) {
                .save-load-panel {
                    width: 95%;
                    margin: 10px;
                }
                
                .save-actions, .load-actions, .advanced-actions {
                    flex-direction: column;
                }
                
                .stats-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Listen for UI show/hide events
        gameEvents.on('ui:show_save_load', () => this.show());
        gameEvents.on('ui:hide_save_load', () => this.hide());
        
        // Listen for save/load completion events
        gameEvents.on('save:game_saved', () => this.updateSaveInfo());
        gameEvents.on('save:game_loaded', () => this.updateSaveInfo());
        
        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'F5' && !event.repeat) {
                event.preventDefault();
                saveLoadManager.quickSave();
            } else if (event.key === 'F9' && !event.repeat) {
                event.preventDefault();
                saveLoadManager.quickLoad();
            } else if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    /**
     * Setup button event listeners
     */
    private setupButtonListeners(): void {
        if (!this.container) return;
        
        // Close button
        const closeBtn = this.container.querySelector('#close-save-load');
        closeBtn?.addEventListener('click', () => this.hide());
        
        // Save buttons
        const saveBtn = this.container.querySelector('#save-game-btn');
        saveBtn?.addEventListener('click', () => {
            saveLoadManager.saveCurrentGame();
        });
        
        const quickSaveBtn = this.container.querySelector('#quick-save-btn');
        quickSaveBtn?.addEventListener('click', () => {
            saveLoadManager.quickSave();
        });
        
        // Load buttons
        const loadBtn = this.container.querySelector('#load-game-btn');
        loadBtn?.addEventListener('click', () => {
            if (confirm('Loading will replace your current progress. Continue?')) {
                saveLoadManager.loadSavedGame();
                this.hide();
            }
        });
        
        const quickLoadBtn = this.container.querySelector('#quick-load-btn');
        quickLoadBtn?.addEventListener('click', () => {
            if (confirm('Loading will replace your current progress. Continue?')) {
                saveLoadManager.quickLoad();
                this.hide();
            }
        });
        
        // Advanced buttons
        const exportBtn = this.container.querySelector('#export-save-btn');
        exportBtn?.addEventListener('click', () => this.exportSaveData());
        
        const importBtn = this.container.querySelector('#import-save-btn');
        importBtn?.addEventListener('click', () => this.importSaveData());
        
        const clearBtn = this.container.querySelector('#clear-data-btn');
        clearBtn?.addEventListener('click', () => this.clearAllData());
        
        // File input for import
        const fileInput = this.container.querySelector('#import-file-input') as HTMLInputElement;
        fileInput?.addEventListener('change', (event) => this.handleFileImport(event));
        
        // Settings checkboxes
        const screenShakeToggle = this.container.querySelector('#screen-shake-toggle') as HTMLInputElement;
        screenShakeToggle?.addEventListener('change', (event) => this.handleScreenShakeToggle(event));
        
        const particleEffectsToggle = this.container.querySelector('#particle-effects-toggle') as HTMLInputElement;
        particleEffectsToggle?.addEventListener('change', (event) => this.handleParticleEffectsToggle(event));
    }
    
    /**
     * Show the save/load UI
     */
    public show(): void {
        if (!this.container) return;
        
        this.container.classList.remove('hidden');
        this.isVisible = true;
        
        // Update all information
        this.updateSaveInfo();
        this.updateStatistics();
        this.updateStorageInfo();
        this.updateButtonStates();
        this.updateSettings();
    }
    
    /**
     * Hide the save/load UI
     */
    public hide(): void {
        if (!this.container) return;
        
        this.container.classList.add('hidden');
        this.isVisible = false;
    }
    
    /**
     * Update save information display
     */
    private updateSaveInfo(): void {
        const saveInfoElement = this.container?.querySelector('#save-info');
        if (!saveInfoElement) return;
        
        const saveInfo = saveLoadManager.getSaveInfo();
        
        if (saveInfo.exists) {
            saveInfoElement.innerHTML = `
                <p><strong>Save Data Found</strong></p>
                <p>Saved: ${saveInfo.age || 'Unknown time'}</p>
                <p>You can load this save to continue your previous game.</p>
            `;
        } else {
            saveInfoElement.innerHTML = `
                <p><strong>No Save Data</strong></p>
                <p>Start a new game and save your progress.</p>
            `;
        }
    }
    
    /**
     * Update statistics display
     */
    private updateStatistics(): void {
        const statsGrid = this.container?.querySelector('#stats-grid');
        if (!statsGrid) return;
        
        const stats = saveLoadManager.getStatistics();
        
        const statItems = [
            { label: 'Games Played', value: stats.totalGamesPlayed.toLocaleString() },
            { label: 'Total Score', value: stats.totalScore.toLocaleString() },
            { label: 'Average Score', value: Math.round(stats.averageScore).toLocaleString() },
            { label: 'Highest Wave', value: stats.highestWave.toString() },
            { label: 'Humans Rescued', value: stats.totalHumansRescued.toLocaleString() },
            { label: 'Enemies Destroyed', value: stats.totalEnemiesDestroyed.toLocaleString() },
            { label: 'Games Won', value: stats.gamesWon.toLocaleString() },
            { label: 'Play Time', value: this.formatPlayTime(stats.totalPlayTime) }
        ];
        
        statsGrid.innerHTML = statItems.map(item => `
            <div class="stat-item">
                <span class="stat-label">${item.label}:</span>
                <span class="stat-value">${item.value}</span>
            </div>
        `).join('');
    }
    
    /**
     * Update storage information
     */
    private updateStorageInfo(): void {
        const storageInfoElement = this.container?.querySelector('#storage-info');
        if (!storageInfoElement) return;
        
        const storageInfo = saveLoadManager.getStorageInfo();
        
        if (storageInfo.available) {
            const usedKB = Math.round(storageInfo.used / 1024);
            const quotaKB = storageInfo.quota ? Math.round(storageInfo.quota / 1024) : 'Unknown';
            
            storageInfoElement.innerHTML = `
                <p><strong>Storage Usage:</strong> ${usedKB} KB used</p>
                <p><strong>Available Space:</strong> ${quotaKB} KB total</p>
            `;
        } else {
            storageInfoElement.innerHTML = `
                <p><strong>Storage:</strong> Not available</p>
                <p>Save/load functionality may be limited.</p>
            `;
        }
    }
    
    /**
     * Update button states based on save data availability
     */
    private updateButtonStates(): void {
        const hasSaveData = saveLoadManager.hasSaveData();
        
        const loadBtn = this.container?.querySelector('#load-game-btn') as HTMLButtonElement;
        const quickLoadBtn = this.container?.querySelector('#quick-load-btn') as HTMLButtonElement;
        
        if (loadBtn) loadBtn.disabled = !hasSaveData;
        if (quickLoadBtn) quickLoadBtn.disabled = !hasSaveData;
    }
    
    /**
     * Export save data to file
     */
    private exportSaveData(): void {
        const saveData = saveLoadManager.exportSaveData();
        if (!saveData) {
            alert('No save data to export');
            return;
        }
        
        const blob = new Blob([saveData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `robotron_save_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * Import save data from file
     */
    private importSaveData(): void {
        const fileInput = this.container?.querySelector('#import-file-input') as HTMLInputElement;
        fileInput?.click();
    }
    
    /**
     * Handle file import
     */
    private handleFileImport(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                const success = saveLoadManager.importSaveData(content);
                if (success) {
                    this.updateSaveInfo();
                    this.updateButtonStates();
                }
            }
        };
        
        reader.readAsText(file);
        input.value = ''; // Reset input
    }
    
    /**
     * Clear all save data with confirmation
     */
    private clearAllData(): void {
        const confirmed = confirm(
            'This will permanently delete all save data, settings, and statistics. ' +
            'This action cannot be undone. Are you sure?'
        );
        
        if (confirmed) {
            const success = saveLoadManager.clearAllData();
            if (success) {
                this.updateSaveInfo();
                this.updateStatistics();
                this.updateStorageInfo();
                this.updateButtonStates();
            }
        }
    }
    
    /**
     * Handle screen shake toggle
     */
    private handleScreenShakeToggle(event: Event): void {
        const checkbox = event.target as HTMLInputElement;
        const enabled = checkbox.checked;
        
        // Save the setting
        saveLoadManager.saveSettings({ screenShakeEnabled: enabled });
        
        // Show feedback message
        gameEvents.emit({
            type: 'ui:show_message',
            timestamp: Date.now(),
            source: 'SaveLoadUI',
            data: {
                message: `Screen Shake ${enabled ? 'Enabled' : 'Disabled'}`,
                type: 'info',
                duration: 2000
            }
        });
        
        console.log(`Screen shake effects ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Handle particle effects toggle
     */
    private handleParticleEffectsToggle(event: Event): void {
        const checkbox = event.target as HTMLInputElement;
        const enabled = checkbox.checked;
        
        // Save the setting
        saveLoadManager.saveSettings({ particleEffectsEnabled: enabled });
        
        // Show feedback message
        gameEvents.emit({
            type: 'ui:show_message',
            timestamp: Date.now(),
            source: 'SaveLoadUI',
            data: {
                message: `Particle Effects ${enabled ? 'Enabled' : 'Disabled'}`,
                type: 'info',
                duration: 2000
            }
        });
        
        console.log(`Particle effects ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Update settings display
     */
    private updateSettings(): void {
        const settings = saveLoadManager.loadSettings();
        
        const screenShakeToggle = this.container?.querySelector('#screen-shake-toggle') as HTMLInputElement;
        const particleEffectsToggle = this.container?.querySelector('#particle-effects-toggle') as HTMLInputElement;
        
        if (screenShakeToggle) {
            screenShakeToggle.checked = settings.screenShakeEnabled;
        }
        
        if (particleEffectsToggle) {
            particleEffectsToggle.checked = settings.particleEffectsEnabled;
        }
    }
    
    /**
     * Format play time in a readable format
     */
    private formatPlayTime(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// Export singleton instance
export const saveLoadUI = new SaveLoadUI();