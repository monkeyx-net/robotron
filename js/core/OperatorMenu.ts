import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { gameState } from '../gameState';
import { BitmapFont } from './BitmapFont';
import { Operator, OperatorSettings, EXTRA_MAN_CHOICES } from './OperatorSettings';

/**
 * Replica of the ROM's GAME ADJUSTMENT page (operator menu), limited to the
 * adjustments that matter in a browser. Opened from the title/attract
 * screens with F2 (MAME's service key), '?', or gamepad Select+Start.
 *
 * Arcade controls: MOVE up/down selects an item, FIRE up/down changes its
 * value, ADVANCE saves and exits. Keyboard: W/S select, arrow up/down
 * change, Enter/Esc/F2/? exit. Gamepad: D-pad/left stick select, right
 * stick or Y/A change, Start exits.
 *
 * The exit fires on key/button release so the held key can't fall through
 * and start a game on the title screen.
 */

interface Item {
    label: string;
    /** current value as shown in the value column */
    value(s: OperatorSettings): string;
    /** ROM's descriptive label for the current value ('' = none) */
    note(s: OperatorSettings): string;
    step(s: OperatorSettings, dir: 1 | -1): void;
}

// pending one-shot actions, applied on exit (as the arcade does)
let restoreFactory = false;
let resetHighScores = false;

const clampStep = (v: number, dir: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v + dir));

const ITEMS: Item[] = [
    {
        label: 'EXTRA MAN EVERY',
        value: s => String(s.extraManEvery),
        note: s => ({ 0: 'NO EXTRA MEN', 20000: 'LIBERAL', 25000: 'RECOMMENDED', 30000: 'CONSERVATIVE', 50000: 'EXTRA CONSERVATIVE' } as Record<number, string>)[s.extraManEvery] ?? '',
        step: (s, dir) => {
            const i = EXTRA_MAN_CHOICES.indexOf(s.extraManEvery);
            s.extraManEvery = EXTRA_MAN_CHOICES[clampStep(i, dir, 0, EXTRA_MAN_CHOICES.length - 1)];
        },
    },
    {
        label: 'TURNS PER PLAYER',
        value: s => String(s.turnsPerPlayer),
        note: s => ({ 2: 'HIGH VOLUME ARCADES', 3: 'RECOMMENDED', 4: 'FOR WEAKER PLAYERS' } as Record<number, string>)[s.turnsPerPlayer] ?? '',
        step: (s, dir) => { s.turnsPerPlayer = clampStep(s.turnsPerPlayer, dir, 1, 20); },
    },
    {
        label: 'DIFFICULTY OF PLAY',
        value: s => String(s.difficulty),
        note: s => s.difficulty <= 2 ? 'EXTRA LIBERAL' : s.difficulty <= 4 ? 'LIBERAL'
            : s.difficulty === 5 ? 'RECOMMENDED' : s.difficulty <= 7 ? 'CONSERVATIVE' : 'EXTRA CONSERVATIVE',
        step: (s, dir) => { s.difficulty = clampStep(s.difficulty, dir, 0, 10); },
    },
    {
        label: 'LETTERS FOR HIGHEST SCORE NAME',
        value: s => String(s.highScoreLetters),
        note: s => s.highScoreLetters === 3 ? 'RECOMMENDED' : '',
        step: (s, dir) => { s.highScoreLetters = clampStep(s.highScoreLetters, dir, 3, 20); },
    },
    {
        label: 'RESTORE FACTORY SETTINGS',
        value: () => restoreFactory ? 'YES' : 'NO',
        note: () => '',
        step: (_s, dir) => { restoreFactory = dir > 0; },
    },
    {
        label: 'HIGH SCORE TABLE RESET',
        value: () => resetHighScores ? 'YES' : 'NO',
        note: () => '',
        step: (_s, dir) => { resetHighScores = dir > 0; },
    },
];

// layout (292 px wide canvas, ROM main font, 5 px glyphs)
const ROW_TOP = 44;
const ROW_H = 12;
const CURSOR_X = 2;
const LABEL_X = 12;
const VALUE_RIGHT = 188;
const NOTE_X = 193;
const GREEN = 0x44FF44;
const WHITE = 0xFFFFFF;
const YELLOW = 0xFFFF44;

const STICK = 0.5;
const REPEAT_DELAY_MS = 400;
const REPEAT_RATE_MS = 120;
const EXIT_KEYS = new Set(['Enter', 'NumpadEnter', 'Escape', 'F2']);

type PadState = { up: boolean; down: boolean; inc: boolean; dec: boolean; exit: boolean };

function readPads(): PadState {
    const st = { up: false, down: false, inc: false, dec: false, exit: false };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
        if (!pad) continue;
        const btn = (i: number) => !!pad.buttons[i]?.pressed;
        const ly = pad.axes[1] ?? 0;
        const ry = pad.axes[3] ?? 0;
        st.up ||= btn(12) || ly < -STICK;
        st.down ||= btn(13) || ly > STICK;
        st.inc ||= btn(3) || btn(15) || ry < -STICK;
        st.dec ||= btn(0) || btn(14) || ry > STICK;
        st.exit ||= btn(9);
    }
    return st;
}

/** True while a gamepad holds Select+Start (the menu's pad shortcut). */
export function padChordHeld(): boolean {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads.some(p => !!p && !!p.buttons[8]?.pressed && !!p.buttons[9]?.pressed);
}

/** True while any gamepad holds Select (start is deferred to its release). */
export function padSelectHeld(): boolean {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads.some(p => !!p && !!p.buttons[8]?.pressed);
}

/** Keyboard shortcut test: F2 or '?' (by produced character, any layout). */
export function isMenuKey(e: KeyboardEvent): boolean {
    return e.key === 'F2' || e.key === '?';
}

let container: PIXI.Container | null = null;
let rows: { value: PIXI.Container; note: PIXI.Container }[] = [];
let cursor: PIXI.Container | null = null;
let keyDown: ((e: KeyboardEvent) => void) | null = null;
let keyUp: ((e: KeyboardEvent) => void) | null = null;
let padRaf: number | null = null;

export function isOpen(): boolean { return container !== null; }

export function open(stage: PIXI.Container, onClose: () => void): void {
    if (container) return;
    gameState.currentGameState = 'OPERATOR_MENU';
    const draft: OperatorSettings = { ...Operator.get() };
    restoreFactory = false;
    resetHighScores = false;
    let sel = 0;

    container = new PIXI.Container();
    stage.addChild(container);
    // opaque backdrop: the arcade page is plain black, no arena border
    container.addChild(new PIXI.Graphics().rect(0, 0, GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT).fill(0x000000));

    const cx = GameConfig.GAME_WIDTH / 2;
    const text = (t: string, x: number, y: number, tint: number) => {
        const c = BitmapFont.createText(t, { tint });
        c.x = x; c.y = y;
        container!.addChild(c);
        return c;
    };
    const centered = (t: string, y: number, tint: number) => text(t, cx - BitmapFont.measure(t) / 2, y, tint);

    centered('GAME ADJUSTMENT', 16, WHITE);
    rows = ITEMS.map((item, i) => {
        const y = ROW_TOP + i * ROW_H;
        text(item.label, LABEL_X, y, GREEN);
        return { value: text('', 0, y, GREEN), note: text('', NOTE_X, y, GREEN) };
    });
    // '->' cursor drawn by hand: the ROM font's '>' glyph doesn't read as an arrow
    cursor = new PIXI.Graphics()
        .rect(0, 2, 3, 1).fill(WHITE)                            // '-'
        .rect(4, 0, 1, 1).rect(5, 1, 1, 1).rect(6, 2, 1, 1)      // '>'
        .rect(5, 3, 1, 1).rect(4, 4, 1, 1).fill(WHITE);
    cursor.x = CURSOR_X; cursor.y = ROW_TOP;
    container.addChild(cursor);
    centered('USE -MOVE- TO SELECT ADJUSTMENT', 176, WHITE);
    centered('USE -FIRE- LEVER TO CHANGE THE VALUE', 186, WHITE);
    centered('PRESS ADVANCE TO EXIT', 200, YELLOW);
    centered('KEYS  W S SELECT   ARROWS CHANGE   ENTER EXIT', 222, 0x888888);

    const redraw = () => {
        ITEMS.forEach((item, i) => {
            const v = item.value(draft);
            BitmapFont.setText(rows[i].value, v, { tint: GREEN });
            rows[i].value.x = VALUE_RIGHT - BitmapFont.measure(v);
            BitmapFont.setText(rows[i].note, item.note(draft), { tint: GREEN });
        });
        cursor!.y = ROW_TOP + sel * ROW_H;
    };
    redraw();

    const move = (dir: number) => { sel = (sel + dir + ITEMS.length) % ITEMS.length; redraw(); };
    const change = (dir: 1 | -1) => { ITEMS[sel].step(draft, dir); redraw(); };

    const finish = () => {
        if (restoreFactory) Operator.restoreFactory();
        else Operator.save(draft);
        if (resetHighScores) {
            Operator.clearHighScores();
            gameState.highScore = 0;
        }
        close();
        onClose();
    };

    // keyboard: exit is armed on press and fires on release
    let exitArmed = false;
    keyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (EXIT_KEYS.has(e.code) || EXIT_KEYS.has(e.key) || e.key === '?') {
            if (!e.repeat) exitArmed = true;
            return;
        }
        switch (e.code) {
            case 'KeyW': move(-1); break;
            case 'KeyS': move(1); break;
            case 'ArrowUp': case 'KeyI': case 'ArrowRight': case 'KeyL': change(1); break;
            case 'ArrowDown': case 'KeyK': case 'ArrowLeft': case 'KeyJ': change(-1); break;
        }
    };
    // keyup still propagates so the input manager sees every release
    keyUp = (e: KeyboardEvent) => {
        if (exitArmed && (EXIT_KEYS.has(e.code) || EXIT_KEYS.has(e.key) || e.key === '?' || e.code === 'Slash')) finish();
    };
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);

    // gamepad: edge-triggered with auto-repeat, seeded with the current
    // state so the Select+Start that opened the menu doesn't act on it
    let prev = readPads();
    let padExitArmed = false;
    let heldSince = 0, lastRepeat = 0;
    const poll = (now: number) => {
        padRaf = null;
        const cur = readPads();
        if (cur.exit && !prev.exit) padExitArmed = true;
        if (!cur.exit && prev.exit && padExitArmed) { finish(); return; }
        const sdir = cur.up ? -1 : cur.down ? 1 : 0;
        const vdir = cur.inc ? 1 : cur.dec ? -1 : 0;
        const psdir = prev.up ? -1 : prev.down ? 1 : 0;
        const pvdir = prev.inc ? 1 : prev.dec ? -1 : 0;
        if ((sdir && sdir !== psdir) || (vdir && vdir !== pvdir)) {
            if (sdir && sdir !== psdir) move(sdir);
            if (vdir && vdir !== pvdir) change(vdir as 1 | -1);
            heldSince = lastRepeat = now;
        } else if ((sdir || vdir) && now - heldSince >= REPEAT_DELAY_MS && now - lastRepeat >= REPEAT_RATE_MS) {
            if (sdir) move(sdir);
            if (vdir) change(vdir as 1 | -1);
            lastRepeat = now;
        }
        prev = cur;
        padRaf = requestAnimationFrame(poll);
    };
    padRaf = requestAnimationFrame(poll);
}

export function close(): void {
    if (padRaf !== null) { cancelAnimationFrame(padRaf); padRaf = null; }
    if (keyDown) { window.removeEventListener('keydown', keyDown, true); keyDown = null; }
    if (keyUp) { window.removeEventListener('keyup', keyUp, true); keyUp = null; }
    if (container) {
        container.parent?.removeChild(container);
        container.destroy({ children: true });
        container = null;
    }
    rows = [];
    cursor = null;
}

export const OperatorMenu = { open, close, isOpen, isMenuKey, padChordHeld, padSelectHeld };
