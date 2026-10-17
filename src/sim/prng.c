#include "sim/prng.h"

void prng_reset(Prng *p)
{
    p->accum = 0;
    p->hi = 0xA5;
    p->lo = 0x5A;
}

/*
 *   B = $84*3 + $11
 *   A = ($86 >> 3) ^ $86; LSRA          ; carry = feedback bit
 *   ROR $85; ROR $86                     ; 16-bit shift, feedback into $85 bit 7
 *   ADDB $86; ADCB $85                   ; carry from the ADDB
 */
uint8_t prng_step(Prng *p)
{
    unsigned b = (p->accum * 3u + 0x11u) & 0xFFu;
    unsigned feedback = ((p->lo >> 3) ^ p->lo) & 1u;
    unsigned hi_out = p->hi & 1u;
    p->hi = (uint8_t)((p->hi >> 1) | (feedback << 7));
    p->lo = (uint8_t)((p->lo >> 1) | (hi_out << 7));
    unsigned sum = b + p->lo;
    p->accum = (uint8_t)(((sum & 0xFFu) + p->hi + (sum >> 8)) & 0xFFu);
    return p->accum;
}

int prng_bounded(Prng *p, int n)
{
    if (n <= 0) return 0;
    return prng_step(p) % n;
}
