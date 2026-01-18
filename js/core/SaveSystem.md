# Save/Load System Documentation

## Overview

The Robotron 2084 save/load system provides comprehensive game state persistence using localStorage. It includes game progress saving, settings management, statistics tracking, and data import/export functionality.

## Features

### 🎮 Game State Saving
- Complete game state persistence (score, lives, wave, bonuses)
- Auto-save during gameplay
- Quick save/load with keyboard shortcuts (F5/F9)
- Manual save/load through UI

### ⚙️ Settings Management
- Audio settings (sound/music enabled, volume levels)
- Key bindings configuration
- Difficulty settings
- Visual effects preferences (screen shake, particles)

### 📊 Statistics Tracking
- Total games played and score
- Highest wave reached
- Humans rescued and enemies destroyed
- Play time tracking
- Win/loss statistics

### 💾 Data Management
- Export/import save data for backup
- Clear all data functionality
- Storage usage monitoring
- Version compatibility checking

## Usage

### Basic Save/Load Operations

```typescript
import { saveLoadManager } from './core/SaveLoadManager';

// Save current game
const success = saveLoadManager.saveCurrentGame();

// Load saved game
const loaded = saveLoadManager.loadSavedGame();

// Check if save data exists
const hasSave = saveLoadManager.hasSaveData();
```

### Settings Management

```typescript
// Save settings
saveLoadManager.saveSettings({
    soundEnabled: false,
    musicVolume: 0.5,
    difficulty: 'hard'
});

// Load settings
const settings = saveLoadManager.loadSettings();
```

### Statistics Access

```typescript
// Get game statistics
const stats = saveLoadManager.getStatistics();
console.log(`Games played: ${stats.totalGamesPlayed}`);
console.log(`High score: ${stats.totalScore}`);
```

## Keyboard Shortcuts

- **F5**: Quick Save (during gameplay)
- **F9**: Quick Load
- **F10**: Show Save/Load UI

## UI Integration

The save/load system includes a comprehensive UI accessible through:
- F10 key
- Game menu (when implemented)
- Event system: `gameEvents.emit({ type: 'ui:show_save_load' })`

### UI Features
- Save/load game state
- View and manage statistics
- Export/import save data
- Clear all data with confirmation
- Storage usage information

## Event System Integration

The save/load system emits various events for UI feedback:

```typescript
// Save/load events
gameEvents.on('save:game_saved', (event) => {
    console.log('Game saved successfully');
});

gameEvents.on('save:game_loaded', (event) => {
    console.log('Game loaded successfully');
});

// UI message events
gameEvents.on('ui:show_message', (event) => {
    const { message, type, duration } = event.data;
    // Display message to user
});
```

## Auto-Save Functionality

The system automatically saves:
- Every 30 seconds during gameplay
- On wave completion
- On game over
- On significant score milestones (every 10,000 points)

## Data Structure

### Save Data Format
```typescript
interface SaveData {
    version: string;
    timestamp: number;
    gameState: Partial<GameState>;
    settings: GameSettings;
    statistics: GameStatistics;
    achievements?: Achievement[];
}
```

### Game Settings
```typescript
interface GameSettings {
    soundEnabled: boolean;
    musicEnabled: boolean;
    soundVolume: number;
    musicVolume: number;
    keyBindings: KeyBindings;
    difficulty: 'easy' | 'normal' | 'hard';
    screenShakeEnabled: boolean;
    particleEffectsEnabled: boolean;
}
```

### Statistics
```typescript
interface GameStatistics {
    totalGamesPlayed: number;
    totalScore: number;
    highestWave: number;
    totalHumansRescued: number;
    totalEnemiesDestroyed: number;
    totalPlayTime: number;
    averageScore: number;
    gamesWon: number;
    lastPlayedDate: number;
}
```

## Error Handling

The system gracefully handles:
- localStorage unavailability (private browsing, etc.)
- Storage quota exceeded
- Corrupted save data
- Version mismatches
- Network issues (for future cloud save support)

## Testing

### Manual Testing in Browser Console

```javascript
// Run comprehensive tests
SaveLoadTest.runAllTests();

// Test quick save/load
SaveLoadTest.testQuickSaveLoad();

// Show save/load UI
SaveLoadTest.showSaveLoadUI();
```

### Test Coverage
- Basic save/load functionality
- Settings management
- Statistics tracking
- Data validation
- Error handling
- Storage information

## Browser Compatibility

- **localStorage**: Supported in all modern browsers
- **Storage Quota**: ~5-10MB in most browsers
- **Private Browsing**: Gracefully degrades to session-only storage

## Security Considerations

- Data is stored locally only (no network transmission)
- No sensitive information is stored
- Save data is validated before loading
- Version checking prevents incompatible data loading

## Future Enhancements

### Planned Features
- Cloud save synchronization
- Achievement system
- Save slot management (multiple saves)
- Compressed save data for larger games
- Save data encryption for competitive play

### Migration Strategy
- Version-based save data migration
- Backward compatibility for older saves
- Automatic data format upgrades

## Troubleshooting

### Common Issues

**Save/Load not working:**
- Check browser localStorage availability
- Verify not in private browsing mode
- Check storage quota (clear other site data if needed)

**Settings not persisting:**
- Ensure settings are saved after changes
- Check for JavaScript errors in console

**Statistics not updating:**
- Verify game events are being emitted
- Check event listener registration

### Debug Information

```javascript
// Check storage info
const storageInfo = saveLoadManager.getStorageInfo();
console.log('Storage available:', storageInfo.available);
console.log('Storage used:', storageInfo.used, 'bytes');

// Check save data
const saveInfo = saveLoadManager.getSaveInfo();
console.log('Has save data:', saveInfo.exists);
console.log('Save age:', saveInfo.age);
```

## Implementation Notes

- Uses singleton pattern for global access
- Event-driven architecture for loose coupling
- Comprehensive error handling and logging
- Modular design for easy extension
- TypeScript for type safety

The save/load system is production-ready and provides a solid foundation for game state persistence in the Robotron 2084 web replica.