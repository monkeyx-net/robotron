/**
 * PRNG golden test: js/core/Prng.ts must reproduce the ROM's prng_update
 * ($D6CD) exactly. tests/fixtures/prng_golden.txt holds DP $84/$85/$86 after
 * each of the first 1000 calls from a cold boot (seed $A55A), captured in
 * MAME by robotron-re tools/prng_probe.lua.
 *
 *   npm run test:prng   (or npm test)
 */
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// The package is CommonJS while js/ is ES-module TypeScript for Vite, so load
// Prng.ts (which has no imports) by stripping its types in place.
const src = readFileSync(new URL('../js/core/Prng.ts', import.meta.url), 'utf8');
const { ArcadePrng } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(src)));

const lines = readFileSync(new URL('./fixtures/prng_golden.txt', import.meta.url), 'utf8').trim().split('\n');
const prng = new ArcadePrng();
let failures = 0;
lines.forEach((line, i) => {
    const [a, hi, lo] = line.trim().split(/\s+/).map(h => parseInt(h, 16));
    const got = prng.step();
    if (got !== a || prng.byte85 !== hi || prng.byte86 !== lo) {
        if (failures++ < 5) {
            const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
            console.error(`call ${i + 1}: expected ${line.trim()}, got ${hex(got)} ${hex(prng.byte85)} ${hex(prng.byte86)}`);
        }
    }
});
if (failures) {
    console.error(`PRNG golden test FAILED: ${failures} of ${lines.length} calls differ`);
    process.exit(1);
}
console.log(`PRNG golden test passed: ${lines.length} calls match the ROM`);
