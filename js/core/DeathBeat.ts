/**
 * The player's death, as the ROM plays it (player_death_handler $70EF, which
 * calls $5E38 through the jump table at $5B4C; robotron-re REVERSE.md Phase 21
 * "Player death"). The playfield freezes where it is; the player is drawn as
 * a solid silhouette in palette entry 9 for 2 frames, then flashes a random
 * one of entries 0 (black), 1, 3, 7 every 6 frames, 10 times; then it fades
 * through the palette bytes $FF $F6 $AD $A4 $5B $52 $09 at 4 frames each and
 * is gone. MAME: the man is taken 104 frames after the hit (onDone).
 */
import * as PIXI from 'pixi.js';
import { ArcadeAtlas } from './ArcadeAtlas';
import { paletteRgb } from './ColorCycles';

const FIRST_FRAMES = 2;
const FLASHES = 10, FLASH_FRAMES = 6;
const FLASH_ENTRIES = [0x0, 0x1, 0x3, 0x7];   // $5EAE: $00 $11 $33 $77
const FADE = [0xFF, 0xF6, 0xAD, 0xA4, 0x5B, 0x52, 0x09];   // $5EB2
const FADE_FRAMES = 4;
const DONE_AT = 104;

let tick: ((t: PIXI.Ticker) => void) | null = null;
let overlay: PIXI.Sprite | null = null;

function entryRgb(entry: number): number | null {
    const pal = ArcadeAtlas.palette()[entry];
    if (!pal || entry === 0) return null;
    return (pal[0] << 16) | (pal[1] << 8) | pal[2];
}

function stop(): void {
    if (tick) { PIXI.Ticker.shared.remove(tick); tick = null; }
    if (overlay) { overlay.destroy(); overlay = null; }
}

export const DeathBeat = {
    /**
     * Play the death on `sprite` (hidden meanwhile) and call onDone at frame
     * 104. `stillValid` is polled each frame; when it turns false the beat is
     * dropped (e.g. the game was quit).
     */
    play(sprite: PIXI.Sprite, onDone: () => void, stillValid: () => boolean = () => true): void {
        stop();
        const parent = sprite.parent;
        if (parent && sprite.texture) {
            overlay = new PIXI.Sprite(ArcadeAtlas.silhouette(sprite.texture));
            overlay.anchor.copyFrom(sprite.anchor);
            overlay.position.copyFrom(sprite.position);
            parent.addChild(overlay);
        }
        sprite.visible = false;
        let frames = 0, slot = -1;
        const show = (rgb: number | null) => {
            if (!overlay) return;
            overlay.visible = rgb !== null;
            if (rgb !== null) overlay.tint = rgb;
        };
        show(entryRgb(0x9));
        tick = (t: PIXI.Ticker) => {
            if (!stillValid()) { stop(); return; }
            frames += t.deltaTime;
            const f = frames - FIRST_FRAMES;
            if (f >= 0 && f < FLASHES * FLASH_FRAMES) {
                const s = Math.floor(f / FLASH_FRAMES);
                // cosmetic: Math.random so the beat never perturbs the gameplay PRNG
                if (s !== slot) { slot = s; show(entryRgb(FLASH_ENTRIES[Math.floor(Math.random() * 4)])); }
            } else if (f >= FLASHES * FLASH_FRAMES) {
                const k = Math.floor((f - FLASHES * FLASH_FRAMES) / FADE_FRAMES);
                show(k < FADE.length ? paletteRgb(FADE[k]) : null);
            }
            if (frames >= DONE_AT) { stop(); onDone(); }
        };
        PIXI.Ticker.shared.add(tick);
    },

    stop,
};
