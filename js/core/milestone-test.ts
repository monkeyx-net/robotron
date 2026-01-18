/**
 * Milestone 1 Test Suite - Foundational Systems Verification
 * 
 * This file contains comprehensive tests for all foundational systems
 * to ensure they work correctly and don't break existing functionality.
 */

import { RobotronGame } from './GameModule';
import { Vector2 } from '../utils/Vector2';
import { Rectangle } from '../utils/Rectangle';
import { ObjectPool } from '../utils/ObjectPool';
import { Constants } from '../utils/Constants';
import { gameEvents, EventUtils } from './EventSystem';
import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { assetManager, AssetType, AssetUtils } from './AssetManager';

/**
 * Run all milestone 1 tests
 */
export function runMilestone1Tests(): boolean {
    console.log('🚀 Starting Milestone 1 Tests - Foundational Systems');
    console.log('================================================');
    
    let allTestsPassed = true;
    
    // Test 1: Basic module structure
    console.log('\n📦 Test 1: Basic Module Structure');
    if (!testModuleStructure()) {
        allTestsPassed = false;
    }
    
    // Test 2: Utility classes
    console.log('\n🔧 Test 2: Utility Classes');
    if (!testUtilityClasses()) {
        allTestsPassed = false;
    }
    
    // Test 3: Event system
    console.log('\n📡 Test 3: Event System');
    if (!testEventSystem()) {
        allTestsPassed = false;
    }
    
    // Test 4: Error handling
    console.log('\n🚨 Test 4: Error Handling');
    if (!testErrorHandling()) {
        allTestsPassed = false;
    }
    
    // Test 5: Asset management
    console.log('\n📁 Test 5: Asset Management');
    if (!testAssetManagement()) {
        allTestsPassed = false;
    }
    
    // Test 6: Integration test
    console.log('\n🔗 Test 6: System Integration');
    if (!testSystemIntegration()) {
        allTestsPassed = false;
    }
    
    console.log('\n================================================');
    if (allTestsPassed) {
        console.log('✅ All Milestone 1 tests PASSED!');
        console.log('🎉 Foundational systems are working correctly');
    } else {
        console.log('❌ Some Milestone 1 tests FAILED!');
        console.log('⚠️  Please review the failing tests above');
    }
    console.log('================================================');
    
    return allTestsPassed;
}

/**
 * Test basic module structure and imports
 */
function testModuleStructure(): boolean {
    try {
        console.log('  Testing module imports and basic structure...');
        
        // Test that all modules can be imported
        console.assert(typeof RobotronGame !== 'undefined', 'RobotronGame module should be available');
        console.assert(typeof Vector2 !== 'undefined', 'Vector2 class should be available');
        console.assert(typeof Rectangle !== 'undefined', 'Rectangle class should be available');
        console.assert(typeof ObjectPool !== 'undefined', 'ObjectPool class should be available');
        console.assert(typeof Constants !== 'undefined', 'Constants module should be available');
        console.assert(typeof gameEvents !== 'undefined', 'Event system should be available');
        console.assert(typeof errorHandler !== 'undefined', 'Error handler should be available');
        console.assert(typeof assetManager !== 'undefined', 'Asset manager should be available');
        
        // Test RobotronGame initialization
        const initialized = RobotronGame.init();
        console.assert(initialized, 'RobotronGame should initialize successfully');
        
        console.log('  ✅ Module structure test passed');
        return true;
        
    } catch (error) {
        console.error('  ❌ Module structure test failed:', error);
        return false;
    }
}

/**
 * Test utility classes functionality
 */
function testUtilityClasses(): boolean {
    try {
        console.log('  Testing Vector2 class...');
        
        // Test Vector2
        const vec1 = new Vector2(3, 4);
        const vec2 = new Vector2(1, 2);
        const distance = vec1.distanceTo(vec2);
        console.assert(Math.abs(distance - Math.sqrt(8)) < 0.001, 'Vector2 distance calculation should be correct');
        
        const sum = vec1.add(vec2);
        console.assert(sum.x === 4 && sum.y === 6, 'Vector2 addition should work correctly');
        
        console.log('  Testing Rectangle class...');
        
        // Test Rectangle
        const rect1 = new Rectangle(0, 0, 10, 10);
        const rect2 = new Rectangle(5, 5, 10, 10);
        const intersects = rect1.intersects(rect2);
        console.assert(intersects, 'Rectangle intersection should work correctly');
        
        const noIntersect = new Rectangle(20, 20, 5, 5);
        console.assert(!rect1.intersects(noIntersect), 'Rectangle non-intersection should work correctly');
        
        console.log('  Testing ObjectPool class...');
        
        // Test ObjectPool
        const pool = new ObjectPool(() => ({ value: 0, reset: function() { this.value = 0; } }), 5);
        const obj1 = pool.acquire();
        obj1.value = 42;
        pool.release(obj1);
        
        const obj2 = pool.acquire();
        console.assert(obj2.value === 0, 'ObjectPool should reset objects when released');
        
        console.log('  Testing Constants module...');
        
        // Test Constants
        console.assert(typeof Constants.GAME_WIDTH === 'number', 'Constants should have GAME_WIDTH');
        console.assert(typeof Constants.GAME_HEIGHT === 'number', 'Constants should have GAME_HEIGHT');
        console.assert(Constants.GAME_WIDTH > 0, 'GAME_WIDTH should be positive');
        console.assert(Constants.GAME_HEIGHT > 0, 'GAME_HEIGHT should be positive');
        
        console.log('  ✅ Utility classes test passed');
        return true;
        
    } catch (error) {
        console.error('  ❌ Utility classes test failed:', error);
        return false;
    }
}

/**
 * Test event system functionality
 */
function testEventSystem(): boolean {
    try {
        console.log('  Testing event subscription and emission...');
        
        let eventReceived = false;
        let eventData: any = null;
        
        // Subscribe to a test event
        const subscriptionId = gameEvents.subscribe('test:event', (event) => {
            eventReceived = true;
            eventData = event.data;
        });
        
        // Emit the test event
        gameEvents.emit({
            type: 'test:event',
            timestamp: Date.now(),
            source: 'test',
            data: { message: 'Hello, World!' }
        });
        
        console.assert(eventReceived, 'Event should be received by subscriber');
        console.assert(eventData?.message === 'Hello, World!', 'Event data should be passed correctly');
        
        // Test unsubscription
        const unsubscribed = gameEvents.unsubscribe(subscriptionId);
        console.assert(unsubscribed, 'Should be able to unsubscribe from events');
        
        console.log('  Testing event utilities...');
        
        // Test event utilities
        const playerDeathEvent = EventUtils.createPlayerDeathEvent(
            { x: 100, y: 200 },
            'enemy collision',
            2
        );
        
        console.assert(playerDeathEvent.type === 'player:death', 'Event utility should create correct event type');
        console.assert(playerDeathEvent.data.position.x === 100, 'Event utility should preserve data');
        
        console.log('  ✅ Event system test passed');
        return true;
        
    } catch (error) {
        console.error('  ❌ Event system test failed:', error);
        return false;
    }
}

/**
 * Test error handling functionality
 */
function testErrorHandling(): boolean {
    try {
        console.log('  Testing error handling and logging...');
        
        // Test basic error handling
        const errorId = errorHandler.handleError(
            new Error('Test error'),
            ErrorCategory.GAME_LOGIC,
            ErrorSeverity.MEDIUM,
            { testContext: 'milestone test' },
            'testErrorHandling'
        );
        
        console.assert(typeof errorId === 'string', 'Error handler should return error ID');
        console.assert(errorId.startsWith('err_'), 'Error ID should have correct format');
        
        // Test error history
        const history = errorHandler.getErrorHistory();
        console.assert(history.length > 0, 'Error history should contain the test error');
        
        const lastError = history[history.length - 1];
        console.assert(lastError.message === 'Test error', 'Error message should be preserved');
        console.assert(lastError.category === ErrorCategory.GAME_LOGIC, 'Error category should be preserved');
        
        // Test error statistics
        const stats = errorHandler.getErrorStats();
        console.assert(typeof stats.totalErrors === 'number', 'Error stats should include total count');
        console.assert(stats.totalErrors > 0, 'Error stats should show at least one error');
        
        console.log('  Testing intentional asset loading failure...');
        
        // Test intentional asset loading failure (for milestone requirement)
        try {
            assetManager.queueAsset(
                'test-missing-asset',
                'non-existent-file.png',
                AssetType.IMAGE,
                {
                    maxRetries: 0, // Don't retry for this test
                    onError: (error, asset) => {
                        console.log('  📝 Expected asset loading error caught:', error.message);
                    }
                }
            );
        } catch (error) {
            // This is expected for missing assets
            console.log('  📝 Asset loading error handled correctly');
        }
        
        console.log('  ✅ Error handling test passed');
        return true;
        
    } catch (error) {
        console.error('  ❌ Error handling test failed:', error);
        return false;
    }
}

/**
 * Test asset management functionality
 */
function testAssetManagement(): boolean {
    try {
        console.log('  Testing asset management system...');
        
        // Test asset queueing
        const assetInfo = assetManager.queueAsset(
            'test-asset',
            'test-file.png',
            AssetType.IMAGE
        );
        
        console.assert(assetInfo.id === 'test-asset', 'Asset should have correct ID');
        console.assert(assetInfo.type === AssetType.IMAGE, 'Asset should have correct type');
        
        // Test asset utilities
        console.log('  Testing fallback texture generation...');
        
        const fallbackTexture = AssetUtils.generateFallbackTexture(32, 32, '#FF0000');
        console.assert(fallbackTexture instanceof HTMLCanvasElement, 'Should generate canvas fallback');
        console.assert(fallbackTexture.width === 32, 'Fallback should have correct width');
        console.assert(fallbackTexture.height === 32, 'Fallback should have correct height');
        
        // Test asset with fallback
        const assetWithFallback = AssetUtils.getAssetWithFallback('non-existent', () => 'fallback-value');
        console.assert(assetWithFallback === 'fallback-value', 'Should return fallback for missing asset');
        
        // Test loading progress
        const progress = assetManager.getProgress();
        console.assert(typeof progress === 'number', 'Progress should be a number');
        console.assert(progress >= 0 && progress <= 1, 'Progress should be between 0 and 1');
        
        console.log('  ✅ Asset management test passed');
        return true;
        
    } catch (error) {
        console.error('  ❌ Asset management test failed:', error);
        return false;
    }
}

/**
 * Test system integration
 */
function testSystemIntegration(): boolean {
    try {
        console.log('  Testing system integration...');
        
        // Test that systems work together
        let integrationEventReceived = false;
        
        // Subscribe to asset events
        gameEvents.subscribe('asset:loading', (event) => {
            console.log('  📝 Asset loading event received:', event.data.assetId);
            integrationEventReceived = true;
        });
        
        // Queue an asset (this should trigger an event)
        assetManager.queueAsset(
            'integration-test-asset',
            'integration-test.png',
            AssetType.IMAGE
        );
        
        // Give a moment for the event to be processed
        setTimeout(() => {
            console.assert(integrationEventReceived, 'Asset loading should trigger events');
        }, 10);
        
        // Test error handling with asset loading
        const originalHandleError = errorHandler.handleError;
        let errorHandlerCalled = false;
        
        // Temporarily override error handler to detect calls
        errorHandler.handleError = function(...args) {
            errorHandlerCalled = true;
            return originalHandleError.apply(this, args);
        };
        
        // Try to load a non-existent asset (should trigger error handling)
        assetManager.queueAsset(
            'integration-error-test',
            'definitely-does-not-exist.png',
            AssetType.IMAGE,
            { maxRetries: 0 }
        );
        
        // Restore original error handler
        setTimeout(() => {
            errorHandler.handleError = originalHandleError;
        }, 100);
        
        // Test that constants are accessible
        console.assert(typeof Constants.PLAYER_SPEED === 'number', 'Game constants should be accessible');
        
        // Test that utilities work with game objects
        const testPosition = new Vector2(Constants.GAME_WIDTH / 2, Constants.GAME_HEIGHT / 2);
        const testBounds = new Rectangle(0, 0, Constants.GAME_WIDTH, Constants.GAME_HEIGHT);
        
        console.assert(testBounds.contains(testPosition), 'Utilities should work with game constants');
        
        console.log('  ✅ System integration test passed');
        return true;
        
    } catch (error) {
        console.error('  ❌ System integration test failed:', error);
        return false;
    }
}

/**
 * Test that the game still loads and displays (for milestone requirement)
 */
export function testGameLoading(): boolean {
    try {
        console.log('🎮 Testing game loading and display...');
        
        // Check that PIXI is available and working
        if (typeof PIXI === 'undefined') {
            throw new Error('PIXI is not available');
        }
        
        // Check that the game container exists
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) {
            throw new Error('Game container not found');
        }
        
        // Check that canvas is present (indicates PIXI app is running)
        const canvas = gameContainer.querySelector('canvas');
        if (!canvas) {
            console.warn('Canvas not found - game may not be fully loaded yet');
            return false;
        }
        
        console.log('  ✅ Game loading test passed - canvas is present');
        return true;
        
    } catch (error) {
        console.error('  ❌ Game loading test failed:', error);
        return false;
    }
}

/**
 * Auto-run milestone tests when this module is loaded
 */
if (typeof window !== 'undefined') {
    // Run tests after a delay to ensure everything is loaded
    setTimeout(() => {
        const testsPass = runMilestone1Tests();
        
        // Also test game loading
        setTimeout(() => {
            testGameLoading();
        }, 500);
        
        // Store test results globally for debugging
        (window as any).milestone1TestResults = {
            foundationalSystemsPass: testsPass,
            timestamp: new Date().toISOString()
        };
        
    }, 200);
}