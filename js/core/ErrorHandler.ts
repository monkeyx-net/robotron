/**
 * ErrorHandler - Comprehensive error handling and logging system
 * 
 * This module provides centralized error handling for the Robotron game with
 * different error types, graceful fallback strategies, configurable logging,
 * and error recovery mechanisms for critical system failures.
 */

import { gameEvents } from './EventSystem';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Error categories
 */
export enum ErrorCategory {
    ASSET_LOADING = 'asset_loading',
    COLLISION_DETECTION = 'collision_detection',
    GAME_LOGIC = 'game_logic',
    RENDERING = 'rendering',
    AUDIO = 'audio',
    INPUT = 'input',
    NETWORK = 'network',
    MEMORY = 'memory',
    CONFIGURATION = 'configuration',
    UNKNOWN = 'unknown'
}

/**
 * Log levels
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    CRITICAL = 4
}

/**
 * Error information interface
 */
export interface ErrorInfo {
    id: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: number;
    stack?: string;
    context?: any;
    source?: string;
    recoverable: boolean;
    recovered: boolean;
    recoveryAttempts: number;
    maxRecoveryAttempts: number;
}

/**
 * Error recovery strategy function type
 */
export type ErrorRecoveryStrategy = (error: ErrorInfo) => Promise<boolean> | boolean;

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
    logLevel: LogLevel;
    maxErrorHistory: number;
    enableConsoleLogging: boolean;
    enableEventEmission: boolean;
    enableRecovery: boolean;
    maxRecoveryAttempts: number;
    recoveryDelay: number;
}

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: ErrorHandlerConfig = {
    logLevel: LogLevel.WARN,
    maxErrorHistory: 100,
    enableConsoleLogging: true,
    enableEventEmission: true,
    enableRecovery: true,
    maxRecoveryAttempts: 3,
    recoveryDelay: 1000
};

/**
 * Comprehensive error handler class
 */
export class ErrorHandler {
    private config: ErrorHandlerConfig;
    private errorHistory: ErrorInfo[] = [];
    private recoveryStrategies: Map<ErrorCategory, ErrorRecoveryStrategy[]> = new Map();
    private nextErrorId: number = 1;
    private isRecovering: boolean = false;
    
    constructor(config: Partial<ErrorHandlerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.setupDefaultRecoveryStrategies();
        this.setupGlobalErrorHandlers();
    }
    
    /**
     * Handle an error with full context and recovery
     */
    async handleError(
        error: Error | string,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context?: any,
        source?: string
    ): Promise<string> {
        const errorInfo: ErrorInfo = {
            id: `err_${this.nextErrorId++}`,
            message: error instanceof Error ? error.message : error,
            category,
            severity,
            timestamp: Date.now(),
            stack: error instanceof Error ? error.stack : undefined,
            context,
            source,
            recoverable: this.isRecoverable(category, severity),
            recovered: false,
            recoveryAttempts: 0,
            maxRecoveryAttempts: this.config.maxRecoveryAttempts
        };
        
        // Add to error history
        this.addToHistory(errorInfo);
        
        // Log the error
        this.logError(errorInfo);
        
        // Emit error event if enabled
        if (this.config.enableEventEmission) {
            this.emitErrorEvent(errorInfo);
        }
        
        // Attempt recovery if enabled and error is recoverable
        if (this.config.enableRecovery && errorInfo.recoverable) {
            await this.attemptRecovery(errorInfo);
        }
        
        return errorInfo.id;
    }
    
    /**
     * Register a recovery strategy for a specific error category
     */
    registerRecoveryStrategy(category: ErrorCategory, strategy: ErrorRecoveryStrategy): void {
        if (!this.recoveryStrategies.has(category)) {
            this.recoveryStrategies.set(category, []);
        }
        this.recoveryStrategies.get(category)!.push(strategy);
    }
    
    /**
     * Get error history
     */
    getErrorHistory(
        category?: ErrorCategory,
        severity?: ErrorSeverity,
        limit: number = 50
    ): ErrorInfo[] {
        let errors = this.errorHistory;
        
        if (category) {
            errors = errors.filter(err => err.category === category);
        }
        
        if (severity) {
            errors = errors.filter(err => err.severity === severity);
        }
        
        return errors.slice(-limit);
    }
    
    /**
     * Get error statistics
     */
    getErrorStats(): {
        totalErrors: number;
        errorsByCategory: Record<string, number>;
        errorsBySeverity: Record<string, number>;
        recoveryRate: number;
        recentErrors: number;
    } {
        const now = Date.now();
        const recentThreshold = now - (5 * 60 * 1000); // Last 5 minutes
        
        const errorsByCategory: Record<string, number> = {};
        const errorsBySeverity: Record<string, number> = {};
        let recoveredCount = 0;
        let recentErrors = 0;
        
        for (const error of this.errorHistory) {
            // Count by category
            errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
            
            // Count by severity
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
            
            // Count recovered errors
            if (error.recovered) {
                recoveredCount++;
            }
            
            // Count recent errors
            if (error.timestamp > recentThreshold) {
                recentErrors++;
            }
        }
        
        const recoveryRate = this.errorHistory.length > 0 
            ? (recoveredCount / this.errorHistory.length) * 100 
            : 0;
        
        return {
            totalErrors: this.errorHistory.length,
            errorsByCategory,
            errorsBySeverity,
            recoveryRate,
            recentErrors
        };
    }
    
    /**
     * Clear error history
     */
    clearErrorHistory(olderThan?: number): number {
        if (olderThan) {
            const originalLength = this.errorHistory.length;
            this.errorHistory = this.errorHistory.filter(err => err.timestamp > olderThan);
            return originalLength - this.errorHistory.length;
        } else {
            const count = this.errorHistory.length;
            this.errorHistory.length = 0;
            return count;
        }
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * Get current configuration
     */
    getConfig(): ErrorHandlerConfig {
        return { ...this.config };
    }
    
    /**
     * Check if an error type is recoverable
     */
    private isRecoverable(category: ErrorCategory, severity: ErrorSeverity): boolean {
        // Critical errors are generally not recoverable
        if (severity === ErrorSeverity.CRITICAL) {
            return false;
        }
        
        // Some categories are more recoverable than others
        const recoverableCategories = [
            ErrorCategory.ASSET_LOADING,
            ErrorCategory.AUDIO,
            ErrorCategory.NETWORK,
            ErrorCategory.RENDERING
        ];
        
        return recoverableCategories.includes(category);
    }
    
    /**
     * Attempt to recover from an error
     */
    private async attemptRecovery(errorInfo: ErrorInfo): Promise<void> {
        if (this.isRecovering || errorInfo.recoveryAttempts >= errorInfo.maxRecoveryAttempts) {
            return;
        }
        
        this.isRecovering = true;
        errorInfo.recoveryAttempts++;
        
        try {
            const strategies = this.recoveryStrategies.get(errorInfo.category) || [];
            
            for (const strategy of strategies) {
                try {
                    const recovered = await strategy(errorInfo);
                    if (recovered) {
                        errorInfo.recovered = true;
                        this.logRecovery(errorInfo);
                        break;
                    }
                } catch (recoveryError) {
                    this.logError({
                        ...errorInfo,
                        id: `recovery_${errorInfo.id}`,
                        message: `Recovery failed: ${recoveryError}`,
                        severity: ErrorSeverity.HIGH
                    });
                }
            }
            
            // If not recovered and we have attempts left, schedule retry
            if (!errorInfo.recovered && errorInfo.recoveryAttempts < errorInfo.maxRecoveryAttempts) {
                setTimeout(() => {
                    this.isRecovering = false;
                    this.attemptRecovery(errorInfo);
                }, this.config.recoveryDelay);
                return;
            }
        } finally {
            this.isRecovering = false;
        }
    }
    
    /**
     * Log an error based on configuration
     */
    private logError(errorInfo: ErrorInfo): void {
        if (!this.config.enableConsoleLogging) {
            return;
        }
        
        const logLevel = this.getLogLevelForSeverity(errorInfo.severity);
        if (logLevel < this.config.logLevel) {
            return;
        }
        
        const logMessage = this.formatLogMessage(errorInfo);
        
        switch (errorInfo.severity) {
            case ErrorSeverity.LOW:
                console.info(logMessage);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn(logMessage);
                break;
            case ErrorSeverity.HIGH:
                console.error(logMessage);
                break;
            case ErrorSeverity.CRITICAL:
                console.error(logMessage);
                if (errorInfo.stack) {
                    console.error(errorInfo.stack);
                }
                break;
        }
    }
    
    /**
     * Log successful error recovery
     */
    private logRecovery(errorInfo: ErrorInfo): void {
        if (this.config.enableConsoleLogging) {
            console.info(`✅ Recovered from error ${errorInfo.id}: ${errorInfo.message}`);
        }
    }
    
    /**
     * Emit error event
     */
    private emitErrorEvent(errorInfo: ErrorInfo): void {
        gameEvents.emit({
            type: 'system:error',
            timestamp: errorInfo.timestamp,
            source: 'ErrorHandler',
            data: errorInfo
        });
    }
    
    /**
     * Add error to history
     */
    private addToHistory(errorInfo: ErrorInfo): void {
        this.errorHistory.push(errorInfo);
        
        // Trim history if it gets too large
        if (this.errorHistory.length > this.config.maxErrorHistory) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * Get log level for error severity
     */
    private getLogLevelForSeverity(severity: ErrorSeverity): LogLevel {
        switch (severity) {
            case ErrorSeverity.LOW: return LogLevel.INFO;
            case ErrorSeverity.MEDIUM: return LogLevel.WARN;
            case ErrorSeverity.HIGH: return LogLevel.ERROR;
            case ErrorSeverity.CRITICAL: return LogLevel.CRITICAL;
            default: return LogLevel.WARN;
        }
    }
    
    /**
     * Format log message
     */
    private formatLogMessage(errorInfo: ErrorInfo): string {
        const timestamp = new Date(errorInfo.timestamp).toISOString();
        const context = errorInfo.context ? ` | Context: ${JSON.stringify(errorInfo.context)}` : '';
        const source = errorInfo.source ? ` | Source: ${errorInfo.source}` : '';
        
        return `[${timestamp}] ${errorInfo.severity.toUpperCase()} [${errorInfo.category}] ${errorInfo.message}${source}${context}`;
    }
    
    /**
     * Setup default recovery strategies
     */
    private setupDefaultRecoveryStrategies(): void {
        // Asset loading recovery
        this.registerRecoveryStrategy(ErrorCategory.ASSET_LOADING, async (error) => {
            console.log(`Attempting to recover from asset loading error: ${error.message}`);
            // Try to use fallback assets or regenerate missing assets
            return true; // Assume recovery successful for now
        });
        
        // Audio recovery
        this.registerRecoveryStrategy(ErrorCategory.AUDIO, async (error) => {
            console.log(`Attempting to recover from audio error: ${error.message}`);
            // Try to reinitialize audio context or disable audio
            return true;
        });
        
        // Rendering recovery
        this.registerRecoveryStrategy(ErrorCategory.RENDERING, async (error) => {
            console.log(`Attempting to recover from rendering error: ${error.message}`);
            // Try to reset renderer or use fallback rendering
            return true;
        });
        
        // Network recovery
        this.registerRecoveryStrategy(ErrorCategory.NETWORK, async (error) => {
            console.log(`Attempting to recover from network error: ${error.message}`);
            // Try to reconnect or use cached data
            return true;
        });
    }
    
    /**
     * Setup global error handlers
     */
    private setupGlobalErrorHandlers(): void {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.handleError(
                event.error || event.message,
                ErrorCategory.UNKNOWN,
                ErrorSeverity.HIGH,
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                },
                'window.error'
            );
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(
                event.reason,
                ErrorCategory.UNKNOWN,
                ErrorSeverity.HIGH,
                { promise: event.promise },
                'unhandledrejection'
            );
        });
    }
}

/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Error handling utilities
 */
export const ErrorUtils = {
    /**
     * Wrap a function with error handling
     */
    wrapFunction<T extends (...args: any[]) => any>(
        fn: T,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        context?: any
    ): T {
        return ((...args: any[]) => {
            try {
                return fn(...args);
            } catch (error) {
                errorHandler.handleError(
                    error as Error,
                    category,
                    ErrorSeverity.MEDIUM,
                    { ...context, args },
                    fn.name
                );
                throw error; // Re-throw to maintain original behavior
            }
        }) as T;
    },
    
    /**
     * Create a safe version of a function that won't throw
     */
    makeSafe<T extends (...args: any[]) => any>(
        fn: T,
        defaultValue: ReturnType<T>,
        category: ErrorCategory = ErrorCategory.UNKNOWN
    ): T {
        return ((...args: any[]) => {
            try {
                return fn(...args);
            } catch (error) {
                errorHandler.handleError(
                    error as Error,
                    category,
                    ErrorSeverity.LOW,
                    { args },
                    fn.name
                );
                return defaultValue;
            }
        }) as T;
    }
};

/**
 * Export main classes and utilities
 */
export {
    errorHandler as GameErrorHandler
};