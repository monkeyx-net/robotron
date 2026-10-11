/**
 * Live per-wave enemy pacing, driven by the ROM's wave parameters
 * (WaveParams.ts) and the operator DIFFICULTY OF PLAY.
 *
 * Grunts follow the ROM exactly (robotron-re REVERSE.md Phase 21, traced
 * and checked in MAME with tools/grunt_probe.lua):
 *
 *  - The grunt process runs every 4 frames ($79CE). Each grunt counts down
 *    and, on expiry, steps once and re-arms with prng_bounded($BE5C), i.e.
 *    a uniform 1..bound. So a smaller bound means faster grunts.
 *  - Every grunt death multiplies the bound by $E0/256 (×0.875), unless that
 *    would drop it below the floor $BE5D ($7A94).
 *  - A ramp process ($6A85) ticks after 270 frames, then every 225. While
 *    fewer than 30 grunts are alive it lowers floor/bound by 1/2 if anything
 *    scored since the last tick, else by 2/4 (the floor never below 1). Idle
 *    players get rushed.
 *  - A player death restores the floor to the wave's value and raises the
 *    bound to at least that ($7130).
 *  - At the start of each man on waves 1-4, a "mercy" table ($2B55) replaces
 *    the grunt, spheroid-drop and enforcer-shot values when the player is on their last man,
 *    or on waves 1-2 once they have lost a man ($6B1D).
 *
 * The other enemies read their timers straight from `params`, drawn with
 * prngLe() the way the ROM does (see enemies.ts and Phase 21).
 */
import { getWaveParams, WaveParams } from './WaveParams';
import { Operator } from './OperatorSettings';
import { prng } from './Prng';

/** frames between runs of the ROM grunt process */
export const GRUNT_TICK_FRAMES = 4;
const RAMP_FIRST_TICKS = 18, RAMP_TICKS = 15, RAMP_TICK_FRAMES = 15;

/** $2B55: [spheroidDropTimer $BE60, enforcerShotTimer $BE5F, bound $BE5C, floor $BE5D] for waves 1-4 */
const MERCY: Record<number, [number, number, number, number]> = {
    1: [38, 96, 30, 15],
    2: [38, 96, 25, 12],
    3: [36, 48, 20, 10],
    4: [30, 30, 15, 7],
};

let wave = 1;
let waveParams: WaveParams = getWaveParams(1);   // as set at wave init
let params: WaveParams = waveParams;             // live: wave init + mercy
let bound = params.gruntStepBound;
let floor = params.gruntStepFloor;
let scoreEvents = 0;      // DP[$F0]: INC in score_update, cleared by each ramp tick
let rampTicks = RAMP_FIRST_TICKS;
let rampFrames = 0;
let gruntClock = 0;

function applyMercy(reserve: number): void {
    const m = MERCY[wave];
    if (!m) return;
    const turns = Operator.get().turnsPerPlayer;
    if (reserve === 0 || (wave <= 2 && reserve < turns - 1)) {
        params = { ...params, spheroidDropTimer: m[0], enforcerShotTimer: m[1] };
        bound = m[2];
        floor = m[3];
    }
}

function restartRamp(): void {
    rampTicks = RAMP_FIRST_TICKS;
    rampFrames = 0;
    scoreEvents = 0;
}

export const WavePacing = {
    /**
     * Start of a wave. `reserve` = men left besides the one in play
     * (the ROM's lives byte).
     */
    beginWave(waveNumber: number, reserve: number): void {
        wave = Math.max(1, waveNumber);
        waveParams = params = getWaveParams(wave, Operator.get().difficulty, reserve);
        bound = params.gruntStepBound;
        floor = params.gruntStepFloor;
        applyMercy(reserve);
        restartRamp();
    },

    /** The player lost a man and play continues on this wave. */
    onPlayerDeath(reserve: number): void {
        params = waveParams;
        floor = waveParams.gruntStepFloor;
        if (bound < floor) bound = floor;
        applyMercy(reserve);
        restartRamp();
    },

    /** Any score award (the ROM counts calls to score_update). */
    noteScore(): void {
        scoreEvents++;
    },

    /** A grunt died (shot or electrode): the survivors speed up. */
    onGruntKilled(): void {
        const next = (bound * 0xE0) >> 8;
        if (next >= floor) bound = next;
    },

    /**
     * Advance the ramp process and the shared grunt clock. Call once per
     * update with `delta` in frames. Returns how many grunt-process ticks
     * fell due (usually 0 or 1).
     */
    update(delta: number, liveGrunts: number): number {
        rampFrames += delta;
        while (rampFrames >= RAMP_TICK_FRAMES) {
            rampFrames -= RAMP_TICK_FRAMES;
            if (--rampTicks > 0) continue;
            rampTicks = RAMP_TICKS;
            if (liveGrunts >= 30) continue;
            const [df, db] = scoreEvents ? [-1, -2] : [-2, -4];
            scoreEvents = 0;
            floor = Math.max(1, floor + df);
            bound = Math.max(floor, bound + db);
        }
        gruntClock += delta;
        let ticks = 0;
        while (gruntClock >= GRUNT_TICK_FRAMES) { gruntClock -= GRUNT_TICK_FRAMES; ticks++; }
        return ticks;
    },

    /** prng_bounded($BE5C): grunt-process ticks until a grunt's next step (1..bound). */
    nextGruntDelay(): number {
        return ((prng.step() * bound) >> 8) + 1;
    },

    /**
     * ROM $D6B6 (D036 $D03F): a PRNG byte halved until it is <= a, and at
     * least 1. Not uniform: small values are likelier. Every other enemy
     * timer is drawn with this.
     */
    prngLe(a: number): number {
        let r = prng.step();
        while (r > a) r >>= 1;
        return r || 1;
    },

    /** Children per spheroid/quark: ceil(prngLe($BE5E) / 2), so 1..ceil($BE5E/2). */
    childCount(): number {
        const n = this.prngLe(params.childCountBound);
        return (n >> 1) + (n & 1);
    },

    /** Current wave parameters (operator difficulty and mercy applied). */
    get params(): Readonly<WaveParams> { return params; },

    /** For debugging / tests. */
    snapshot() {
        return { wave, bound, floor, scoreEvents, rampTicks, difficulty: Operator.get().difficulty, params: { ...params } };
    },
};

if (typeof window !== 'undefined') (window as any).wavePacing = WavePacing;
