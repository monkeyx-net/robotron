#include "assets/png.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ---- checksums ---------------------------------------------------------- */

static uint32_t crc_table[256];

static void crc_init(void)
{
    if (crc_table[1]) return;
    for (uint32_t n = 0; n < 256; n++) {
        uint32_t c = n;
        for (int k = 0; k < 8; k++)
            c = c & 1 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
        crc_table[n] = c;
    }
}

static uint32_t crc32_update(uint32_t crc, const uint8_t *p, size_t n)
{
    crc_init();
    crc ^= 0xFFFFFFFFu;
    while (n--) crc = crc_table[(crc ^ *p++) & 0xFF] ^ (crc >> 8);
    return crc ^ 0xFFFFFFFFu;
}

static uint32_t adler32(const uint8_t *p, size_t n)
{
    uint32_t a = 1, b = 0;
    while (n--) {
        a = (a + *p++) % 65521u;
        b = (b + a) % 65521u;
    }
    return b << 16 | a;
}

static uint32_t be32(const uint8_t *p)
{
    return (uint32_t)p[0] << 24 | (uint32_t)p[1] << 16 | (uint32_t)p[2] << 8 | p[3];
}

/* ---- inflate (RFC 1951) ------------------------------------------------- */

typedef struct {
    const uint8_t *in;
    size_t in_len, in_pos;
    uint32_t bitbuf;
    int bitcnt;
    uint8_t *out;
    size_t out_len, out_cap;
    const char *err;
} Inflate;

#define MAXBITS 15

typedef struct {
    short count[MAXBITS + 1]; /* codes of each length */
    short symbol[288];        /* symbols ordered by code */
} Huffman;

static int bits(Inflate *s, int need)
{
    uint32_t val = s->bitbuf;
    while (s->bitcnt < need) {
        if (s->in_pos >= s->in_len) {
            s->err = "deflate stream truncated";
            return -1;
        }
        val |= (uint32_t)s->in[s->in_pos++] << s->bitcnt;
        s->bitcnt += 8;
    }
    s->bitbuf = val >> need;
    s->bitcnt -= need;
    return (int)(val & ((1u << need) - 1));
}

static int put(Inflate *s, uint8_t b)
{
    if (s->out_len == s->out_cap) {
        size_t cap = s->out_cap ? s->out_cap * 2 : 65536;
        uint8_t *p = realloc(s->out, cap);
        if (!p) {
            s->err = "out of memory";
            return -1;
        }
        s->out = p;
        s->out_cap = cap;
    }
    s->out[s->out_len++] = b;
    return 0;
}

static int stored(Inflate *s)
{
    s->bitbuf = 0; /* discard to byte boundary */
    s->bitcnt = 0;
    if (s->in_pos + 4 > s->in_len) {
        s->err = "stored block truncated";
        return -1;
    }
    unsigned len = s->in[s->in_pos] | s->in[s->in_pos + 1] << 8;
    unsigned nlen = s->in[s->in_pos + 2] | s->in[s->in_pos + 3] << 8;
    s->in_pos += 4;
    if (len != (~nlen & 0xFFFFu)) {
        s->err = "stored block length check failed";
        return -1;
    }
    if (s->in_pos + len > s->in_len) {
        s->err = "stored block truncated";
        return -1;
    }
    while (len--)
        if (put(s, s->in[s->in_pos++])) return -1;
    return 0;
}

/* Canonical Huffman decode, one bit at a time (inputs are small). */
static int decode(Inflate *s, const Huffman *h)
{
    int code = 0, first = 0, index = 0;
    for (int len = 1; len <= MAXBITS; len++) {
        int b = bits(s, 1);
        if (b < 0) return -1;
        code |= b;
        int count = h->count[len];
        if (code - count < first) return h->symbol[index + (code - first)];
        index += count;
        first += count;
        first <<= 1;
        code <<= 1;
    }
    s->err = "invalid Huffman code";
    return -1;
}

/* Build a decoder from code lengths. Returns 0, or -1 for an over-subscribed set.
   Incomplete sets are allowed (a single-code distance tree is legal). */
static int construct(Huffman *h, const short *length, int n)
{
    memset(h->count, 0, sizeof h->count);
    for (int sym = 0; sym < n; sym++) h->count[length[sym]]++;
    if (h->count[0] == n) return 0;
    int left = 1;
    for (int len = 1; len <= MAXBITS; len++) {
        left <<= 1;
        left -= h->count[len];
        if (left < 0) return -1;
    }
    short offs[MAXBITS + 1];
    offs[1] = 0;
    for (int len = 1; len < MAXBITS; len++) offs[len + 1] = offs[len] + h->count[len];
    for (int sym = 0; sym < n; sym++)
        if (length[sym]) h->symbol[offs[length[sym]]++] = (short)sym;
    return 0;
}

static const short len_base[29] = { 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
                                    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258 };
static const short len_extra[29] = { 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
                                     3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0 };
static const short dist_base[30] = { 1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
                                     257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
                                     8193, 12289, 16385, 24577 };
static const short dist_extra[30] = { 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
                                      7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13 };

static int codes(Inflate *s, const Huffman *lencode, const Huffman *distcode)
{
    for (;;) {
        int sym = decode(s, lencode);
        if (sym < 0) return -1;
        if (sym < 256) {
            if (put(s, (uint8_t)sym)) return -1;
        } else if (sym == 256) {
            return 0;
        } else {
            sym -= 257;
            if (sym >= 29) {
                s->err = "invalid length symbol";
                return -1;
            }
            int e = bits(s, len_extra[sym]);
            if (e < 0) return -1;
            int len = len_base[sym] + e;
            int dsym = decode(s, distcode);
            if (dsym < 0) return -1;
            if (dsym >= 30) {
                s->err = "invalid distance symbol";
                return -1;
            }
            e = bits(s, dist_extra[dsym]);
            if (e < 0) return -1;
            size_t dist = (size_t)dist_base[dsym] + (size_t)e;
            if (dist > s->out_len) {
                s->err = "distance too far back";
                return -1;
            }
            while (len--)
                if (put(s, s->out[s->out_len - dist])) return -1;
        }
    }
}

static int fixed(Inflate *s)
{
    static Huffman lencode, distcode;
    static int built;
    if (!built) {
        short lengths[288];
        int sym = 0;
        for (; sym < 144; sym++) lengths[sym] = 8;
        for (; sym < 256; sym++) lengths[sym] = 9;
        for (; sym < 280; sym++) lengths[sym] = 7;
        for (; sym < 288; sym++) lengths[sym] = 8;
        construct(&lencode, lengths, 288);
        for (sym = 0; sym < 30; sym++) lengths[sym] = 5;
        construct(&distcode, lengths, 30);
        built = 1;
    }
    return codes(s, &lencode, &distcode);
}

static int dynamic(Inflate *s)
{
    static const short order[19] = { 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 };
    int nlen = bits(s, 5), ndist = bits(s, 5), ncode = bits(s, 4);
    if (nlen < 0 || ndist < 0 || ncode < 0) return -1;
    nlen += 257;
    ndist += 1;
    ncode += 4;
    if (nlen > 286 || ndist > 30) {
        s->err = "bad dynamic block counts";
        return -1;
    }

    short lengths[320] = {0};
    for (int i = 0; i < ncode; i++) {
        int b = bits(s, 3);
        if (b < 0) return -1;
        lengths[order[i]] = (short)b;
    }
    Huffman lencode, distcode;
    if (construct(&lencode, lengths, 19)) {
        s->err = "bad code-length code";
        return -1;
    }

    int index = 0;
    while (index < nlen + ndist) {
        int sym = decode(s, &lencode);
        if (sym < 0) return -1;
        if (sym < 16) {
            lengths[index++] = (short)sym;
            continue;
        }
        short len = 0;
        int rep;
        if (sym == 16) {
            if (index == 0) {
                s->err = "repeat with no previous length";
                return -1;
            }
            len = lengths[index - 1];
            rep = bits(s, 2);
            if (rep < 0) return -1;
            rep += 3;
        } else if (sym == 17) {
            rep = bits(s, 3);
            if (rep < 0) return -1;
            rep += 3;
        } else {
            rep = bits(s, 7);
            if (rep < 0) return -1;
            rep += 11;
        }
        if (index + rep > nlen + ndist) {
            s->err = "too many code lengths";
            return -1;
        }
        while (rep--) lengths[index++] = len;
    }
    if (lengths[256] == 0) {
        s->err = "no end-of-block code";
        return -1;
    }
    if (construct(&lencode, lengths, nlen) || construct(&distcode, lengths + nlen, ndist)) {
        s->err = "bad literal/length or distance code";
        return -1;
    }
    return codes(s, &lencode, &distcode);
}

static int inflate_all(Inflate *s)
{
    int last;
    do {
        last = bits(s, 1);
        int type = bits(s, 2);
        if (last < 0 || type < 0) return -1;
        int rc = type == 0 ? stored(s) : type == 1 ? fixed(s) : type == 2 ? dynamic(s) : -1;
        if (type == 3) s->err = "invalid block type";
        if (rc) return -1;
    } while (!last);
    return 0;
}

/* ---- PNG ---------------------------------------------------------------- */

static int paeth(int a, int b, int c)
{
    int p = a + b - c;
    int pa = abs(p - a), pb = abs(p - b), pc = abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

int png_decode(const uint8_t *data, size_t size, Image *out, const char **err)
{
    static const uint8_t sig[8] = { 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };
    const char *e = NULL;
    uint8_t *idat = NULL, *raw = NULL;
    size_t idat_len = 0;
    uint32_t w = 0, h = 0;
    int seen_ihdr = 0, seen_iend = 0;
    memset(out, 0, sizeof *out);

    if (size < 8 || memcmp(data, sig, 8) != 0) { e = "not a PNG file"; goto fail; }

    for (size_t pos = 8; pos < size && !seen_iend;) {
        if (pos + 12 > size) { e = "chunk header truncated"; goto fail; }
        uint32_t len = be32(data + pos);
        const uint8_t *type = data + pos + 4;
        if (len > size - pos - 12) { e = "chunk truncated"; goto fail; }
        const uint8_t *body = data + pos + 8;
        if (crc32_update(0, type, len + 4) != be32(body + len)) { e = "chunk CRC mismatch"; goto fail; }

        if (!memcmp(type, "IHDR", 4)) {
            if (len != 13) { e = "bad IHDR"; goto fail; }
            w = be32(body);
            h = be32(body + 4);
            if (body[8] != 8 || body[9] != 6) { e = "only 8-bit RGBA PNGs are supported"; goto fail; }
            if (body[10] != 0 || body[11] != 0) { e = "unknown compression or filter method"; goto fail; }
            if (body[12] != 0) { e = "interlaced PNGs are not supported"; goto fail; }
            if (w == 0 || h == 0 || w > 16384 || h > 16384) { e = "unreasonable image size"; goto fail; }
            seen_ihdr = 1;
        } else if (!memcmp(type, "IDAT", 4)) {
            uint8_t *p = realloc(idat, idat_len + len);
            if (!p) { e = "out of memory"; goto fail; }
            idat = p;
            memcpy(idat + idat_len, body, len);
            idat_len += len;
        } else if (!memcmp(type, "IEND", 4)) {
            seen_iend = 1;
        } else if (!(type[0] & 0x20)) {
            e = "unknown critical chunk";
            goto fail;
        }
        pos += 12 + len;
    }
    if (!seen_ihdr || !seen_iend) { e = "missing IHDR or IEND"; goto fail; }

    /* zlib wrapper (RFC 1950) */
    if (idat_len < 6) { e = "image data too short"; goto fail; }
    if ((idat[0] & 0x0F) != 8 || ((idat[0] << 8) | idat[1]) % 31 != 0 || (idat[1] & 0x20)) {
        e = "bad zlib header";
        goto fail;
    }
    Inflate s = { .in = idat + 2, .in_len = idat_len - 6 };
    if (inflate_all(&s)) { e = s.err ? s.err : "deflate error"; free(s.out); goto fail; }
    raw = s.out;
    if (adler32(raw, s.out_len) != be32(idat + idat_len - 4)) { e = "zlib Adler-32 mismatch"; goto fail; }

    size_t stride = (size_t)w * 4;
    if (s.out_len != (stride + 1) * h) { e = "image data has the wrong size"; goto fail; }

    out->rgba = malloc(stride * h);
    if (!out->rgba) { e = "out of memory"; goto fail; }
    for (uint32_t y = 0; y < h; y++) {
        const uint8_t *src = raw + y * (stride + 1);
        uint8_t *dst = out->rgba + y * stride;
        const uint8_t *prev = y ? dst - stride : NULL;
        int filter = *src++;
        for (size_t x = 0; x < stride; x++) {
            int a = x >= 4 ? dst[x - 4] : 0;
            int b = prev ? prev[x] : 0;
            int c = prev && x >= 4 ? prev[x - 4] : 0;
            int pred;
            switch (filter) {
            case 0: pred = 0; break;
            case 1: pred = a; break;
            case 2: pred = b; break;
            case 3: pred = (a + b) / 2; break;
            case 4: pred = paeth(a, b, c); break;
            default: e = "bad row filter"; goto fail;
            }
            dst[x] = (uint8_t)(src[x] + pred);
        }
    }
    out->width = (int)w;
    out->height = (int)h;
    free(idat);
    free(raw);
    return 0;

fail:
    free(idat);
    free(raw);
    image_free(out);
    if (err) *err = e;
    return -1;
}

int png_load(const char *path, Image *out, const char **err)
{
    FILE *f = fopen(path, "rb");
    if (!f) {
        if (err) *err = "cannot open file";
        return -1;
    }
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    uint8_t *buf = n > 0 ? malloc((size_t)n) : NULL;
    if (!buf || fread(buf, 1, (size_t)n, f) != (size_t)n) {
        fclose(f);
        free(buf);
        if (err) *err = "cannot read file";
        return -1;
    }
    fclose(f);
    int rc = png_decode(buf, (size_t)n, out, err);
    free(buf);
    return rc;
}

void image_free(Image *img)
{
    free(img->rgba);
    img->rgba = NULL;
    img->width = img->height = 0;
}

/* ---- writer ------------------------------------------------------------- */

static void put32(uint8_t *p, uint32_t v)
{
    p[0] = (uint8_t)(v >> 24);
    p[1] = (uint8_t)(v >> 16);
    p[2] = (uint8_t)(v >> 8);
    p[3] = (uint8_t)v;
}

static int write_chunk(FILE *f, const char *type, const uint8_t *body, uint32_t len)
{
    uint8_t hdr[8];
    put32(hdr, len);
    memcpy(hdr + 4, type, 4);
    uint32_t crc = crc32_update(0, (const uint8_t *)type, 4);
    /* continue the CRC over the body: crc32_update pre/post-inverts, so undo that */
    crc_init();
    uint32_t c = crc ^ 0xFFFFFFFFu;
    for (uint32_t i = 0; i < len; i++) c = crc_table[(c ^ body[i]) & 0xFF] ^ (c >> 8);
    crc = c ^ 0xFFFFFFFFu;
    uint8_t tail[4];
    put32(tail, crc);
    return fwrite(hdr, 1, 8, f) != 8 || (len && fwrite(body, 1, len, f) != len) || fwrite(tail, 1, 4, f) != 4;
}

int png_write(const char *path, const uint8_t *rgba, int width, int height)
{
    size_t stride = (size_t)width * 4;
    size_t raw_len = (stride + 1) * (size_t)height;
    size_t blocks = raw_len / 65535 + 1;
    size_t z_len = 2 + raw_len + blocks * 5 + 4;
    uint8_t *raw = malloc(raw_len), *z = malloc(z_len);
    if (!raw || !z) {
        free(raw);
        free(z);
        return -1;
    }
    for (int y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        memcpy(raw + y * (stride + 1) + 1, rgba + y * stride, stride);
    }
    size_t o = 0;
    z[o++] = 0x78;
    z[o++] = 0x01;
    for (size_t pos = 0; pos < raw_len || pos == 0;) {
        size_t n = raw_len - pos > 65535 ? 65535 : raw_len - pos;
        z[o++] = pos + n == raw_len ? 1 : 0;
        z[o++] = (uint8_t)n;
        z[o++] = (uint8_t)(n >> 8);
        z[o++] = (uint8_t)~n;
        z[o++] = (uint8_t)(~n >> 8);
        memcpy(z + o, raw + pos, n);
        o += n;
        pos += n;
        if (n == 0) break;
    }
    put32(z + o, adler32(raw, raw_len));
    o += 4;

    uint8_t ihdr[13];
    put32(ihdr, (uint32_t)width);
    put32(ihdr + 4, (uint32_t)height);
    ihdr[8] = 8;  /* bit depth */
    ihdr[9] = 6;  /* RGBA */
    ihdr[10] = ihdr[11] = ihdr[12] = 0;

    static const uint8_t sig[8] = { 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };
    FILE *f = fopen(path, "wb");
    int bad = !f;
    if (f) {
        bad |= fwrite(sig, 1, 8, f) != 8;
        bad |= write_chunk(f, "IHDR", ihdr, 13);
        bad |= write_chunk(f, "IDAT", z, (uint32_t)o);
        bad |= write_chunk(f, "IEND", NULL, 0);
        bad |= fclose(f) != 0;
    }
    free(raw);
    free(z);
    return bad ? -1 : 0;
}
