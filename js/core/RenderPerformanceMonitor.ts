/**
 * RenderPerformanceMonitor - Monitor and track rendering performance improvements
 * 
 * This module provides comprehensive performance monitoring for the RenderSystem,
 * tracking metrics like FPS, draw calls, memory usage, and rendering optimizations.
 */

import { RenderSystem } from './RenderSystem';
import { gameEvents } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Performance sample for tracking over time
 */
export interface PerformanceSample {
    timestamp: number;
    fps: number;
    frameTime: number;
    renderTime: number;
    totalObjects: number;
    visibleObjects: number;
    culledObjects: number;
    drawCalls: number;
    batchedSprites: number;
    memoryUsage?: number;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
    averageFps: number;
    minFps: number;
    maxFps: number;
    averageFrameTime: number;
    averageRenderTime: number;
    averageDrawCalls: number;
    cullingEfficiency: number; // Percentage of objects culled
    batchingEfficiency: number; // Sprites per draw call
    totalSamples: number;
    timespan: number; // Total time monitored in ms
}

/**
 * Performance comparison between old and new rendering
 */
export interface PerformanceComparison {
    baseline: PerformanceStats;
    optimized: PerformanceStats;
    improvements: {
        fpsImprovement: number; // Percentage improvement
        drawCallReduction: number; // Percentage reduction
        renderTimeReduction: number; // Percentage reduction
        cullingBenefit: number; // Objects culled per frame
        batchingBenefit: number; // Draw calls saved per frame
    };
}

/**
 * Render performance monitor
 */
export class RenderPerformanceMonitor {
    private static instance: RenderPerformanceMonitor;
    
    private renderSystem: RenderSystem;
    private samples: PerformanceSample[] = [];
    private isMonitoring: boolean = false;
    private monitoringStartTime: number = 0;
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    
    // Configuration
    private maxSamples: number = 1000; // Keep last 1000 samples
    private sampleInterval: number = 100; // Sample every 100ms
    private lastSampleTime: number = 0;
    
    // Performance thresholds
    private targetFps: number = 60;
    private lowFpsThreshold: number = 45;
    private highDrawCallThreshold: number = 100;
    
    private constructor(renderSystem: RenderSystem) {
        this.renderSystem = renderSystem;
        this.setupEventListeners();
    }
    
    /**
     * Get singleton instance
     */
    static getInstance(renderSystem?: RenderSystem): RenderPerformanceMonitor {
        if (!RenderPerformanceMonitor.instance) {
            if (!renderSystem) {
                throw new Error('RenderPerformanceMonitor requires RenderSystem on first initialization');
            }
            RenderPerformanceMonitor.instance = new RenderPerformanceMonitor(renderSystem);
        }
        return RenderPerformanceMonitor.instance;
    }
    
    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Listen for render events
        gameEvents.on('render:frame_rendered', (event) => {
            if (this.isMonitoring) {
                this.recordFrameData(event.data);
            }
        });
        
        // Listen for performance alerts
        gameEvents.on('performance:low_fps', (event) => {
            console.warn('🐌 Low FPS detected:', event.data);
        });
        
        gameEvents.on('performance:high_draw_calls', (event) => {
            console.warn('📊 High draw calls detected:', event.data);
        });
    }
    
    /**
     * Start performance monitoring
     */
    startMonitoring(): void {
        if (this.isMonitoring) {
            console.warn('Performance monitoring already active');
            return;
        }
        
        this.isMonitoring = true;
        this.monitoringStartTime = Date.now();
        this.samples = [];
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.lastSampleTime = 0;
        
        console.log('🎯 Started render performance monitoring');
        
        gameEvents.emit({
            type: 'performance:monitoring_started',
            timestamp: Date.now(),
            source: 'RenderPerformanceMonitor',
            data: { targetFps: this.targetFps }
        });
    }
    
    /**
     * Stop performance monitoring
     */
    stopMonitoring(): PerformanceStats {
        if (!this.isMonitoring) {
            console.warn('Performance monitoring not active');
            return this.calculateStats();
        }
        
        this.isMonitoring = false;
        const stats = this.calculateStats();
        
        console.log('🏁 Stopped render performance monitoring');
        console.log('📈 Performance Summary:', stats);
        
        gameEvents.emit({
            type: 'performance:monitoring_stopped',
            timestamp: Date.now(),
            source: 'RenderPerformanceMonitor',
            data: stats
        });
        
        return stats;
    }
    
    /**
     * Record frame performance data
     */
    private recordFrameData(renderData: any): void {
        const now = performance.now();
        const currentTime = Date.now();
        
        // Calculate frame time
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.frameCount++;
        
        // Sample at specified interval
        if (currentTime - this.lastSampleTime >= this.sampleInterval) {
            const renderMetrics = this.renderSystem.getMetrics();
            
            const sample: PerformanceSample = {
                timestamp: currentTime,
                fps: 1000 / frameTime,
                frameTime: frameTime,
                renderTime: renderMetrics.renderTime,
                totalObjects: renderMetrics.totalObjects,
                visibleObjects: renderMetrics.visibleObjects,
                culledObjects: renderMetrics.culledObjects,
                drawCalls: renderMetrics.drawCalls,
                batchedSprites: renderMetrics.batchedSprites,
                memoryUsage: this.getMemoryUsage()
            };
            
            this.addSample(sample);
            this.checkPerformanceThresholds(sample);
            this.lastSampleTime = currentTime;
        }
    }
    
    /**
     * Add a performance sample
     */
    private addSample(sample: PerformanceSample): void {
        this.samples.push(sample);
        
        // Keep only the most recent samples
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }
    
    /**
     * Check performance thresholds and emit alerts
     */
    private checkPerformanceThresholds(sample: PerformanceSample): void {
        // Check for low FPS
        if (sample.fps < this.lowFpsThreshold) {
            gameEvents.emit({
                type: 'performance:low_fps',
                timestamp: Date.now(),
                source: 'RenderPerformanceMonitor',
                data: {
                    currentFps: sample.fps,
                    threshold: this.lowFpsThreshold,
                    frameTime: sample.frameTime,
                    renderTime: sample.renderTime
                }
            });
        }
        
        // Check for high draw calls
        if (sample.drawCalls > this.highDrawCallThreshold) {
            gameEvents.emit({
                type: 'performance:high_draw_calls',
                timestamp: Date.now(),
                source: 'RenderPerformanceMonitor',
                data: {
                    drawCalls: sample.drawCalls,
                    threshold: this.highDrawCallThreshold,
                    totalObjects: sample.totalObjects,
                    batchedSprites: sample.batchedSprites
                }
            });
        }
    }
    
    /**
     * Get memory usage (if available)
     */
    private getMemoryUsage(): number | undefined {
        if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
        }
        return undefined;
    }
    
    /**
     * Calculate performance statistics
     */
    calculateStats(): PerformanceStats {
        if (this.samples.length === 0) {
            return {
                averageFps: 0,
                minFps: 0,
                maxFps: 0,
                averageFrameTime: 0,
                averageRenderTime: 0,
                averageDrawCalls: 0,
                cullingEfficiency: 0,
                batchingEfficiency: 0,
                totalSamples: 0,
                timespan: 0
            };
        }
        
        const fps = this.samples.map(s => s.fps);
        const frameTimes = this.samples.map(s => s.frameTime);
        const renderTimes = this.samples.map(s => s.renderTime);
        const drawCalls = this.samples.map(s => s.drawCalls);
        
        // Calculate culling efficiency
        const totalObjectsSum = this.samples.reduce((sum, s) => sum + s.totalObjects, 0);
        const culledObjectsSum = this.samples.reduce((sum, s) => sum + s.culledObjects, 0);
        const cullingEfficiency = totalObjectsSum > 0 ? (culledObjectsSum / totalObjectsSum) * 100 : 0;
        
        // Calculate batching efficiency (sprites per draw call)
        const batchedSpritesSum = this.samples.reduce((sum, s) => sum + s.batchedSprites, 0);
        const drawCallsSum = this.samples.reduce((sum, s) => sum + s.drawCalls, 0);
        const batchingEfficiency = drawCallsSum > 0 ? batchedSpritesSum / drawCallsSum : 0;
        
        const timespan = this.samples.length > 0 ? 
            this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp : 0;
        
        return {
            averageFps: this.average(fps),
            minFps: Math.min(...fps),
            maxFps: Math.max(...fps),
            averageFrameTime: this.average(frameTimes),
            averageRenderTime: this.average(renderTimes),
            averageDrawCalls: this.average(drawCalls),
            cullingEfficiency: cullingEfficiency,
            batchingEfficiency: batchingEfficiency,
            totalSamples: this.samples.length,
            timespan: timespan
        };
    }
    
    /**
     * Compare performance between two monitoring sessions
     */
    comparePerformance(baseline: PerformanceStats, optimized: PerformanceStats): PerformanceComparison {
        const fpsImprovement = baseline.averageFps > 0 ? 
            ((optimized.averageFps - baseline.averageFps) / baseline.averageFps) * 100 : 0;
        
        const drawCallReduction = baseline.averageDrawCalls > 0 ? 
            ((baseline.averageDrawCalls - optimized.averageDrawCalls) / baseline.averageDrawCalls) * 100 : 0;
        
        const renderTimeReduction = baseline.averageRenderTime > 0 ? 
            ((baseline.averageRenderTime - optimized.averageRenderTime) / baseline.averageRenderTime) * 100 : 0;
        
        return {
            baseline,
            optimized,
            improvements: {
                fpsImprovement,
                drawCallReduction,
                renderTimeReduction,
                cullingBenefit: optimized.cullingEfficiency,
                batchingBenefit: optimized.batchingEfficiency
            }
        };
    }
    
    /**
     * Get current performance snapshot
     */
    getCurrentSnapshot(): PerformanceSample | null {
        if (this.samples.length === 0) return null;
        return this.samples[this.samples.length - 1];
    }
    
    /**
     * Get recent samples
     */
    getRecentSamples(count: number = 10): PerformanceSample[] {
        return this.samples.slice(-count);
    }
    
    /**
     * Export performance data
     */
    exportData(): {
        samples: PerformanceSample[];
        stats: PerformanceStats;
        configuration: any;
    } {
        return {
            samples: [...this.samples],
            stats: this.calculateStats(),
            configuration: {
                targetFps: this.targetFps,
                lowFpsThreshold: this.lowFpsThreshold,
                highDrawCallThreshold: this.highDrawCallThreshold,
                sampleInterval: this.sampleInterval,
                maxSamples: this.maxSamples
            }
        };
    }
    
    /**
     * Update configuration
     */
    updateConfiguration(config: {
        targetFps?: number;
        lowFpsThreshold?: number;
        highDrawCallThreshold?: number;
        sampleInterval?: number;
        maxSamples?: number;
    }): void {
        if (config.targetFps !== undefined) this.targetFps = config.targetFps;
        if (config.lowFpsThreshold !== undefined) this.lowFpsThreshold = config.lowFpsThreshold;
        if (config.highDrawCallThreshold !== undefined) this.highDrawCallThreshold = config.highDrawCallThreshold;
        if (config.sampleInterval !== undefined) this.sampleInterval = config.sampleInterval;
        if (config.maxSamples !== undefined) this.maxSamples = config.maxSamples;
        
        console.log('📊 Performance monitor configuration updated:', config);
    }
    
    /**
     * Calculate average of an array
     */
    private average(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    /**
     * Generate performance report
     */
    generateReport(): string {
        const stats = this.calculateStats();
        const config = this.renderSystem.getConfiguration();
        
        return `
🎨 Render Performance Report
============================

📊 Performance Statistics:
  • Average FPS: ${stats.averageFps.toFixed(1)} (Target: ${this.targetFps})
  • FPS Range: ${stats.minFps.toFixed(1)} - ${stats.maxFps.toFixed(1)}
  • Average Frame Time: ${stats.averageFrameTime.toFixed(2)}ms
  • Average Render Time: ${stats.averageRenderTime.toFixed(2)}ms
  • Average Draw Calls: ${stats.averageDrawCalls.toFixed(1)}

🎯 Optimization Efficiency:
  • Culling Efficiency: ${stats.cullingEfficiency.toFixed(1)}% objects culled
  • Batching Efficiency: ${stats.batchingEfficiency.toFixed(1)} sprites per draw call

⚙️ RenderSystem Configuration:
  • Batching: ${config.enableBatching ? 'Enabled' : 'Disabled'}
  • Culling: ${config.enableCulling ? 'Enabled' : 'Disabled'}
  • Layering: ${config.enableLayering ? 'Enabled' : 'Disabled'}
  • Batch Size: ${config.batchSize}
  • Cull Padding: ${config.cullPadding}px

📈 Monitoring Info:
  • Total Samples: ${stats.totalSamples}
  • Monitoring Duration: ${(stats.timespan / 1000).toFixed(1)}s
  • Sample Interval: ${this.sampleInterval}ms
        `.trim();
    }
}

/**
 * Performance monitoring utilities
 */
export const PerformanceUtils = {
    /**
     * Run a performance benchmark
     */
    async benchmark(
        renderSystem: RenderSystem,
        duration: number = 10000, // 10 seconds
        description: string = 'Performance Benchmark'
    ): Promise<PerformanceStats> {
        console.log(`🏃 Starting ${description} (${duration / 1000}s)...`);
        
        const monitor = RenderPerformanceMonitor.getInstance(renderSystem);
        monitor.startMonitoring();
        
        // Wait for the specified duration
        await new Promise(resolve => setTimeout(resolve, duration));
        
        const stats = monitor.stopMonitoring();
        console.log(`✅ ${description} completed`);
        
        return stats;
    },
    
    /**
     * Compare rendering with and without optimizations
     */
    async compareOptimizations(
        renderSystem: RenderSystem,
        testDuration: number = 5000
    ): Promise<PerformanceComparison> {
        console.log('🔬 Running optimization comparison...');
        
        // Test without optimizations
        renderSystem.updateConfiguration({
            enableBatching: false,
            enableCulling: false
        });
        
        const baselineStats = await PerformanceUtils.benchmark(
            renderSystem, 
            testDuration, 
            'Baseline (No Optimizations)'
        );
        
        // Test with optimizations
        renderSystem.updateConfiguration({
            enableBatching: true,
            enableCulling: true
        });
        
        const optimizedStats = await PerformanceUtils.benchmark(
            renderSystem, 
            testDuration, 
            'Optimized (Batching + Culling)'
        );
        
        const monitor = RenderPerformanceMonitor.getInstance(renderSystem);
        const comparison = monitor.comparePerformance(baselineStats, optimizedStats);
        
        console.log('📊 Optimization Comparison Results:');
        console.log(`  • FPS Improvement: ${comparison.improvements.fpsImprovement.toFixed(1)}%`);
        console.log(`  • Draw Call Reduction: ${comparison.improvements.drawCallReduction.toFixed(1)}%`);
        console.log(`  • Render Time Reduction: ${comparison.improvements.renderTimeReduction.toFixed(1)}%`);
        
        return comparison;
    }
};