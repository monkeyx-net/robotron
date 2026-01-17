/**
 * DifficultyManager Test Suite
 *
 * Manual tests for the difficulty manager system
 * Run these tests in the browser console using window.difficultyTests
 */

import { difficultyManager, DifficultyLevel } from './DifficultyManager';
import { gameEvents } from './EventSystem';

export class DifficultyManagerTests {
    private testResults: { name: string; passed: boolean; message: string }[] = [];

    /**
     * Run all tests
     */
    runAllTests(): boolean {
        console.log('=== Running DifficultyManager Tests ===\n');

        this.testResults = [];

        this.testInitialization();
        this.testDifficultyLevelChanges();
        this.testWaveScaling();
        this.testPerformanceTracking();
        this.testAdaptiveDifficulty();
        this.testMultiplierCalculations();
        this.testReset();

        const passedTests = this.testResults.filter(r => r.passed).length;
        const totalTests = this.testResults.length;

        console.log('\n=== Test Results ===');
        this.testResults.forEach(result => {
            const icon = result.passed ? '✅' : '❌';
            console.log(`${icon} ${result.name}: ${result.message}`);
        });

        console.log(`\n${passedTests}/${totalTests} tests passed`);

        return passedTests === totalTests;
    }

    /**
     * Test 1: Initialization
     */
    private testInitialization(): void {
        const testName = 'Initialization';
        try {
            const level = difficultyManager.getCurrentLevel();
            const multipliers = difficultyManager.getCurrentMultipliers();

            if (level === DifficultyLevel.NORMAL &&
                multipliers.enemySpawnRateMultiplier === 1.0 &&
                multipliers.scoreMultiplier === 1.0) {
                this.addResult(testName, true, 'DifficultyManager initialized with normal difficulty');
            } else {
                this.addResult(testName, false, 'Unexpected initial values');
            }
        } catch (error) {
            this.addResult(testName, false, `Error: ${error}`);
        }
    }

    /**
     * Test 2: Difficulty level changes
     */
    private testDifficultyLevelChanges(): void {
        const testName = 'Difficulty Level Changes';
        try {
            // Test easy difficulty
            difficultyManager.setDifficultyLevel(DifficultyLevel.EASY);
            const easyMultipliers = difficultyManager.getCurrentMultipliers();

            if (easyMultipliers.enemySpawnRateMultiplier < 1.0 &&
                easyMultipliers.enemySpeedMultiplier < 1.0) {
                // Test hard difficulty
                difficultyManager.setDifficultyLevel(DifficultyLevel.HARD);
                const hardMultipliers = difficultyManager.getCurrentMultipliers();

                if (hardMultipliers.enemySpawnRateMultiplier > 1.0 &&
                    hardMultipliers.scoreMultiplier > 1.0) {
                    this.addResult(testName, true, 'Difficulty levels change multipliers correctly');
                } else {
                    this.addResult(testName, false, 'Hard difficulty multipliers incorrect');
                }
            } else {
                this.addResult(testName, false, 'Easy difficulty multipliers incorrect');
            }

            // Reset to normal
            difficultyManager.setDifficultyLevel(DifficultyLevel.NORMAL);
        } catch (error) {
            this.addResult(testName, false, `Error: ${error}`);
        }
    }

    /**
     * Test 3: Wave scaling
     */
    private testWaveScaling(): void {
        const testName = 'Wave Scaling';
        try {
            difficultyManager.reset();

            // Get wave 1 multipliers
            gameEvents.emit({
                type: 'wave:started',
                timestamp: Date.now(),
                source: 'test',
                data: { wave: 1 }
            });
            const wave1Multipliers = difficultyManager.getCurrentMultipliers();

            // Get wave 10 multipliers
            gameEvents.emit({
                type: 'wave:started',
                timestamp: Date.now(),
                source: 'test',
                data: { wave: 10 }
            });
            const wave10Multipliers = difficultyManager.getCurrentMultipliers();

            if (wave10Multipliers.enemySpawnRateMultiplier > wave1Multipliers.enemySpawnRateMultiplier) {
                this.addResult(testName, true, `Wave scaling works (Wave 1: ${wave1Multipliers.enemySpawnRateMultiplier.toFixed(2)}, Wave 10: ${wave10Multipliers.enemySpawnRateMultiplier.toFixed(2)})`);
            } else {
                this.addResult(testName, false, 'Wave scaling did not increase difficulty');
            }

            difficultyManager.reset();
        } catch (error) {
            this.addResult(testName, false, `Error: ${error}`);
        }
    }

    /**
     * Test 4: Performance tracking
     */
    private testPerformanceTracking(): void {
        const testName = 'Performance Tracking';
        try {
            difficultyManager.reset();

            // Simulate some kills
            for (let i = 0; i < 10; i++) {
                gameEvents.emit({
                    type: 'enemy:destroyed',
                    timestamp: Date.now(),
                    source: 'test',
                    data: { enemyType: 'grunt' }
                });
            }

            // Simulate human rescues
            for (let i = 0; i < 3; i++) {
                gameEvents.emit({
                    type: 'human:rescued',
                    timestamp: Date.now(),
                    source: 'test',
                    data: { humanId: i }
                });
            }

            const metrics = difficultyManager.getPerformanceMetrics();

            if (metrics.totalEnemiesKilled === 10 && metrics.humansRescued === 3) {
                this.addResult(testName, true, 'Performance metrics tracked correctly');
            } else {
                this.addResult(testName, false, `Metrics incorrect: kills=${metrics.totalEnemiesKilled}, rescues=${metrics.humansRescued}`);
            }

            difficultyManager.reset();
        } catch (error) {
            this.addResult(testName, false, `Error: ${error}`);
        }
    }

    /**
     * Test 5: Adaptive difficulty
     */
    private testAdaptiveDifficulty(): void {
        const testName = 'Adaptive Difficulty';
        try {
            difficultyManager.reset();
            difficultyManager.setDifficultyLevel(DifficultyLevel.ADAPTIVE);

            // Simulate poor performance (many deaths, few kills)
            for (let i = 0; i < 5; i++) {
                gameEvents.emit({
                    type: 'player:died',
                    timestamp: Date.now(),
                    source: 'test',
                    data: { lives: 2 }
                });
            }

            for (let i = 0; i < 2; i++) {
                gameEvents.emit({
                    type: 'enemy:destroyed',
                    timestamp: Date.now(),
                    source: 'test',
                    data: { enemyType: 'grunt' }
                });
            }

            // Start wave to trigger adaptive adjustment
            gameEvents.emit({
                type: 'wave:started',
                timestamp: Date.now(),
                source: 'test',
                data: { wave: 2 }
            });

            const performanceScore = difficultyManager.getPerformanceScore();

            if (performanceScore < 0.5) {
                this.addResult(testName, true, `Adaptive difficulty recognizes poor performance (score: ${performanceScore.toFixed(2)})`);
            } else {
                this.addResult(testName, false, `Performance score too high: ${performanceScore.toFixed(2)}`);
            }

            difficultyManager.reset();
            difficultyManager.setDifficultyLevel(DifficultyLevel.NORMAL);
        } catch (error) {
            this.addResult(testName, false, `Error: ${error}`);
        }
    }

    /**
     * Test 6: Multiplier calculations
     */
    private testMultiplierCalculations(): void {
        const testName = 'Multiplier Calculations';
        try {
            difficultyManager.reset();
            difficultyManager.setDifficultyLevel(DifficultyLevel.NIGHTMARE);

            const multipliers = difficultyManager.getCurrentMultipliers();

            if (multipliers.enemySpawnRateMultiplier > 1.5 &&
                multipliers.scoreMultiplier >= 2.0) {
                this.addResult(testName, true, `Nightmare multipliers correct (spawn: ${multipliers.enemySpawnRateMultiplier.toFixed(2)}, score: ${multipliers.scoreMultiplier.toFixed(2)})`);
            } else {
                this.addResult(testName, false, 'Nightmare difficulty multipliers too low');
            }

            difficultyManager.setDifficultyLevel(DifficultyLevel.NORMAL);
        } catch (error) {
            this.addResult(testName, false, `Error: ${error}`);
        }
    }

    /**
     * Test 7: Reset functionality
     */
    private testReset(): void {
        const testName = 'Reset Functionality';
        try {
            // Mess up the state
            difficultyManager.setDifficultyLevel(DifficultyLevel.HARD);
            gameEvents.emit({
                type: 'wave:started',
                timestamp: Date.now(),
                source: 'test',
                data: { wave: 20 }
            });

            for (let i = 0; i < 50; i++) {
                gameEvents.emit({
                    type: 'enemy:destroyed',
                    timestamp: Date.now(),
                    source: 'test',
                    data: { enemyType: 'grunt' }
                });
            }

            // Reset
            difficultyManager.reset();

            const metrics = difficultyManager.getPerformanceMetrics();
            const multipliers = difficultyManager.getCurrentMultipliers();

            if (metrics.totalEnemiesKilled === 0 &&
                metrics.wavesSurvived === 0) {
                this.addResult(testName, true, 'Reset clears metrics and resets difficulty');
            } else {
                this.addResult(testName, false, `Metrics not cleared: kills=${metrics.totalEnemiesKilled}, waves=${metrics.wavesSurvived}`);
            }

            difficultyManager.setDifficultyLevel(DifficultyLevel.NORMAL);
        } catch (error) {
            this.addResult(testName, false, `Error: ${error}`);
        }
    }

    /**
     * Add test result
     */
    private addResult(name: string, passed: boolean, message: string): void {
        this.testResults.push({ name, passed, message });
    }

    /**
     * Get test results
     */
    getResults(): { name: string; passed: boolean; message: string }[] {
        return this.testResults;
    }
}

// Create test instance
export const difficultyTests = new DifficultyManagerTests();

// Make tests available globally for manual testing
if (typeof window !== 'undefined') {
    (window as any).difficultyTests = {
        runAll: () => difficultyTests.runAllTests(),
        getResults: () => difficultyTests.getResults()
    };

    console.log('DifficultyManager tests available at window.difficultyTests.runAll()');
}
