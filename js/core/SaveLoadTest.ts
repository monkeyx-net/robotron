import { saveLoadManager } from './SaveLoadManager';
import { gameState } from '../gameState';
import { gameEvents } from './EventSystem';

/**
 * Manual test suite for save/load functionality
 * This can be run in the browser console to verify the save/load system works
 */
export class SaveLoadTest {
    private static testResults: { [key: string]: boolean } = {};
    
    /**
     * Run all save/load tests
     */
    public static async runAllTests(): Promise<void> {
        console.log('🧪 Starting Save/Load System Tests...');
        
        // Clear any existing data first
        saveLoadManager.clearAllData();
        
        try {
            await this.testBasicSaveLoad();
            await this.testSettingsManagement();
            await this.testStatisticsTracking();
            await this.testDataValidation();
            await this.testStorageInfo();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }
    
    /**
     * Test basic save and load functionality
     */
    private static async testBasicSaveLoad(): Promise<void> {
        console.log('📝 Testing basic save/load...');
        
        // Set up test game state
        gameState.score = 12500;
        gameState.lives = 3;
        gameState.wave = 5;
        gameState.highScore = 50000;
        gameState.currentGameState = 'PLAYING';
        
        // Test save
        const saveResult = saveLoadManager.saveCurrentGame();
        this.testResults['basic_save'] = saveResult;
        console.log(saveResult ? '✅ Save successful' : '❌ Save failed');
        
        // Modify state
        const originalScore = gameState.score;
        gameState.score = 0;
        gameState.lives = 0;
        gameState.wave = 0;
        
        // Test load
        const loadResult = saveLoadManager.loadSavedGame();
        this.testResults['basic_load'] = loadResult && gameState.score === originalScore;
        console.log(loadResult && gameState.score === originalScore ? '✅ Load successful' : '❌ Load failed');
        
        // Test save data existence
        const hasSaveData = saveLoadManager.hasSaveData();
        this.testResults['save_data_exists'] = hasSaveData;
        console.log(hasSaveData ? '✅ Save data exists' : '❌ Save data missing');
    }
    
    /**
     * Test settings management
     */
    private static async testSettingsManagement(): Promise<void> {
        console.log('⚙️ Testing settings management...');
        
        // Test save settings
        const testSettings = {
            soundEnabled: false,
            musicVolume: 0.3,
            difficulty: 'hard' as const,
            screenShakeEnabled: false
        };
        
        const saveResult = saveLoadManager.saveSettings(testSettings);
        this.testResults['settings_save'] = saveResult;
        console.log(saveResult ? '✅ Settings save successful' : '❌ Settings save failed');
        
        // Test load settings
        const loadedSettings = saveLoadManager.loadSettings();
        const settingsMatch = 
            loadedSettings.soundEnabled === false &&
            loadedSettings.musicVolume === 0.3 &&
            loadedSettings.difficulty === 'hard' &&
            loadedSettings.screenShakeEnabled === false;
        
        this.testResults['settings_load'] = settingsMatch;
        console.log(settingsMatch ? '✅ Settings load successful' : '❌ Settings load failed');
        
        // Test default settings
        saveLoadManager.clearAllData();
        const defaultSettings = saveLoadManager.loadSettings();
        const hasDefaults = 
            defaultSettings.soundEnabled === true &&
            defaultSettings.difficulty === 'normal';
        
        this.testResults['settings_defaults'] = hasDefaults;
        console.log(hasDefaults ? '✅ Default settings correct' : '❌ Default settings incorrect');
    }
    
    /**
     * Test statistics tracking
     */
    private static async testStatisticsTracking(): Promise<void> {
        console.log('📊 Testing statistics tracking...');
        
        // Simulate game events
        gameEvents.emit({
            type: 'game:started',
            timestamp: Date.now(),
            source: 'test',
            data: {}
        });
        
        gameEvents.emit({
            type: 'human:rescued',
            timestamp: Date.now(),
            source: 'test',
            data: {}
        });
        
        gameEvents.emit({
            type: 'enemy:destroyed',
            timestamp: Date.now(),
            source: 'test',
            data: {}
        });
        
        gameEvents.emit({
            type: 'game:over',
            timestamp: Date.now(),
            source: 'test',
            data: {}
        });
        
        // Wait a bit for events to process
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check statistics
        const stats = saveLoadManager.getStatistics();
        const statsValid = 
            stats.totalGamesPlayed >= 1 &&
            stats.totalHumansRescued >= 1 &&
            stats.totalEnemiesDestroyed >= 1;
        
        this.testResults['statistics_tracking'] = statsValid;
        console.log(statsValid ? '✅ Statistics tracking works' : '❌ Statistics tracking failed');
    }
    
    /**
     * Test data validation and error handling
     */
    private static async testDataValidation(): Promise<void> {
        console.log('🔍 Testing data validation...');
        
        // Test export/import
        const exportData = saveLoadManager.exportSaveData();
        const hasExportData = exportData !== null && exportData.length > 0;
        this.testResults['export_data'] = hasExportData;
        console.log(hasExportData ? '✅ Export data works' : '❌ Export data failed');
        
        if (exportData) {
            // Clear data and import
            saveLoadManager.clearAllData();
            const importResult = saveLoadManager.importSaveData(exportData);
            this.testResults['import_data'] = importResult;
            console.log(importResult ? '✅ Import data works' : '❌ Import data failed');
        }
        
        // Test invalid import data
        const invalidImportResult = saveLoadManager.importSaveData('{"invalid": "data"}');
        this.testResults['invalid_import_rejected'] = !invalidImportResult;
        console.log(!invalidImportResult ? '✅ Invalid import rejected' : '❌ Invalid import accepted');
    }
    
    /**
     * Test storage information
     */
    private static async testStorageInfo(): Promise<void> {
        console.log('💾 Testing storage information...');
        
        const storageInfo = saveLoadManager.getStorageInfo();
        const hasStorageInfo = 
            typeof storageInfo.used === 'number' &&
            typeof storageInfo.available === 'boolean';
        
        this.testResults['storage_info'] = hasStorageInfo;
        console.log(hasStorageInfo ? '✅ Storage info available' : '❌ Storage info failed');
        
        // Test save info
        const saveInfo = saveLoadManager.getSaveInfo();
        const hasSaveInfo = typeof saveInfo.exists === 'boolean';
        
        this.testResults['save_info'] = hasSaveInfo;
        console.log(hasSaveInfo ? '✅ Save info available' : '❌ Save info failed');
    }
    
    /**
     * Print test results summary
     */
    private static printResults(): void {
        console.log('\n📋 Test Results Summary:');
        console.log('========================');
        
        let passed = 0;
        let total = 0;
        
        for (const [testName, result] of Object.entries(this.testResults)) {
            total++;
            if (result) {
                passed++;
                console.log(`✅ ${testName}: PASSED`);
            } else {
                console.log(`❌ ${testName}: FAILED`);
            }
        }
        
        console.log(`\n🎯 Overall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
        
        if (passed === total) {
            console.log('🎉 All tests passed! Save/Load system is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Check the implementation.');
        }
    }
    
    /**
     * Test quick save/load functionality
     */
    public static testQuickSaveLoad(): void {
        console.log('⚡ Testing quick save/load...');
        
        // Set up test state
        gameState.score = 99999;
        gameState.wave = 10;
        gameState.currentGameState = 'PLAYING';
        
        // Quick save
        const quickSaveResult = saveLoadManager.quickSave();
        console.log(quickSaveResult ? '✅ Quick save successful' : '❌ Quick save failed');
        
        // Modify state
        gameState.score = 0;
        gameState.wave = 1;
        
        // Quick load
        const quickLoadResult = saveLoadManager.quickLoad();
        console.log(quickLoadResult ? '✅ Quick load successful' : '❌ Quick load failed');
        
        // Verify state restored
        const stateRestored = gameState.score === 99999 && gameState.wave === 10;
        console.log(stateRestored ? '✅ State restored correctly' : '❌ State not restored');
    }
    
    /**
     * Demonstrate save/load UI
     */
    public static showSaveLoadUI(): void {
        console.log('🖥️ Showing save/load UI...');
        gameEvents.emit({
            type: 'ui:show_save_load',
            timestamp: Date.now(),
            source: 'test',
            data: {}
        });
    }
}

// Make test functions available globally for manual testing
(window as any).SaveLoadTest = SaveLoadTest;

// Auto-run tests if in development mode
if (process.env.NODE_ENV === 'development') {
    // Wait for game to initialize before running tests
    setTimeout(() => {
        console.log('🔧 Development mode detected - Save/Load tests available');
        console.log('Run SaveLoadTest.runAllTests() to test the save/load system');
        console.log('Run SaveLoadTest.testQuickSaveLoad() to test quick save/load');
        console.log('Run SaveLoadTest.showSaveLoadUI() to show the save/load UI');
    }, 2000);
}