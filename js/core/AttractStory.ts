/**
 * Attract-mode story pages, in the style of the arcade's own (robotron-re
 * REVERSE.md Phase 21 "Attract cycle"): a bordered page under the
 * "ROBOTRON: 2084" header with paragraphs typed out a letter at a time in the
 * ROM font. Instead of the 1982 backstory they tell how this port came to be:
 * a remembered game, its ROM read back byte by byte, and its rebirth for the
 * web with an AI working alongside.
 */
import * as PIXI from 'pixi.js';
import { GameConfig } from '../config';
import { BitmapFont } from './BitmapFont';
import { ColorCycles } from './ColorCycles';

interface Paragraph { tint: number; lines: string[]; }
interface Page { border: number; header: number; paragraphs: Paragraph[]; }

const YELLOW = 0xFFFF44, RED = 0xFF4444, GREEN = 0x44FF44, CYAN = 0x44FFFF, MAGENTA = 0xFF44FF, ORANGE = 0xFF8800;
/** a paragraph whose text cycles like the arcade's palette entry A */
const CYCLING = -1;

const PAGES: Page[] = [
    { border: RED, header: CYAN, paragraphs: [
        { tint: YELLOW, lines: ['IN 1982 THE ARCADE GLOWED.', 'TWO JOYSTICKS. ONE HUMAN.', 'AN ENDLESS HORDE OF ROBOTRONS.'] },
        { tint: RED, lines: ['DECADES LATER ONLY A MEMORY REMAINED:', 'THE WAVES, THE SOUNDS, THE PANIC.'] },
    ] },
    { border: CYAN, header: MAGENTA, paragraphs: [
        { tint: GREEN, lines: ['THE MEMORY LED BACK TO THE BINARY:', '48 KILOBYTES OF 6809 CODE AND PIXELS.', 'NO SOURCE. NO MANUAL. ONLY BYTES.'] },
        { tint: ORANGE, lines: ['BYTE BY BYTE IT WAS READ BACK:', 'DISASSEMBLED, LABELED, AND PROBED', 'FRAME BY FRAME INSIDE MAME.'] },
    ] },
    { border: GREEN, header: YELLOW, paragraphs: [
        { tint: YELLOW, lines: ['THE GRUNTS, THE BRAINS, THE HULKS,', 'EVEN THE RANDOM NUMBER GENERATOR', 'GAVE UP THEIR SECRETS.'] },
        { tint: CYAN, lines: ['ALL 40 WAVES. EVERY TIMER.', '1000 OF 1000 RANDOM NUMBERS MATCHED.'] },
    ] },
    { border: MAGENTA, header: CYAN, paragraphs: [
        { tint: GREEN, lines: ['THEN THE GAME WAS BORN AGAIN', 'FOR THE WEB, CHECKED FRAME BY FRAME', 'AGAINST THE ORIGINAL MACHINE.'] },
        { tint: RED, lines: ['IN 2084 MAN BUILT MACHINES', 'THAT TURNED AGAINST HIM.'] },
        { tint: YELLOW, lines: ['IN 2026 A HUMAN WHO REMEMBERED', 'AND AN AI THAT COULD READ THE BYTES', 'WORKED TOGETHER TO SAVE THE GAME.'] },
    ] },
    { border: YELLOW, header: MAGENTA, paragraphs: [
        { tint: CYAN, lines: ['OVER 40 YEARS LATER', 'THE MISSION IS UNCHANGED:'] },
        { tint: CYCLING, lines: ['SAVE THE LAST HUMAN FAMILY!'] },
    ] },
];

const FRAMES_PER_CHAR = 2;
const HOLD_FRAMES = 240;
const HEADER_Y = 28, TEXT_X = 34, TEXT_Y = 50, LINE_H = 9, PARA_GAP = 9;
const TEXT = { tracking: 0 };

let container: PIXI.Container | null = null;
let tick: ((t: PIXI.Ticker) => void) | null = null;

function stop(): void {
    if (tick) { PIXI.Ticker.shared.remove(tick); tick = null; }
    if (container) { container.destroy({ children: true }); container = null; }
}

/** Lay out one page; returns each line's container, full text and tint, in typing order. */
function buildPage(page: Page, c: PIXI.Container): { box: PIXI.Container; text: string; tint: number }[] {
    const pf = GameConfig.PLAYFIELD;
    const border = new PIXI.Graphics()
        .rect(pf.LEFT - 1, pf.TOP - 2, pf.RIGHT - pf.LEFT + 2, pf.BOTTOM - pf.TOP + 4)
        .stroke({ width: 2, color: page.border, alignment: 1 });
    c.addChild(border);
    const header = BitmapFont.createText('ROBOTRON: 2084', { ...TEXT, tint: page.header });
    header.x = (GameConfig.GAME_WIDTH - BitmapFont.measure('ROBOTRON: 2084', TEXT)) / 2;
    header.y = HEADER_Y;
    c.addChild(header);
    const lines: { box: PIXI.Container; text: string; tint: number }[] = [];
    let y = TEXT_Y;
    for (const p of page.paragraphs) {
        for (const text of p.lines) {
            const box = new PIXI.Container();
            box.x = TEXT_X;
            box.y = y;
            c.addChild(box);
            lines.push({ box, text, tint: p.tint });
            y += LINE_H;
        }
        y += PARA_GAP;
    }
    return lines;
}

export const AttractStory = {
    /**
     * Type the pages out on `stage`, then call onDone. `stillValid` is polled
     * each frame; when it turns false (a game started) the pages are dropped.
     */
    play(stage: PIXI.Container, onDone: () => void, stillValid: () => boolean): void {
        stop();
        let pageIdx = -1, frames = 0, lines: ReturnType<typeof buildPage> = [], total = 0, shown = -1;
        const nextPage = (): boolean => {
            pageIdx++;
            if (container) { container.destroy({ children: true }); container = null; }
            if (pageIdx >= PAGES.length) return false;
            container = new PIXI.Container();
            container.zIndex = 900;
            stage.addChild(container);
            lines = buildPage(PAGES[pageIdx], container);
            total = lines.reduce((n, l) => n + l.text.length, 0);
            frames = 0; shown = -1;
            return true;
        };
        nextPage();
        tick = (t: PIXI.Ticker) => {
            if (!stillValid()) { stop(); return; }
            frames += t.deltaTime;
            const chars = Math.min(total, Math.floor(frames / FRAMES_PER_CHAR));
            if (chars !== shown) {
                shown = chars;
                let left = chars;
                for (const l of lines) {
                    const n = Math.max(0, Math.min(l.text.length, left));
                    left -= l.text.length;
                    BitmapFont.setText(l.box, l.text.slice(0, n), { ...TEXT, tint: l.tint === CYCLING ? 0xFFFFFF : l.tint });
                }
            }
            const a = ColorCycles.color(0xA) ?? 0xFFFFFF;
            for (const l of lines) if (l.tint === CYCLING) l.box.children.forEach(ch => { (ch as PIXI.Sprite).tint = a; });
            if (frames >= total * FRAMES_PER_CHAR + HOLD_FRAMES && !nextPage()) {
                stop();
                onDone();
            }
        };
        PIXI.Ticker.shared.add(tick);
    },

    stop,

    /** Widest line in pixels (for layout checks). */
    widest(): number {
        let w = 0;
        for (const p of PAGES) for (const para of p.paragraphs) for (const l of para.lines) w = Math.max(w, BitmapFont.measure(l, TEXT));
        return w;
    },
};
