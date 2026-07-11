import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { gameState } from '../gameState';
import { BitmapFont } from './BitmapFont';

/**
 * Arcade-style 3-initial high-score entry, rendered in-canvas with the ROM
 * alt font. Shown from the game-over path when the score makes the top-10
 * table (persisted in localStorage).
 *
 * Controls: up/down (W/S or arrows) cycle the letter, Enter/Space/fire
 * locks it in; after the third initial the table is saved.
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

    addLine('GREAT SCORE', 50, 0xFF4444);
    addLine(String(score), 70, 0xFFFF44);
    addLine('ENTER YOUR INITIALS', 95, 0x44FFFF, 'main');

    const initials = [0, 0, 0];   // indices into LETTERS
    let slot = 0;
    const slotsRow = new PIXI.Container();
    slotsRow.y = 120;
    container.addChild(slotsRow);

    const redraw = () => {
        slotsRow.removeChildren().forEach(c => c.destroy());
        const text = initials.map(i => LETTERS[i]).join(' ');
        const t = BitmapFont.createText(text, { font: 'alt', tint: 0xFFFF44, tracking: 4 });
        t.x = cx - BitmapFont.measure(text, { font: 'alt', tracking: 4 }) / 2;
        slotsRow.addChild(t);
        // cursor under active slot
        const g = new PIXI.Graphics();
        const slotW = BitmapFont.measure('A', { font: 'alt' }) + 4 + 5;
        g.rect(t.x + slot * slotW, BitmapFont.lineHeight('alt') + 2, 8, 1).fill(0xFF4444);
        slotsRow.addChild(g);
    };
    redraw();

    keyHandler = (e: KeyboardEvent) => {
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyI') {
            initials[slot] = (initials[slot] + 1) % LETTERS.length;
            redraw();
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'KeyK') {
            initials[slot] = (initials[slot] + LETTERS.length - 1) % LETTERS.length;
            redraw();
        } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyL' || e.code === 'ArrowRight') {
            slot++;
            if (slot >= 3) {
                insertScore(initials.map(i => LETTERS[i]).join(''), score);
                hide();
                onDone();
                return;
            }
            redraw();
        }
        e.preventDefault();
    };
    window.addEventListener('keydown', keyHandler);
}

export function hide(): void {
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
