import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { gameState } from '../gameState';
import { BitmapFont } from './BitmapFont';
import { SoundManager } from '../soundManager';

/**
 * Arcade-style 3-initial high-score entry, rendered in-canvas with the ROM
 * alt font. Shown from the game-over path when the score makes the top-10
 * table (persisted in localStorage).
 *
 * Controls: up/down (W/S or arrows) cycle the letter, Enter/Space/fire
 * locks it in; after the third initial the table is saved. Gamepad: D-pad
 * or left stick up/down cycles (held = auto-repeat), A / Start / right
 * locks the letter in.
 */

export interface HighScoreRow { initials: string; score: number; }

const TABLE_KEY = 'robotronHighScoreTable';
const TABLE_MAX = 10;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ. ';

export function loadTable(): HighScoreRow[] {
    try {
        const raw = localStorage.getItem(TABLE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* corrupted table: start fresh */ }
    return [];
}

function saveTable(rows: HighScoreRow[]): void {
    localStorage.setItem(TABLE_KEY, JSON.stringify(rows.slice(0, TABLE_MAX)));
}

export function qualifies(score: number): boolean {
    if (score <= 0) return false;
    const t = loadTable();
    return t.length < TABLE_MAX || score > t[t.length - 1].score;
}

export function insertScore(initials: string, score: number): void {
    const t = loadTable();
    t.push({ initials, score });
    t.sort((a, b) => b.score - a.score);
    saveTable(t);
}

let container: PIXI.Container | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let padRaf: number | null = null;

const STICK_THRESHOLD = 0.5;
const REPEAT_DELAY_MS = 400;
const REPEAT_RATE_MS = 120;

type PadDir = 'up' | 'down' | 'confirm';

// Merged state across all connected pads (standard mapping).
function readPads(): Record<PadDir, boolean> {
    const state = { up: false, down: false, confirm: false };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
        if (!pad) continue;
        const btn = (i: number) => !!pad.buttons[i]?.pressed;
        const ly = pad.axes[1] ?? 0;
        const lx = pad.axes[0] ?? 0;
        state.up ||= btn(12) || ly < -STICK_THRESHOLD;
        state.down ||= btn(13) || ly > STICK_THRESHOLD;
        state.confirm ||= btn(0) || btn(9) || btn(15) || lx > STICK_THRESHOLD;
    }
    return state;
}

export function show(stage: PIXI.Container, score: number, onDone: () => void): void {
    hide();
    gameState.currentGameState = 'HIGH_SCORE_ENTRY';

    container = new PIXI.Container();
    container.zIndex = 2000;
    stage.addChild(container);

    const cx = GameConfig.GAME_WIDTH / 2;
    const addLine = (text: string, y: number, tint: number, font: 'main' | 'alt' = 'alt') => {
        const t = BitmapFont.createText(text, { font, tint });
        t.x = cx - BitmapFont.measure(text, { font }) / 2;
        t.y = y;
        container!.addChild(t);
        return t;
    };

    // Arcade: the initials screen plays its music once through (~24 s).
    SoundManager.play('highScoreEntry');

    addLine('GREAT SCORE', 50, 0xFF4444);
    addLine(String(score), 70, 0xFFFF44);
    addLine('ENTER YOUR INITIALS', 95, 0x44FFFF, 'main');

    const initials = [0, 0, 0];   // indices into LETTERS
    let slot = 0;
    const slotsRow = new PIXI.Container();
    slotsRow.y = 120;
    container.addChild(slotsRow);

    // Fixed slot positions so variable glyph widths never shift the
    // 2nd/3rd initials or the cursor.
    const SLOT_W = 14;
    const slotsX = cx - (SLOT_W * 3 - 6) / 2;
    const redraw = () => {
        slotsRow.removeChildren().forEach(c => c.destroy());
        for (let i = 0; i < 3; i++) {
            const ch = LETTERS[initials[i]];
            const t = BitmapFont.createText(ch, { font: 'alt', tint: 0xFFFF44 });
            t.x = slotsX + i * SLOT_W + (8 - BitmapFont.measure(ch, { font: 'alt' })) / 2;
            slotsRow.addChild(t);
        }
        // cursor under the active slot
        const g = new PIXI.Graphics();
        g.rect(slotsX + slot * SLOT_W, BitmapFont.lineHeight('alt') + 3, 8, 1).fill(0xFF4444);
        slotsRow.addChild(g);
    };
    redraw();

    const cycle = (step: number) => {
        initials[slot] = (initials[slot] + step + LETTERS.length) % LETTERS.length;
        redraw();
    };
    // Returns true when the entry finished (screen is torn down).
    const confirm = (): boolean => {
        slot++;
        if (slot >= 3) {
            insertScore(initials.map(i => LETTERS[i]).join(''), score);
            hide();
            onDone();
            return true;
        }
        redraw();
        return false;
    };

    keyHandler = (e: KeyboardEvent) => {
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyI') {
            cycle(1);
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'KeyK') {
            cycle(-1);
        } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyL' || e.code === 'ArrowRight') {
            if (confirm()) return;
        }
        e.preventDefault();
    };
    window.addEventListener('keydown', keyHandler);

    // Gamepad: edge-triggered, seeded with the current state so a fire
    // button still held from gameplay doesn't instantly lock in a letter.
    let prev = readPads();
    let heldSince = 0;
    let lastRepeat = 0;
    const pollPads = (now: number) => {
        padRaf = null;
        const cur = readPads();
        if (cur.confirm && !prev.confirm) {
            if (confirm()) return;
        }
        const dir = cur.up ? 1 : cur.down ? -1 : 0;
        const prevDir = prev.up ? 1 : prev.down ? -1 : 0;
        if (dir !== 0 && dir !== prevDir) {
            cycle(dir);
            heldSince = lastRepeat = now;
        } else if (dir !== 0 && now - heldSince >= REPEAT_DELAY_MS && now - lastRepeat >= REPEAT_RATE_MS) {
            cycle(dir);
            lastRepeat = now;
        }
        prev = cur;
        padRaf = requestAnimationFrame(pollPads);
    };
    padRaf = requestAnimationFrame(pollPads);
}

export function hide(): void {
    if (container) SoundManager.stop('highScoreEntry');
    if (padRaf !== null) {
        cancelAnimationFrame(padRaf);
        padRaf = null;
    }
    if (keyHandler) {
        window.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
    if (container) {
        container.parent?.removeChild(container);
        container.destroy({ children: true });
        container = null;
    }
}

export const HighScoreEntry = { show, hide, qualifies, insertScore, loadTable };
