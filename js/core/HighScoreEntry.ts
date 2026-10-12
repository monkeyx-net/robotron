import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { gameState } from '../gameState';
import { BitmapFont } from './BitmapFont';
import { SoundManager } from '../soundManager';
import { Operator } from './OperatorSettings';

/**
 * Arcade-style initials entry (3 letters; the operator LETTERS setting for a
 * new all-time #1 score), rendered in-canvas with the ROM
 * alt font. Shown from the game-over path when the score makes either
 * heroes table (persisted in localStorage).
 *
 * Controls: up/down (W/S or arrows) cycle the letter, Enter/Space/fire
 * locks it in; after the third initial the table is saved. Gamepad: D-pad
 * or left stick up/down cycles (held = auto-repeat), A / Start / right
 * locks the letter in.
 */

export interface HighScoreRow { initials: string; score: number; }

/*
 * The arcade keeps two tables (MAME, robotron-re REVERSE.md Phase 21 "Heroes
 * table"): ROBOTRON HEROES, 10 rows, which a factory restore fills with the
 * ROM's own list below, and ALL TIME HEROES, 37 rows of 10000 with no
 * initials. A score that beats the last row of either table earns initials
 * and goes into every table it beats. HIGH SCORE TABLE RESET (operator menu)
 * puts ROBOTRON HEROES back to the ROM list and leaves ALL TIME HEROES alone.
 */
const TABLE_KEY = 'robotronHighScoreTable';
const ALL_TIME_KEY = 'robotronAllTimeHeroes';
export const HEROES_MAX = 10;
export const ALL_TIME_MAX = 37;
const ROM_HEROES: HighScoreRow[] = [
    { initials: 'DRJ', score: 52127 }, { initials: 'LED', score: 50218 },
    { initials: 'EPJ', score: 41255 }, { initials: 'JER', score: 41250 },
    { initials: 'KID', score: 31920 }, { initials: 'MLG', score: 31919 },
    { initials: 'SSR', score: 26645 }, { initials: 'UNA', score: 26635 },
    { initials: 'JRS', score: 25250 }, { initials: 'CJM', score: 24110 },
];
const ALL_TIME_DEFAULT: HighScoreRow = { initials: '', score: 10000 };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ. ';

function readRows(key: string): HighScoreRow[] | null {
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const rows = JSON.parse(raw);
            if (Array.isArray(rows)) return rows.filter(r => r && typeof r.score === 'number');
        }
    } catch { /* corrupted or blocked storage: use the defaults */ }
    return null;
}

function writeRows(key: string, rows: HighScoreRow[]): void {
    try { localStorage.setItem(key, JSON.stringify(rows)); } catch { /* storage blocked */ }
}

const same = (a: HighScoreRow, b: HighScoreRow) => a.initials === b.initials && a.score === b.score;

/** Sort high to low; top up to `max` rows from `pad` (rows already there are not added twice). */
function fill(rows: HighScoreRow[], pad: HighScoreRow[], max: number): HighScoreRow[] {
    const missing = pad.filter(p => !rows.some(r => same(r, p)));
    return [...rows, ...missing].sort((a, b) => b.score - a.score).slice(0, max);
}

/** ROBOTRON HEROES: always 10 rows (older saves are topped up from the ROM list). */
export function loadTable(): HighScoreRow[] {
    return fill(readRows(TABLE_KEY) ?? [], ROM_HEROES, HEROES_MAX);
}

/** ALL TIME HEROES: always 37 rows. The first time, it takes over the scores
 *  saved before this table existed. */
export function loadAllTime(): HighScoreRow[] {
    let rows = readRows(ALL_TIME_KEY);
    if (!rows) {
        rows = (readRows(TABLE_KEY) ?? []).filter(r => !ROM_HEROES.some(d => same(r, d)));
        writeRows(ALL_TIME_KEY, rows);
    }
    const blank = new Array(ALL_TIME_MAX).fill(ALL_TIME_DEFAULT);
    const real = rows.filter(r => r.initials || r.score !== ALL_TIME_DEFAULT.score);
    return [...real, ...blank].sort((a, b) => b.score - a.score).slice(0, ALL_TIME_MAX);
}

export function qualifies(score: number): boolean {
    if (score <= 0) return false;
    return score > loadTable()[HEROES_MAX - 1].score || score > loadAllTime()[ALL_TIME_MAX - 1].score;
}

/** Would `score` take the all-time #1 spot? The arcade's operator LETTERS
 *  FOR HIGHEST SCORE NAME setting applies only to that entry. */
function isNewTopScore(score: number): boolean {
    return score > loadAllTime()[0].score;
}

export function insertScore(initials: string, score: number): void {
    const row = { initials, score };
    const allTime = loadAllTime();   // first, so an old save is taken over before the heroes table changes
    const heroes = loadTable();
    if (score > heroes[HEROES_MAX - 1].score) {
        writeRows(TABLE_KEY, [row, ...heroes].sort((a, b) => b.score - a.score).slice(0, HEROES_MAX));
    }
    if (score > allTime[ALL_TIME_MAX - 1].score) {
        const real = allTime.filter(r => r.initials || r.score !== ALL_TIME_DEFAULT.score);
        writeRows(ALL_TIME_KEY, [row, ...real].sort((a, b) => b.score - a.score).slice(0, ALL_TIME_MAX));
    }
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
    const letters = isNewTopScore(score) ? Operator.get().highScoreLetters : 3;
    addLine(letters > 3 ? 'ENTER YOUR NAME' : 'ENTER YOUR INITIALS', 95, 0x44FFFF, 'main');

    const initials = new Array(letters).fill(0);   // indices into LETTERS
    let slot = 0;
    const slotsRow = new PIXI.Container();
    slotsRow.y = 120;
    container.addChild(slotsRow);

    // Fixed slot positions so variable glyph widths never shift the
    // 2nd/3rd initials or the cursor.
    const SLOT_W = letters > 16 ? 12 : 14;
    const slotsX = cx - (SLOT_W * letters - 6) / 2;
    const redraw = () => {
        slotsRow.removeChildren().forEach(c => c.destroy());
        for (let i = 0; i < letters; i++) {
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
        if (slot >= letters) {
            insertScore(initials.map(i => LETTERS[i]).join('').trimEnd(), score);
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

export const HighScoreEntry = { show, hide, qualifies, insertScore, loadTable, loadAllTime };
