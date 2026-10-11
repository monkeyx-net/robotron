/**
 * Arcade operator adjustments (the ROM's GAME ADJUSTMENT page), persisted in
 * localStorage. Only the settings that affect play are kept; pricing,
 * bookkeeping and cabinet diagnostics have no meaning in a browser.
 *
 * Factory defaults are the ROM's "RECOMMENDED" values. See
 * OPERATOR_SETTINGS_PLAN.md for the value ranges captured from MAME.
 */

export interface OperatorSettings {
    version: 1;
    /** score interval for a bonus man; 0 = no extra men */
    extraManEvery: number;
    /** men per player at game start (1-20) */
    turnsPerPlayer: number;
    /** DIFFICULTY OF PLAY 0-10 (5 recommended) — see WaveParams.ts */
    difficulty: number;
    /** letters for the #1 all-time score name (3-20) */
    highScoreLetters: number;
}

export const EXTRA_MAN_CHOICES = [0, 20000, 25000, 30000, 50000];

export const FACTORY_SETTINGS: Readonly<OperatorSettings> = Object.freeze({
    version: 1,
    extraManEvery: 25000,
    turnsPerPlayer: 3,
    difficulty: 5,
    highScoreLetters: 3,
});

const STORAGE_KEY = 'robotronOperatorSettings';
/** high-score keys cleared by HIGH SCORE TABLE RESET */
const HIGH_SCORE_KEYS = ['robotronHighScoreTable', 'robotronHighScore'];

const clampInt = (v: unknown, lo: number, hi: number, dflt: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt;

/** Coerce anything (old/corrupt storage) into a valid settings object. */
function sanitize(raw: any): OperatorSettings {
    const f = FACTORY_SETTINGS;
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
        version: 1,
        extraManEvery: EXTRA_MAN_CHOICES.includes(r.extraManEvery) ? r.extraManEvery : f.extraManEvery,
        turnsPerPlayer: clampInt(r.turnsPerPlayer, 1, 20, f.turnsPerPlayer),
        difficulty: clampInt(r.difficulty, 0, 10, f.difficulty),
        highScoreLetters: clampInt(r.highScoreLetters, 3, 20, f.highScoreLetters),
    };
}

let current: OperatorSettings | null = null;

function load(): OperatorSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return sanitize(JSON.parse(raw));
    } catch { /* unreadable or blocked storage: use factory settings */ }
    return { ...FACTORY_SETTINGS };
}

export const Operator = {
    /** Current settings (loaded once, then cached). Treat as read-only. */
    get(): Readonly<OperatorSettings> {
        if (!current) current = load();
        return current;
    },

    save(next: OperatorSettings): void {
        current = sanitize(next);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* storage blocked */ }
    },

    restoreFactory(): void {
        this.save({ ...FACTORY_SETTINGS });
    },

    clearHighScores(): void {
        for (const key of HIGH_SCORE_KEYS) {
            try { localStorage.removeItem(key); } catch { /* storage blocked */ }
        }
    },
};
