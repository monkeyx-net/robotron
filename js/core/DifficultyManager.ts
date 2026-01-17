/**
 * DifficultyManager - Progressive difficulty scaling system
 *
 * This module provides dynamic difficulty adjustment based on player performance,
 * wave progression, and configurable difficulty curves.
 */

import { gameEvents } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Difficulty level enum
 */
export enum DifficultyLevel {
    EASY = 'easy',
    NORMAL = 'normal',
    HARD = 'hard',
    NIGHTMARE = 'nightmare',
    ADAPTIVE = 'adaptive' // Adjusts based on player performance
}

/**
 * Difficulty curve configuration
 */
export interface DifficultyCurve {
    enemySpawnRateMultiplier: number;  // Multiplier for enemy spawn rate
    enemySpeedMultiplier: number;      // Multiplier for enemy movement speed
    enemyHealthMultiplier: number;     // Multiplier for enemy health
    projectileSpeedMultiplier: number; // Multiplier for projectile speed
    scoreMultiplier: number;           // Multiplier for score rewards
    waveBonusMultiplier: number;       // Multiplier for wave completion bonuses
}

/**
 * Performance metrics for adaptive difficulty
 */
interface PerformanceMetrics {
    wavesSurvived: number;
    averageSurvivalTime: number;      // Average time survived per wave (ms)
    killDeathRatio: number;            // Enemies killed / player deaths
    averageAccuracy: number;           // Hits / shots fired (0-1)
    humansRescued: number;
    totalEnemiesKilled: number;
    totalDeaths: number;
    totalShots: number;
    totalHits: number;
    recentWavePerformance: number[];   // Last 5 waves' performance scores (0-1)
}

/**
 * Difficulty state
 */
interface DifficultyState {
    level: DifficultyLevel;
    wave: number;
    currentMultipliers: DifficultyCurve;
    performanceMetrics: PerformanceMetrics;
    adaptiveAdjustmentEnabled: boolean;
}

/**
 * DifficultyManager singleton class
 */
export class DifficultyManager {
    private static instance: DifficultyManager;

    private state: DifficultyState;
    private baseDifficulty: Map<DifficultyLevel, DifficultyCurve>;
    private waveScalingFactor: number = 0.05; // 5% increase per wave
    private maxWaveScaling: number = 3.0; // Max 300% scaling
    private lastWaveTime: number = 0;
    private waveStartTime: number = 0;

    private constructor() {
        this.state = {
            level: DifficultyLevel.NORMAL,
            wave: 1,
            currentMultipliers: this.getDefaultMultipliers(),
            performanceMetrics: this.initializeMetrics(),
            adaptiveAdjustmentEnabled: false
        };

        this.baseDifficulty = this.initializeBaseDifficulty();
        this.setupEventListeners();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): DifficultyManager {
        if (!DifficultyManager.instance) {
            DifficultyManager.instance = new DifficultyManager();
        }
        return DifficultyManager.instance;
    }

    /**
     * Initialize base difficulty curves for each level
     */
    private initializeBaseDifficulty(): Map<DifficultyLevel, DifficultyCurve> {
        const difficulties = new Map<DifficultyLevel, DifficultyCurve>();

        difficulties.set(DifficultyLevel.EASY, {
            enemySpawnRateMultiplier: 0.7,
            enemySpeedMultiplier: 0.8,
            enemyHealthMultiplier: 0.8,
            projectileSpeedMultiplier: 0.9,
            scoreMultiplier: 0.8,
            waveBonusMultiplier: 1.0
        });

        difficulties.set(DifficultyLevel.NORMAL, {
            enemySpawnRateMultiplier: 1.0,
            enemySpeedMultiplier: 1.0,
            enemyHealthMultiplier: 1.0,
            projectileSpeedMultiplier: 1.0,
            scoreMultiplier: 1.0,
            waveBonusMultiplier: 1.0
        });

        difficulties.set(DifficultyLevel.HARD, {
            enemySpawnRateMultiplier: 1.3,
            enemySpeedMultiplier: 1.2,
            enemyHealthMultiplier: 1.2,
            projectileSpeedMultiplier: 1.1,
            scoreMultiplier: 1.5,
            waveBonusMultiplier: 1.5
        });

        difficulties.set(DifficultyLevel.NIGHTMARE, {
            enemySpawnRateMultiplier: 1.7,
            enemySpeedMultiplier: 1.5,
            enemyHealthMultiplier: 1.5,
            projectileSpeedMultiplier: 1.3,
            scoreMultiplier: 2.0,
            waveBonusMultiplier: 2.0
        });

        difficulties.set(DifficultyLevel.ADAPTIVE, {
            enemySpawnRateMultiplier: 1.0,
            enemySpeedMultiplier: 1.0,
            enemyHealthMultiplier: 1.0,
            projectileSpeedMultiplier: 1.0,
            scoreMultiplier: 1.2,
            waveBonusMultiplier: 1.2
        });

        return difficulties;
    }

    /**
     * Initialize performance metrics
     */
    private initializeMetrics(): PerformanceMetrics {
        return {
            wavesSurvived: 0,
            averageSurvivalTime: 0,
            killDeathRatio: 0,
            averageAccuracy: 0,
            humansRescued: 0,
            totalEnemiesKilled: 0,
            totalDeaths: 0,
            totalShots: 0,
            totalHits: 0,
            recentWavePerformance: []
        };
    }

    /**
     * Get default multipliers (normal difficulty)
     */
    private getDefaultMultipliers(): DifficultyCurve {
        return {
            enemySpawnRateMultiplier: 1.0,
            enemySpeedMultiplier: 1.0,
            enemyHealthMultiplier: 1.0,
            projectileSpeedMultiplier: 1.0,
            scoreMultiplier: 1.0,
            waveBonusMultiplier: 1.0
        };
    }

    /**
     * Set up event listeners for game events
     */
    private setupEventListeners(): void {
        // Listen for wave start
        gameEvents.on('wave:started', (event) => {
            this.onWaveStart(event.data.wave);
        });

        // Listen for wave complete
        gameEvents.on('wave:completed', (event) => {
            this.onWaveComplete(event.data);
        });

        // Listen for enemy killed
        gameEvents.on('enemy:destroyed', (event) => {
            this.onEnemyKilled(event.data);
        });

        // Listen for player death
        gameEvents.on('player:died', (event) => {
            this.onPlayerDeath(event.data);
        });

        // Listen for human rescued
        gameEvents.on('human:rescued', (event) => {
            this.onHumanRescued(event.data);
        });

        // Listen for projectile fired
        gameEvents.on('player:shoot', (event) => {
            this.onProjectileFired();
        });

        // Listen for projectile hit
        gameEvents.on('projectile:hit', (event) => {
            this.onProjectileHit();
        });
    }

    /**
     * Set difficulty level
     */
    setDifficultyLevel(level: DifficultyLevel): void {
        this.state.level = level;
        this.state.adaptiveAdjustmentEnabled = (level === DifficultyLevel.ADAPTIVE);
        this.updateDifficultyMultipliers();

        gameEvents.emit({
            type: 'difficulty:changed',
            timestamp: Date.now(),
            source: 'DifficultyManager',
            data: {
                level: level,
                multipliers: this.state.currentMultipliers
            }
        });
    }

    /**
     * Update difficulty multipliers based on current wave and level
     */
    private updateDifficultyMultipliers(): void {
        const baseMultipliers = this.baseDifficulty.get(this.state.level) || this.getDefaultMultipliers();
        const waveScaling = this.calculateWaveScaling();

        // Apply wave scaling to base difficulty
        this.state.currentMultipliers = {
            enemySpawnRateMultiplier: baseMultipliers.enemySpawnRateMultiplier * waveScaling,
            enemySpeedMultiplier: baseMultipliers.enemySpeedMultiplier * (1 + (waveScaling - 1) * 0.5), // Slower scaling for speed
            enemyHealthMultiplier: baseMultipliers.enemyHealthMultiplier * (1 + (waveScaling - 1) * 0.7), // Moderate scaling for health
            projectileSpeedMultiplier: baseMultipliers.projectileSpeedMultiplier * (1 + (waveScaling - 1) * 0.3),
            scoreMultiplier: baseMultipliers.scoreMultiplier,
            waveBonusMultiplier: baseMultipliers.waveBonusMultiplier * waveScaling
        };

        // Apply adaptive adjustments if enabled
        if (this.state.adaptiveAdjustmentEnabled) {
            this.applyAdaptiveAdjustments();
        }
    }

    /**
     * Calculate wave-based scaling factor
     */
    private calculateWaveScaling(): number {
        const scaling = 1 + (this.state.wave - 1) * this.waveScalingFactor;
        return Math.min(scaling, this.maxWaveScaling);
    }

    /**
     * Apply adaptive difficulty adjustments based on performance
     */
    private applyAdaptiveAdjustments(): void {
        const performance = this.calculateOverallPerformance();

        // Adjust difficulty based on performance
        // Performance < 0.3 = struggling, reduce difficulty
        // Performance 0.3-0.7 = average, maintain difficulty
        // Performance > 0.7 = excelling, increase difficulty

        let adjustmentFactor = 1.0;

        if (performance < 0.3) {
            // Player is struggling, reduce difficulty by up to 20%
            adjustmentFactor = 0.8 + (performance * 0.67); // 0.8 to 1.0
        } else if (performance > 0.7) {
            // Player is excelling, increase difficulty by up to 30%
            adjustmentFactor = 1.0 + ((performance - 0.7) * 1.0); // 1.0 to 1.3
        }

        // Apply adjustment to current multipliers
        this.state.currentMultipliers.enemySpawnRateMultiplier *= adjustmentFactor;
        this.state.currentMultipliers.enemySpeedMultiplier *= Math.sqrt(adjustmentFactor); // Gentler scaling
        this.state.currentMultipliers.enemyHealthMultiplier *= Math.sqrt(adjustmentFactor);
    }

    /**
     * Calculate overall performance score (0-1)
     */
    private calculateOverallPerformance(): number {
        const metrics = this.state.performanceMetrics;

        // No data yet, return neutral performance
        if (metrics.wavesSurvived === 0) return 0.5;

        // Calculate individual performance factors
        const survivalFactor = Math.min(metrics.wavesSurvived / 10, 1.0); // Normalize to waves 1-10
        const kdRatio = Math.min(metrics.killDeathRatio / 20, 1.0); // Normalize to 0-20 KD ratio
        const accuracyFactor = metrics.averageAccuracy;
        const rescueFactor = Math.min(metrics.humansRescued / (metrics.wavesSurvived * 5), 1.0); // 5 humans per wave target

        // Recent wave performance (last 5 waves)
        const recentPerformance = metrics.recentWavePerformance.length > 0
            ? metrics.recentWavePerformance.reduce((a, b) => a + b, 0) / metrics.recentWavePerformance.length
            : 0.5;

        // Weighted average of performance factors
        const overallPerformance = (
            survivalFactor * 0.2 +
            kdRatio * 0.3 +
            accuracyFactor * 0.2 +
            rescueFactor * 0.1 +
            recentPerformance * 0.2
        );

        return Math.max(0, Math.min(1, overallPerformance));
    }

    /**
     * Handle wave start event
     */
    private onWaveStart(wave: number): void {
        this.state.wave = wave;
        this.waveStartTime = Date.now();
        this.updateDifficultyMultipliers();

        gameEvents.emit({
            type: 'difficulty:wave_updated',
            timestamp: Date.now(),
            source: 'DifficultyManager',
            data: {
                wave: wave,
                multipliers: this.state.currentMultipliers,
                performance: this.calculateOverallPerformance()
            }
        });
    }

    /**
     * Handle wave complete event
     */
    private onWaveComplete(data: any): void {
        this.state.performanceMetrics.wavesSurvived++;

        // Calculate wave survival time
        const survivalTime = Date.now() - this.waveStartTime;
        const avgTime = this.state.performanceMetrics.averageSurvivalTime;
        const wavesCount = this.state.performanceMetrics.wavesSurvived;
        this.state.performanceMetrics.averageSurvivalTime =
            (avgTime * (wavesCount - 1) + survivalTime) / wavesCount;

        // Calculate wave performance score
        const wavePerformance = this.calculateWavePerformance(data);
        this.state.performanceMetrics.recentWavePerformance.push(wavePerformance);

        // Keep only last 5 wave performances
        if (this.state.performanceMetrics.recentWavePerformance.length > 5) {
            this.state.performanceMetrics.recentWavePerformance.shift();
        }

        this.lastWaveTime = Date.now();
    }

    /**
     * Calculate performance score for a single wave
     */
    private calculateWavePerformance(waveData: any): number {
        // Factors: enemies killed, humans rescued, time survived, deaths
        const enemiesKilled = waveData.enemiesKilled || 0;
        const humansRescued = waveData.humansRescued || 0;
        const deaths = waveData.deaths || 0;
        const totalEnemies = waveData.totalEnemies || 1;

        const killRate = enemiesKilled / totalEnemies;
        const rescueRate = humansRescued / Math.max(waveData.totalHumans || 1, 1);
        const survivalBonus = deaths === 0 ? 0.3 : -0.2 * deaths;

        return Math.max(0, Math.min(1, killRate * 0.4 + rescueRate * 0.3 + survivalBonus + 0.3));
    }

    /**
     * Handle enemy killed event
     */
    private onEnemyKilled(data: any): void {
        this.state.performanceMetrics.totalEnemiesKilled++;
        this.updateKDRatio();
    }

    /**
     * Handle player death event
     */
    private onPlayerDeath(data: any): void {
        this.state.performanceMetrics.totalDeaths++;
        this.updateKDRatio();
    }

    /**
     * Handle human rescued event
     */
    private onHumanRescued(data: any): void {
        this.state.performanceMetrics.humansRescued++;
    }

    /**
     * Handle projectile fired event
     */
    private onProjectileFired(): void {
        this.state.performanceMetrics.totalShots++;
        this.updateAccuracy();
    }

    /**
     * Handle projectile hit event
     */
    private onProjectileHit(): void {
        this.state.performanceMetrics.totalHits++;
        this.updateAccuracy();
    }

    /**
     * Update kill/death ratio
     */
    private updateKDRatio(): void {
        const deaths = Math.max(this.state.performanceMetrics.totalDeaths, 1);
        this.state.performanceMetrics.killDeathRatio =
            this.state.performanceMetrics.totalEnemiesKilled / deaths;
    }

    /**
     * Update accuracy metric
     */
    private updateAccuracy(): void {
        const shots = Math.max(this.state.performanceMetrics.totalShots, 1);
        this.state.performanceMetrics.averageAccuracy =
            this.state.performanceMetrics.totalHits / shots;
    }

    /**
     * Get current difficulty multipliers
     */
    getCurrentMultipliers(): DifficultyCurve {
        return { ...this.state.currentMultipliers };
    }

    /**
     * Get current difficulty level
     */
    getCurrentLevel(): DifficultyLevel {
        return this.state.level;
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        return { ...this.state.performanceMetrics };
    }

    /**
     * Get overall performance score
     */
    getPerformanceScore(): number {
        return this.calculateOverallPerformance();
    }

    /**
     * Reset difficulty manager (for new game)
     */
    reset(): void {
        this.state.wave = 1;
        this.state.performanceMetrics = this.initializeMetrics();
        this.updateDifficultyMultipliers();

        gameEvents.emit({
            type: 'difficulty:reset',
            timestamp: Date.now(),
            source: 'DifficultyManager',
            data: {
                level: this.state.level
            }
        });
    }

    /**
     * Get debug information
     */
    getDebugInfo(): any {
        return {
            level: this.state.level,
            wave: this.state.wave,
            multipliers: this.state.currentMultipliers,
            performance: this.calculateOverallPerformance(),
            metrics: this.state.performanceMetrics,
            adaptiveEnabled: this.state.adaptiveAdjustmentEnabled
        };
    }
}

// Export singleton instance
export const difficultyManager = DifficultyManager.getInstance();

// Make difficulty manager available globally for debugging
if (typeof window !== 'undefined') {
    (window as any).difficultyDebug = {
        manager: difficultyManager,
        setLevel: (level: DifficultyLevel) => difficultyManager.setDifficultyLevel(level),
        getMultipliers: () => difficultyManager.getCurrentMultipliers(),
        getPerformance: () => difficultyManager.getPerformanceScore(),
        getDebugInfo: () => difficultyManager.getDebugInfo()
    };

    console.log('DifficultyManager: Debug interface available at window.difficultyDebug');
}
