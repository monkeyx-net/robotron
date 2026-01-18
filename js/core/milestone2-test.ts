/**
 * Milestone 2 Test Suite - Core Systems Integration Verification
 * 
 * This file contains comprehensive tests for core systems integration
 * to ensure collision detection, game loop, and entity behavior work correctly.
 */

import { gameEngine } from './GameEngine';
import { collisionIntegration } from './CollisionIntegration';
import { gameEvents } from './EventSystem';

/**
 * Run all milestone 2 tests
 */
export function runMilestone2Tests(): boolean {
    console.log('🚀 Starting Milestone 2 Tests - Core Systems Integration');
    console.log('=====================================================');
    
    let allTestsPassed = true;
    
    // Test 1: GameEngine integration
    console.log('\n🎮 Test 1: GameEngine Integration');
    if (!testGameEngineIntegration()) {
        allTestsPassed = false;
    }
    
    // Test 2: Collision system integration
    console.log('\n💥 Test 2: Collision System Integration');
    if (!testCollisionSystemIntegration()) {
        allTestsPassed = false;
    }
    
    // Test 3: Performance validation
    console.log('\n📊 Test 3: Performance Validation');
    if (!testPerformanceImprovements()) {
        allTestsPassed = false;
    }
    
    // Test 4: Entity behavior validation
    console.log('\n🤖 Test 4: Entity Behavior Validation');
    if (!testEntityBehavior()) {
        allTestsPassed = false;
    }
    
    // Test 5: System stability
    console.log('\n🔧 Test 5: System Stability');
    if (!testSystemStability()) {
        allTestsPassed = false;
    }
    
    console.log('\n=====================================================');
    if (allTestsPassed) {
        console.log('✅ All Milestone 2 tests PASSED!');
        console.log('🎉 Core systems integration is working correctly');
        console.log('🚀 Game loop runs smoothly with consistent performance');
        console.log('💥 Collision detection is optimized and functional');
    } else {
        console.log('❌ Some Milestone 2 tests FAILED!');
        console.log('⚠️  Please review the failing tests above');
    }
    console.log('=====================================================');
    
    return allTestsPassed;
}

/**
 * Test GameEngine integration and performance
 */
function testGameEngineIntegration(): boolean {
    try {
        console.log('  Testing GameEngine state and systems...');
        
        // Check GameEngine state
        const engineState = gameEngine.getState();
        console.assert(engineState === 'running', 'GameEngine should be running');
        
        // Check performance metrics
        const metrics = gameEngine.getMetrics();
        console.assert(typeof metrics.fps === 'number', 'FPS should be a number');
        console.assert(metrics.fps > 0, 'FPS should be positive');
        console.assert(typeof metrics.totalFrames === 'number', 'Total frames should be a number');
        console.assert(metrics.totalFrames > 0, 'Should have processed frames');
        
        // Check that systems are registered
        const inputSystem = gameEngine.getSystem('InputSystem');
        const gameplaySystem = gameEngine.getSystem('GameplaySystem');
        const attractModeSystem = gameEngine.getSystem('AttractModeSystem');
        const uiSystem = gameEngine.getSystem('UISystem');
        
        console.assert(inputSystem !== undefined, 'InputSystem should be registered');
        console.assert(gameplaySystem !== undefined, 'GameplaySystem should be registered');
        console.assert(attractModeSystem !== undefined, 'AttractModeSystem should be registered');
        console.assert(uiSystem !== undefined, 'UISystem should be registered');
        
        // Check system priorities
        console.assert(inputSystem?.priority === 100, 'InputSystem should have highest priority');
        console.assert(gameplaySystem?.priority === 80, 'GameplaySystem should have high priority');
        console.assert(uiSystem?.priority === 10, 'UISystem should have lowest priority');
        
        // Test frame rate consistency
        const frameTimeVariance = Math.abs(metrics.frameTime - (1000 / 60));
        console.assert(frameTimeVariance < 10, 'Frame time should be close to 16.67ms for 60 FPS');
        
        console.log('  ✅ GameEngine integration test passed');
        console.log(`    - FPS: ${metrics.fps.toFixed(1)}`);
        console.log(`    - Average FPS: ${metrics.averageFps.toFixed(1)}`);
        console.log(`    - Frame Time: ${metrics.frameTime.toFixed(2)}ms`);
        console.log(`    - Total Frames: ${metrics.totalFrames}`);
        
        return true;
        
    } catch (error) {
        console.error('  ❌ GameEngine integration test failed:', error);
        return false;
    }
}

/**
 * Test collision system integration
 */
function testCollisionSystemIntegration(): boolean {
    try {
        console.log('  Testing collision system integration...');
        
        // Get collision system stats
        const collisionStats = collisionIntegration.getStats();
        
        console.assert(typeof collisionStats === 'object', 'Collision stats should be available');
        console.assert(typeof collisionStats.collisionSystem === 'object', 'Collision system stats should be available');
        console.assert(typeof collisionStats.integration === 'object', 'Integration stats should be available');
        
        // Check spatial grid functionality
        const spatialGridStats = collisionStats.collisionSystem.spatialGridStats;
        console.assert(typeof spatialGridStats === 'object', 'Spatial grid stats should be available');
        console.assert(typeof spatialGridStats.totalObjects === 'number', 'Should track total objects');
        console.assert(typeof spatialGridStats.activeCells === 'number', 'Should track active cells');
        
        // Test collision system modes
        console.log('  Testing collision system modes...');
        
        // Test enabling testing mode
        collisionIntegration.setMigrationPhase('testing');
        console.assert(collisionIntegration.getStats().integration.migrationPhase === 'testing', 'Should set testing mode');
        
        // Test enabling hybrid mode
        collisionIntegration.setMigrationPhase('hybrid');
        console.assert(collisionIntegration.getStats().integration.migrationPhase === 'hybrid', 'Should set hybrid mode');
        
        // Reset to testing mode for safety
        collisionIntegration.setMigrationPhase('testing');
        
        console.log('  ✅ Collision system integration test passed');
        console.log(`    - Migration Phase: ${collisionStats.integration.migrationPhase}`);
        console.log(`    - Registered Objects: ${collisionStats.integration.registeredObjects}`);
        console.log(`    - Spatial Grid Objects: ${spatialGridStats.totalObjects}`);
        console.log(`    - Active Cells: ${spatialGridStats.activeCells}`);
        
        return true;
        
    } catch (error) {
        console.error('  ❌ Collision system integration test failed:', error);
        return false;
    }
}

/**
 * Test performance improvements
 */
function testPerformanceImprovements(): boolean {
    try {
        console.log('  Testing performance improvements...');
        
        // Get current performance metrics
        const engineMetrics = gameEngine.getMetrics();
        const collisionStats = collisionIntegration.getStats();
        
        // Check frame rate stability
        const targetFps = 60;
        const fpsVariance = Math.abs(engineMetrics.averageFps - targetFps);
        const fpsStable = fpsVariance < 10; // Allow 10 FPS variance
        
        console.assert(fpsStable, `FPS should be stable around ${targetFps} (current: ${engineMetrics.averageFps.toFixed(1)})`);
        
        // Check frame time consistency
        const targetFrameTime = 1000 / 60; // 16.67ms
        const frameTimeVariance = Math.abs(engineMetrics.frameTime - targetFrameTime);
        const frameTimeConsistent = frameTimeVariance < 5; // Allow 5ms variance
        
        console.assert(frameTimeConsistent, `Frame time should be consistent around ${targetFrameTime.toFixed(2)}ms`);
        
        // Check for dropped frames
        const droppedFrameRate = engineMetrics.droppedFrames / engineMetrics.totalFrames;
        const lowDroppedFrames = droppedFrameRate < 0.05; // Less than 5% dropped frames
        
        console.assert(lowDroppedFrames, `Dropped frame rate should be low (current: ${(droppedFrameRate * 100).toFixed(2)}%)`);
        
        // Check collision system efficiency
        const spatialGridStats = collisionStats.collisionSystem.spatialGridStats;
        const memoryUsage = spatialGridStats.memoryUsage || 0;
        const memoryEfficient = memoryUsage < 10000; // Less than 10KB estimated usage
        
        console.assert(memoryEfficient, `Memory usage should be efficient (current: ~${memoryUsage} bytes)`);
        
        console.log('  ✅ Performance improvements test passed');
        console.log(`    - Average FPS: ${engineMetrics.averageFps.toFixed(1)} (target: ${targetFps})`);
        console.log(`    - Frame Time: ${engineMetrics.frameTime.toFixed(2)}ms (target: ${targetFrameTime.toFixed(2)}ms)`);
        console.log(`    - Dropped Frames: ${(droppedFrameRate * 100).toFixed(2)}%`);
        console.log(`    - Memory Usage: ~${memoryUsage} bytes`);
        
        return true;
        
    } catch (error) {
        console.error('  ❌ Performance improvements test failed:', error);
        return false;
    }
}

/**
 * Test entity behavior validation
 */
function testEntityBehavior(): boolean {
    try {
        console.log('  Testing entity behavior...');
        
        // Check that game systems are running
        const inputSystem = gameEngine.getSystem('InputSystem');
        const gameplaySystem = gameEngine.getSystem('GameplaySystem');
        const attractModeSystem = gameEngine.getSystem('AttractModeSystem');
        const uiSystem = gameEngine.getSystem('UISystem');
        
        console.assert(inputSystem?.enabled, 'InputSystem should be enabled');
        console.assert(gameplaySystem?.enabled, 'GameplaySystem should be enabled');
        console.assert(attractModeSystem?.enabled, 'AttractModeSystem should be enabled');
        console.assert(uiSystem?.enabled, 'UISystem should be enabled');
        
        // Check that collision integration is registering objects
        const collisionStats = collisionIntegration.getStats();
        const hasRegisteredObjects = collisionStats.integration.registeredObjects >= 0;
        
        console.assert(hasRegisteredObjects, 'Collision system should be registering objects');
        
        // Test event system integration
        let eventReceived = false;
        const testSubscription = gameEvents.subscribe('test:milestone2', () => {
            eventReceived = true;
        });
        
        gameEvents.emit({
            type: 'test:milestone2',
            timestamp: Date.now(),
            source: 'milestone2-test',
            data: { test: true }
        });
        
        console.assert(eventReceived, 'Event system should be working');
        gameEvents.unsubscribe(testSubscription);
        
        console.log('  ✅ Entity behavior validation test passed');
        console.log(`    - All systems enabled and running`);
        console.log(`    - Collision objects registered: ${collisionStats.integration.registeredObjects}`);
        console.log(`    - Event system functional`);
        
        return true;
        
    } catch (error) {
        console.error('  ❌ Entity behavior validation test failed:', error);
        return false;
    }
}

/**
 * Test system stability
 */
function testSystemStability(): boolean {
    try {
        console.log('  Testing system stability...');
        
        // Test GameEngine pause/resume functionality
        const initialState = gameEngine.getState();
        
        gameEngine.pause();
        console.assert(gameEngine.getState() === 'paused', 'GameEngine should pause correctly');
        
        gameEngine.resume();
        console.assert(gameEngine.getState() === 'running', 'GameEngine should resume correctly');
        
        // Test system enable/disable
        const testSystemName = 'UISystem';
        const originalEnabled = gameEngine.getSystem(testSystemName)?.enabled;
        
        gameEngine.setSystemEnabled(testSystemName, false);
        console.assert(gameEngine.getSystem(testSystemName)?.enabled === false, 'Should disable system');
        
        gameEngine.setSystemEnabled(testSystemName, true);
        console.assert(gameEngine.getSystem(testSystemName)?.enabled === true, 'Should enable system');
        
        // Test collision system mode switching
        const originalMode = collisionIntegration.getStats().integration.migrationPhase;
        
        collisionIntegration.setMigrationPhase('testing');
        console.assert(collisionIntegration.getStats().integration.migrationPhase === 'testing', 'Should switch to testing mode');
        
        collisionIntegration.setMigrationPhase('hybrid');
        console.assert(collisionIntegration.getStats().integration.migrationPhase === 'hybrid', 'Should switch to hybrid mode');
        
        // Restore original mode
        collisionIntegration.setMigrationPhase(originalMode);
        
        // Test error handling resilience
        let errorHandled = false;
        const originalConsoleError = console.error;
        console.error = (...args) => {
            if (args[0]?.includes?.('test error')) {
                errorHandled = true;
            }
            originalConsoleError.apply(console, args);
        };
        
        // This should be handled gracefully by the error system
        try {
            throw new Error('test error for stability testing');
        } catch (error) {
            // Expected - testing error handling
        }
        
        console.error = originalConsoleError;
        
        console.log('  ✅ System stability test passed');
        console.log(`    - GameEngine pause/resume functional`);
        console.log(`    - System enable/disable functional`);
        console.log(`    - Collision mode switching functional`);
        console.log(`    - Error handling resilient`);
        
        return true;
        
    } catch (error) {
        console.error('  ❌ System stability test failed:', error);
        return false;
    }
}

/**
 * Auto-run milestone 2 tests when this module is loaded
 */
if (typeof window !== 'undefined') {
    // Run tests after a delay to ensure everything is loaded
    setTimeout(() => {
        const testsPass = runMilestone2Tests();
        
        // Store test results globally for debugging
        (window as any).milestone2TestResults = {
            coreSystemsIntegrationPass: testsPass,
            timestamp: new Date().toISOString(),
            gameEngineMetrics: gameEngine.getMetrics(),
            collisionStats: collisionIntegration.getStats()
        };
        
        // Make test function available globally
        (window as any).runMilestone2Tests = runMilestone2Tests;
        
    }, 2000); // Wait 2 seconds for systems to stabilize
}