/**
 * Arcade-authentic PRNG — direct port of the Robotron 2084 ROM routine at
 * $D6CD (`prng_update`, D036[1]), per robotron-re/REVERSE.md and
 * docs/architecture_web.md.
 *
 * State is three bytes, mirroring DP[$84] (accumulator), DP[$85] (hi),
 * DP[$86] (lo). The ROM steps it once per frame; behaviors read the state
 * bytes directly (e.g. grunt re-homing tests DP[$84] > $F8).
 *
 * All gameplay randomness must come from this generator so the port's
 * behavior statistics match the arcade.
 */
export class ArcadePrng {
    private accum = 0;   // DP[$84]
    private hi = 0xA5;   // DP[$85] — ROM seeds $A55A at main_game_entry
    private lo = 0x5A;   // DP[$86]

    /** Step once (call once per frame, like `JSR $D039`). Returns DP[$84]. */
    step(): number {
        let b = ((this.accum * 3) + 0x11) & 0xff;
        let a = ((this.lo >> 3) ^ this.lo) & 0xff;
        a = (a >> 1) & 0x7f;
        const carry = this.hi & 1;
        this.hi = ((this.hi >> 1) | ((a & 1) << 7)) & 0xff;
        this.lo = ((this.lo >> 1) | (carry << 7)) & 0xff;
        b = (b + this.lo + this.hi + (a & 1)) & 0xff;
        this.accum = b;
        return this.accum;
    }

    /** DP[$84] — main accumulator byte. */
    get byte84(): number { return this.accum; }
    /** DP[$85] — state hi byte (sign bit used for random axis choices). */
    get byte85(): number { return this.hi; }
    /** DP[$86] — state lo byte. */
    get byte86(): number { return this.lo; }

    /**
     * Bounded random 0..n-1 mirroring `prng_bounded` ($D042 / D036[4]):
     * the ROM masks/mods the accumulator against the caller's bound.
     * Steps the generator so consecutive calls differ.
     */
    bounded(n: number): number {
        if (n <= 0) return 0;
        return this.step() % n;
    }

    /** Random integer in [min, max] inclusive. */
    range(min: number, max: number): number {
        return min + this.bounded(max - min + 1);
    }

    /** Random float in [0,1) built from two steps (for legacy call sites). */
    float(): number {
        return ((this.step() << 8) | this.step()) / 65536;
    }

    /** True with probability p (0..1). */
    chance(p: number): boolean {
        return this.float() < p;
    }

    /** Reset to the ROM's power-on seed. */
    reset(): void {
        this.accum = 0;
        this.hi = 0xA5;
        this.lo = 0x5A;
    }
}

/** Shared gameplay PRNG instance (step once per frame from the main loop). */
export const prng = new ArcadePrng();
