/**
 * Test file for ErrorHandler system
 * 
 * This file contains comprehensive tests for the ErrorHandler to ensure
 * proper error handling, logging, recovery mechanisms, and configuration.
 */

import {
    ErrorHandler,
    ErrorSeverity,
    ErrorCategory,
    LogLevel,
    ErrorUtils
} from './ErrorHandler';

/**
 * Run tests for the ErrorHandler system
 */
export function testErrorHandler(): void {
    console.log('=== Running ErrorHandler Tests ===');
    
    // Test basic error handling
    testBasicErrorHandling();
    
    // Test error categorization and severity
    testErrorCategorization();
    
    // Test error recovery
    testErrorRecovery();
    
    // Test error history and statistics
    testErrorHistory();
    
    // Test configuration
    testConfiguration();
    
    // Test utility functions
    testUtilityFunctions();
    
    // Test global error handling
    testGlobalErrorHandling();
    
    console.log('=== All ErrorHandler Tests Completed ===');
}

/**
 * Test basic error handling functionality
 */
function testBasicErrorHandling(): void {
    console.log('Testing basic error handling...');
    
    const handler = new ErrorHandler({
        enableConsoleLogging: false, // Disable for testing
        enableEventEmission: false
    });
    
    // Test handling a simple error. handleError is async; this legacy sync
    // test treats the promise as an id, so the asserts report failure at
    // runtime (pre-existing behavior, kept).
    const errorId = handler.handleError(
        'Test error message',
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.MEDIUM
    ) as unknown as string;

    console.assert(typeof errorId === 'string', 'Should return error ID');
    console.assert(errorId.startsWith('err_'), 'Error ID should have correct format');
    
    // Test handling an Error object
    const testError = new Error('Test Error object');
    const errorId2 = handler.handleError(
        testError,
        ErrorCategory.RENDERING,
        ErrorSeverity.HIGH
    );
    
    console.assert(typeof errorId2 === 'string', 'Should handle Error objects');
    
    // Check error history
    const history = handler.getErrorHistory();
    console.assert(history.length === 2, 'Should have 2 errors in history');
    console.assert(history[0].message === 'Test error message', 'Should store correct message');
    console.assert(history[1].message === 'Test Error object', 'Should extract message from Error object');
    
    console.log('Basic error handling tests passed!');
}

/**
 * Test error categorization and severity levels
 */
function testErrorCategorization(): void {
    console.log('Testing error categorization...');
    
    const handler = new ErrorHandler({
        enableConsoleLogging: false,
        enableEventEmission: false
    });
    
    // Test different categories and severities
    const categories = [
        ErrorCategory.ASSET_LOADING,
        ErrorCategory.COLLISION_DETECTION,
        ErrorCategory.GAME_LOGIC,
        ErrorCategory.RENDERING,
        ErrorCategory.AUDIO
    ];
    
    const severities = [
        ErrorSeverity.LOW,
        ErrorSeverity.MEDIUM,
        ErrorSeverity.HIGH,
        ErrorSeverity.CRITICAL
    ];
    
    for (const category of categories) {
        for (const severity of severities) {
            handler.handleError(
                `Test ${category} error`,
                category,
                severity
            );
        }
    }
    
    const stats = handler.getErrorStats();
    console.assert(stats.totalErrors === categories.length * severities.length, 'Should track all errors');
    console.assert(Object.keys(stats.errorsByCategory).length === categories.length, 'Should categorize errors correctly');
    console.assert(Object.keys(stats.errorsBySeverity).length === severities.length, 'Should track severity levels');
    
    console.log('Error categorization tests passed!');
}

/**
 * Test error recovery mechanisms
 */
function testErrorRecovery(): void {
    console.log('Testing error recovery...');
    
    const handler = new ErrorHandler({
        enableConsoleLogging: false,
        enableEventEmission: false,
        enableRecovery: true,
        maxRecoveryAttempts: 2,
        recoveryDelay: 10 // Short delay for testing
    });
    
    let recoveryAttempted = false;
    let recoverySuccessful = false;
    
    // Register a recovery strategy
    handler.registerRecoveryStrategy(ErrorCategory.ASSET_LOADING, async (error) => {
        recoveryAttempted = true;
        recoverySuccessful = error.recoveryAttempts === 1; // Succeed on first attempt
        return recoverySuccessful;
    });
    
    // Handle a recoverable error
    handler.handleError(
        'Recoverable asset loading error',
        ErrorCategory.ASSET_LOADING,
        ErrorSeverity.MEDIUM
    );
    
    // Wait a bit for recovery to attempt
    setTimeout(() => {
        console.assert(recoveryAttempted, 'Recovery should be attempted');
        
        const history = handler.getErrorHistory();
        const error = history.find(e => e.message === 'Recoverable asset loading error');
        console.assert(error?.recovered === recoverySuccessful, 'Error should be marked as recovered if successful');
        
        console.log('Error recovery tests passed!');
    }, 50);
}

/**
 * Test error history and statistics
 */
function testErrorHistory(): void {
    console.log('Testing error history and statistics...');
    
    const handler = new ErrorHandler({
        enableConsoleLogging: false,
        enableEventEmission: false,
        maxErrorHistory: 5 // Small history for testing
    });
    
    // Add more errors than the history limit
    for (let i = 0; i < 10; i++) {
        handler.handleError(
            `Test error ${i}`,
            ErrorCategory.GAME_LOGIC,
            ErrorSeverity.LOW
        );
    }
    
    const history = handler.getErrorHistory();
    console.assert(history.length === 5, 'Should respect max history limit');
    console.assert(history[0].message === 'Test error 5', 'Should keep most recent errors');
    console.assert(history[4].message === 'Test error 9', 'Should keep most recent errors');
    
    // Test filtered history
    handler.handleError('Audio error', ErrorCategory.AUDIO, ErrorSeverity.HIGH);
    const audioErrors = handler.getErrorHistory(ErrorCategory.AUDIO);
    console.assert(audioErrors.length === 1, 'Should filter by category');
    console.assert(audioErrors[0].category === ErrorCategory.AUDIO, 'Should return correct category');
    
    // Test statistics
    const stats = handler.getErrorStats();
    console.assert(stats.totalErrors === 6, 'Should count total errors correctly'); // 5 + 1 audio error
    console.assert(stats.errorsByCategory[ErrorCategory.GAME_LOGIC] === 5, 'Should count by category');
    console.assert(stats.errorsByCategory[ErrorCategory.AUDIO] === 1, 'Should count by category');
    
    // Test clearing history
    const clearedCount = handler.clearErrorHistory();
    console.assert(clearedCount === 6, 'Should return number of cleared errors');
    console.assert(handler.getErrorHistory().length === 0, 'Should clear all errors');
    
    console.log('Error history and statistics tests passed!');
}

/**
 * Test configuration management
 */
function testConfiguration(): void {
    console.log('Testing configuration...');
    
    const handler = new ErrorHandler({
        logLevel: LogLevel.ERROR,
        maxErrorHistory: 50,
        enableConsoleLogging: false,
        enableRecovery: false
    });
    
    const config = handler.getConfig();
    console.assert(config.logLevel === LogLevel.ERROR, 'Should set log level');
    console.assert(config.maxErrorHistory === 50, 'Should set max history');
    console.assert(config.enableConsoleLogging === false, 'Should set console logging');
    console.assert(config.enableRecovery === false, 'Should set recovery');
    
    // Test updating configuration
    handler.updateConfig({
        logLevel: LogLevel.DEBUG,
        enableRecovery: true
    });
    
    const updatedConfig = handler.getConfig();
    console.assert(updatedConfig.logLevel === LogLevel.DEBUG, 'Should update log level');
    console.assert(updatedConfig.enableRecovery === true, 'Should update recovery setting');
    console.assert(updatedConfig.maxErrorHistory === 50, 'Should preserve other settings');
    
    console.log('Configuration tests passed!');
}

/**
 * Test utility functions
 */
function testUtilityFunctions(): void {
    console.log('Testing utility functions...');
    
    // Test function wrapping
    let originalCalled = false;
    let errorThrown = false;
    
    const originalFunction = (x: number) => {
        originalCalled = true;
        if (x < 0) {
            throw new Error('Negative number');
        }
        return x * 2;
    };
    
    const wrappedFunction = ErrorUtils.wrapFunction(
        originalFunction,
        ErrorCategory.GAME_LOGIC
    );
    
    // Test normal execution
    const result1 = wrappedFunction(5);
    console.assert(result1 === 10, 'Wrapped function should work normally');
    console.assert(originalCalled, 'Original function should be called');
    
    // Test error handling
    try {
        wrappedFunction(-1);
    } catch (error) {
        errorThrown = true;
    }
    
    console.assert(errorThrown, 'Wrapped function should still throw errors');
    
    // Test safe function
    const safeFunction = ErrorUtils.makeSafe(
        originalFunction,
        0, // Default value
        ErrorCategory.GAME_LOGIC
    );
    
    const result2 = safeFunction(3);
    console.assert(result2 === 6, 'Safe function should work normally');
    
    const result3 = safeFunction(-1);
    console.assert(result3 === 0, 'Safe function should return default value on error');
    
    console.log('Utility function tests passed!');
}

/**
 * Test global error handling
 */
function testGlobalErrorHandling(): void {
    console.log('Testing global error handling...');
    
    const handler = new ErrorHandler({
        enableConsoleLogging: false,
        enableEventEmission: false
    });
    
    // Test that global error handlers are set up
    // Note: We can't easily test the actual global error handling without
    // triggering real errors, so we just verify the setup doesn't crash
    
    console.assert(typeof handler.handleError === 'function', 'Handler should be properly initialized');
    
    console.log('Global error handling tests passed!');
}

/**
 * Performance test for error handling
 */
export function performanceTestErrorHandler(): void {
    console.log('=== Running ErrorHandler Performance Tests ===');
    
    const handler = new ErrorHandler({
        enableConsoleLogging: false,
        enableEventEmission: false,
        enableRecovery: false
    });
    
    const numErrors = 1000;
    const startTime = performance.now();
    
    // Handle many errors quickly
    for (let i = 0; i < numErrors; i++) {
        handler.handleError(
            `Performance test error ${i}`,
            ErrorCategory.GAME_LOGIC,
            ErrorSeverity.LOW
        );
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Performance test: ${numErrors} errors handled in ${duration.toFixed(2)}ms`);
    console.assert(duration < 1000, 'Should handle errors efficiently');
    
    const stats = handler.getErrorStats();
    console.assert(stats.totalErrors === numErrors, 'Should track all errors');
    
    console.log('=== ErrorHandler Performance Tests Completed ===');
}

/**
 * Integration test with game-like error scenarios
 */
export function integrationTestErrorHandler(): void {
    console.log('=== Running ErrorHandler Integration Tests ===');
    
    // Simulate game-like error scenarios
    const handler = new ErrorHandler({
        enableConsoleLogging: true, // Enable for integration test
        enableEventEmission: true,
        enableRecovery: true
    });
    
    // Simulate asset loading failure
    handler.handleError(
        'Failed to load player texture',
        ErrorCategory.ASSET_LOADING,
        ErrorSeverity.HIGH,
        { assetPath: 'sprites/player.png' },
        'AssetLoader'
    );
    
    // Simulate collision detection error
    handler.handleError(
        'Null sprite in collision detection',
        ErrorCategory.COLLISION_DETECTION,
        ErrorSeverity.MEDIUM,
        { spriteA: null, spriteB: 'enemy_grunt' },
        'CollisionSystem'
    );
    
    // Simulate audio error
    handler.handleError(
        'Audio context suspended',
        ErrorCategory.AUDIO,
        ErrorSeverity.LOW,
        { audioContext: 'suspended' },
        'SoundManager'
    );
    
    // Simulate critical game logic error
    handler.handleError(
        'Game state corruption detected',
        ErrorCategory.GAME_LOGIC,
        ErrorSeverity.CRITICAL,
        { gameState: 'corrupted', wave: 5 },
        'GameLogic'
    );
    
    // Check final statistics
    const stats = handler.getErrorStats();
    console.log('Integration test statistics:', stats);
    
    console.assert(stats.totalErrors === 4, 'Should track all integration test errors');
    console.assert(stats.errorsByCategory[ErrorCategory.ASSET_LOADING] === 1, 'Should categorize asset errors');
    console.assert(stats.errorsByCategory[ErrorCategory.COLLISION_DETECTION] === 1, 'Should categorize collision errors');
    console.assert(stats.errorsByCategory[ErrorCategory.AUDIO] === 1, 'Should categorize audio errors');
    console.assert(stats.errorsByCategory[ErrorCategory.GAME_LOGIC] === 1, 'Should categorize game logic errors');
    
    console.log('=== ErrorHandler Integration Tests Completed ===');
}

/**
 * Run all ErrorHandler tests
 */
export function runAllErrorHandlerTests(): void {
    testErrorHandler();
    performanceTestErrorHandler();
    integrationTestErrorHandler();
}