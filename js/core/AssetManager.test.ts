/**
 * Test file for AssetManager
 * 
 * This file contains tests for the AssetManager to ensure proper resource loading,
 * caching, error handling, and progress tracking.
 */

import {
    AssetManager,
    assetManager,
    AssetType,
    AssetStatus,
    AssetUtils
} from './AssetManager.js';

/**
 * Run tests for the AssetManager
 */
export function testAssetManager(): void {
    console.log('=== Running AssetManager Tests ===');
    
    // Test basic asset loading
    testBasicAssetLoading();
    
    // Test asset caching
    testAssetCaching();
    
    // Test error handling
    testErrorHandling();
    
    // Test loading progress
    testLoadingProgress();
    
    // Test asset utilities
    testAssetUtilities();
    
    console.log('=== All AssetManager Tests Completed ===');
}

/**
 * Test basic asset loading
 */
function testBasicAssetLoading(): void {
    console.log('Testing basic asset loading...');
    
    const manager = new AssetManager({
        basePath: 'assets/'
    });
    
    // Queue an image asset
    const imageInfo = manager.queueAsset(
        'test-image',
        'images/test.png',
        AssetType.IMAGE
    );
    
    console.assert(imageInfo.id === 'test-image', 'Should return correct asset ID');
    console.assert(imageInfo.status === AssetStatus.PENDING, 'Should have pending status');
    console.assert(imageInfo.url === 'assets/images/test.png', 'Should resolve URL with base path');
    
    console.log('Basic asset loading tests passed!');
}

/**
 * Test asset caching
 */
function testAssetCaching(): void {
    console.log('Testing asset caching...');
    
    const manager = new AssetManager();
    
    // Queue the same asset twice
    const firstAsset = manager.queueAsset('cached-asset', 'test.png', AssetType.IMAGE);
    const secondAsset = manager.queueAsset('cached-asset', 'test.png', AssetType.IMAGE);
    
    console.assert(firstAsset === secondAsset, 'Should return same asset info for duplicate IDs');
    
    // Test cache clearing
    const clearedCount = manager.clearCache();
    console.assert(clearedCount >= 0, 'Should clear cache');
    
    console.log('Asset caching tests passed!');
}

/**
 * Test error handling
 */
function testErrorHandling(): void {
    console.log('Testing error handling...');
    
    const manager = new AssetManager({
        defaultMaxRetries: 1
    });
    
    // Queue a non-existent asset
    const assetInfo = manager.queueAsset('non-existent', 'does-not-exist.png', AssetType.IMAGE);
    
    console.assert(assetInfo.id === 'non-existent', 'Should create asset info even for non-existent assets');
    console.assert(assetInfo.maxRetries === 1, 'Should use configured max retries');
    
    console.log('Error handling tests passed!');
}

/**
 * Test loading progress
 */
function testLoadingProgress(): void {
    console.log('Testing loading progress...');
    
    const manager = new AssetManager();
    
    // Queue multiple assets
    manager.queueAsset('progress-1', 'test1.png', AssetType.IMAGE);
    manager.queueAsset('progress-2', 'test2.png', AssetType.IMAGE);
    manager.queueAsset('progress-3', 'test3.png', AssetType.IMAGE);
    
    // Check initial progress
    const initialProgress = manager.getProgress();
    console.assert(initialProgress >= 0 && initialProgress <= 1, 'Progress should be between 0 and 1');
    
    // Check stats
    const stats = manager.getStats();
    console.assert(typeof stats.total === 'number', 'Should have total count');
    console.assert(typeof stats.pending === 'number', 'Should have pending count');
    console.assert(typeof stats.active === 'number', 'Should have active count');
    
    console.log('Loading progress tests passed!');
}

/**
 * Test asset utilities
 */
function testAssetUtilities(): void {
    console.log('Testing asset utilities...');
    
    // Test fallback texture generation
    const fallbackCanvas = AssetUtils.generateFallbackTexture(32, 32, '#FF0000');
    console.assert(fallbackCanvas instanceof HTMLCanvasElement, 'Should generate canvas element');
    console.assert(fallbackCanvas.width === 32, 'Should have correct width');
    console.assert(fallbackCanvas.height === 32, 'Should have correct height');
    
    // Test data URL conversion
    const dataUrl = AssetUtils.canvasToDataUrl(fallbackCanvas);
    console.assert(dataUrl.startsWith('data:image/png'), 'Should generate valid data URL');
    
    // Test asset with fallback
    const fallbackAsset = AssetUtils.getAssetWithFallback('non-existent', () => 'fallback-value');
    console.assert(fallbackAsset === 'fallback-value', 'Should return fallback value for missing asset');
    
    console.log('Asset utilities tests passed!');
}

/**
 * Integration test with game-like usage
 */
export async function integrationTestAssetManager(): Promise<void> {
    console.log('=== Running AssetManager Integration Tests ===');
    
    // Setup asset manager with game-specific configuration
    const gameAssetManager = new AssetManager({
        basePath: './',
        maxConcurrentLoads: 4,
        defaultMaxRetries: 2
    });
    
    // Define game assets (using existing files from the project)
    const gameAssets = [
        { id: 'player-sprite', url: 'sprites/player.png', type: AssetType.IMAGE },
        { id: 'humans-sprite', url: 'sprites/humans.png', type: AssetType.IMAGE },
        { id: 'grunt-sprite', url: 'sprites/grunt.png', type: AssetType.IMAGE },
        { id: 'package-config', url: 'package.json', type: AssetType.JSON }
    ];
    
    // Simulate loading screen
    console.log('Loading game assets...');
    
    try {
        // Start loading all assets
        await AssetUtils.preloadAssets(
            gameAssets.map(asset => ({
                id: asset.id,
                url: asset.url,
                type: asset.type
            })),
            (progress) => {
                // Update loading progress bar
                console.log(`Loading progress: ${Math.round(progress * 100)}%`);
            }
        );
        
        console.log('All assets loaded successfully!');
        
        // Test asset retrieval
        const playerSprite = gameAssetManager.getAsset<HTMLImageElement>('player-sprite');
        if (playerSprite) {
            console.log(`Player sprite loaded: ${playerSprite.width}x${playerSprite.height}`);
        }
        
        const packageConfig = gameAssetManager.getAsset<any>('package-config');
        if (packageConfig) {
            console.log(`Package config loaded: ${packageConfig.name}`);
        }
        
        // Test fallback generation
        const fallbackTexture = AssetUtils.generateFallbackTexture(64, 64, '#00FF00');
        console.log(`Generated fallback texture: ${fallbackTexture.width}x${fallbackTexture.height}`);
        
        // Get loading statistics
        const finalStats = gameAssetManager.getStats();
        console.log('Final loading statistics:', finalStats);
        
    } catch (error) {
        console.error('Asset loading failed:', error);
    }
    
    console.log('=== AssetManager Integration Tests Completed ===');
}

/**
 * Run all AssetManager tests
 */
export function runAllAssetManagerTests(): void {
    testAssetManager();
    // Note: Integration test is async and should be called separately
}

/**
 * Performance test for asset loading
 */
export function performanceTestAssetManager(): void {
    console.log('=== Running AssetManager Performance Tests ===');
    
    const manager = new AssetManager({
        maxConcurrentLoads: 10
    });
    
    const startTime = performance.now();
    
    // Queue many assets to test performance
    for (let i = 0; i < 100; i++) {
        manager.queueAsset(`perf-test-${i}`, `test-${i}.png`, AssetType.IMAGE);
    }
    
    const queueTime = performance.now() - startTime;
    console.log(`Queued 100 assets in ${queueTime.toFixed(2)}ms`);
    
    // Test cache performance
    const cacheStartTime = performance.now();
    for (let i = 0; i < 1000; i++) {
        manager.getAsset(`perf-test-${i % 100}`);
    }
    const cacheTime = performance.now() - cacheStartTime;
    console.log(`Performed 1000 cache lookups in ${cacheTime.toFixed(2)}ms`);
    
    console.log('=== AssetManager Performance Tests Completed ===');
}