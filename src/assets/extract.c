#include "assets/extract.h"

#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#ifdef _WIN32
#include <direct.h>
#define mkdir(dir, mode) _mkdir(dir)
#endif

#define HEROES_ADDR 0xE495
#define HEROES_ROWS 10
#define WAVES_ADDR 0x2E24
#define WAVES 40
#define WAVE_FIELDS 9
#define PARAMS_ADDR 0x2C20   /* 12 tables x 43 bytes: header, min, max, waves 1-40 */
#define PARAM_TABLES 12
#define MERCY_ADDR 0x2B59    /* 4 waves x [spheroid drop, enforcer shot, grunt bound, floor] */
#define ELECTRODE_TABLE 0x2A4B /* rows of 10 waves: colour byte, palette byte, shape offset, ... */
#define ELECTRODE_BASE_PTR 0x3886 /* word: shape descriptors base ($3B05) */

static const char *const wave_fields[WAVE_FIELDS] = {
    "grunts", "electrodes", "mommies", "daddies", "mikeys", "hulks", "brains", "spheroids", "quarks",
};

static int mkdir_p(const char *path)
{
    char tmp[1100];
    snprintf(tmp, sizeof tmp, "%s", path);
    for (char *p = tmp + 1; *p; p++) {
        if (*p != '/') continue;
        *p = '\0';
        if (mkdir(tmp, 0755) && errno != EEXIST) return -1;
        *p = '/';
    }
    return mkdir(tmp, 0755) && errno != EEXIST ? -1 : 0;
}

/* Write `text` to <dir>/<name> through a temp file, so a failure leaves no partial file. */
static int write_file(const char *dir, const char *name, const char *text, char *err, int errlen)
{
    char path[1200], tmp[1210];
    snprintf(path, sizeof path, "%s/%s", dir, name);
    snprintf(tmp, sizeof tmp, "%s.tmp", path);
    FILE *f = fopen(tmp, "w");
    if (!f || fputs(text, f) < 0 || fclose(f)) {
        if (f) fclose(f);
        remove(tmp);
        snprintf(err, (size_t)errlen, "cannot write %s", path);
        return -1;
    }
#ifdef _WIN32
    remove(path); /* Windows rename() does not replace */
#endif
    if (rename(tmp, path)) {
        remove(tmp);
        snprintf(err, (size_t)errlen, "cannot replace %s", path);
        return -1;
    }
    return 0;
}

static int heroes_text(const RomSet *rom, char *out, size_t outlen, char *err, int errlen)
{
    size_t n = (size_t)snprintf(out, outlen,
        "# ROBOTRON HEROES factory list, from ROM $%04X (extracted; do not edit)\n"
        "# initials score\n", HEROES_ADDR);
    for (int r = 0; r < HEROES_ROWS; r++) {
        unsigned a = HEROES_ADDR + (unsigned)r * 7;
        char initials[4] = {0};
        for (int i = 0; i < 3; i++) {
            int c = rom_byte(rom, a + (unsigned)i);
            if (!((c >= 'A' && c <= 'Z') || c == ' ' || c == '.')) {
                snprintf(err, (size_t)errlen, "heroes row %d: bad initial byte $%02X", r + 1, c & 0xFF);
                return -1;
            }
            initials[i] = (char)c;
        }
        unsigned long score = 0;
        for (int i = 0; i < 4; i++) {
            int b = rom_byte(rom, a + 3 + (unsigned)i);
            if ((b >> 4) > 9 || (b & 15) > 9) {
                snprintf(err, (size_t)errlen, "heroes row %d: score is not BCD", r + 1);
                return -1;
            }
            score = score * 100 + (unsigned long)((b >> 4) * 10 + (b & 15));
        }
        n += (size_t)snprintf(out + n, outlen - n, "%s %lu\n", initials, score);
    }
    return 0;
}

static void waves_text(const RomSet *rom, char *out, size_t outlen)
{
    size_t n = (size_t)snprintf(out, outlen,
        "# Per-wave counts, from ROM $%04X (extracted; do not edit). Waves past 40 cycle 21-40.\n# wave",
        WAVES_ADDR);
    for (int f = 0; f < WAVE_FIELDS; f++) n += (size_t)snprintf(out + n, outlen - n, " %s", wave_fields[f]);
    n += (size_t)snprintf(out + n, outlen - n, "\n");
    for (int w = 0; w < WAVES; w++) {
        n += (size_t)snprintf(out + n, outlen - n, "%d", w + 1);
        for (int f = 0; f < WAVE_FIELDS; f++)
            n += (size_t)snprintf(out + n, outlen - n, " %d",
                                  rom_byte(rom, WAVES_ADDR + (unsigned)(f * WAVES + w)));
        n += (size_t)snprintf(out + n, outlen - n, "\n");
    }
}

static const char *const param_names[PARAM_TABLES] = {
    "gruntStepBound", "gruntStepFloor", "childCountBound", "enforcerShotTimer", "spheroidDropTimer",
    "hulkStepFrames", "brainMissileTimer", "brainStepFrames", "tankShotTimer", "tankShellSpeed",
    "quarkDropTimer", "quarkSpeed",
};

static void params_text(const RomSet *rom, char *out, size_t outlen)
{
    size_t n = (size_t)snprintf(out, outlen,
        "# Wave parameters $BE5C-$BE67, from ROM $%04X (extracted; do not edit)\n"
        "# name header min max wave1..wave40\n", PARAMS_ADDR);
    for (int t = 0; t < PARAM_TABLES; t++) {
        n += (size_t)snprintf(out + n, outlen - n, "%s", param_names[t]);
        for (int i = 0; i < 43; i++)
            n += (size_t)snprintf(out + n, outlen - n, " %d", rom_byte(rom, PARAMS_ADDR + (unsigned)(t * 43 + i)));
        n += (size_t)snprintf(out + n, outlen - n, "\n");
    }
    n += (size_t)snprintf(out + n, outlen - n,
        "# Mercy table, from ROM $%04X: wave spheroidDropTimer enforcerShotTimer gruntStepBound gruntStepFloor\n",
        MERCY_ADDR);
    for (int w = 0; w < 4; w++) {
        n += (size_t)snprintf(out + n, outlen - n, "mercy %d", w + 1);
        for (int i = 0; i < 4; i++)
            n += (size_t)snprintf(out + n, outlen - n, " %d", rom_byte(rom, MERCY_ADDR + (unsigned)(w * 4 + i)));
        n += (size_t)snprintf(out + n, outlen - n, "\n");
    }
}

/* Electrode looks for waves 1-10 ($2A21): palette entry and up to 3 frames of
   (width bytes, height, data pointer, hold); pixel data is row-major, 2 pixels
   a byte, high nibble left, lit where non-zero. */
static int electrodes_text(const RomSet *rom, char *out, size_t outlen, char *err, int errlen)
{
    size_t n = (size_t)snprintf(out, outlen,
        "# Electrode looks per wave (repeat every 10), from ROM $%04X / $%04X (extracted; do not edit)\n"
        "# look <wave> <palette entry>; frame <hold> <width px> <height>; then rows ('#' lit)\n",
        ELECTRODE_TABLE, ELECTRODE_BASE_PTR);
    unsigned base = (unsigned)(rom_byte(rom, ELECTRODE_BASE_PTR) << 8 | rom_byte(rom, ELECTRODE_BASE_PTR + 1));
    for (int w = 0; w < 10; w++) {
        int entry = rom_byte(rom, ELECTRODE_TABLE + 10 + (unsigned)w) & 0x0F;
        unsigned shape = base + (unsigned)rom_byte(rom, ELECTRODE_TABLE + 20 + (unsigned)w);
        n += (size_t)snprintf(out + n, outlen - n, "look %d %d\n", w + 1, entry);
        for (int f = 0; f < 3; f++) {
            unsigned d = shape + (unsigned)f * 5;
            int wb = rom_byte(rom, d), h = rom_byte(rom, d + 1);
            unsigned ptr = (unsigned)(rom_byte(rom, d + 2) << 8 | rom_byte(rom, d + 3));
            int hold = rom_byte(rom, d + 4);
            if (wb == 0) break;
            if (wb > 12 || h > 24 || hold == 0 || rom_byte(rom, ptr) < 0 || rom_byte(rom, ptr + (unsigned)(wb * h) - 1) < 0) {
                snprintf(err, (size_t)errlen, "electrode look %d frame %d: bad descriptor", w + 1, f);
                return -1;
            }
            n += (size_t)snprintf(out + n, outlen - n, "frame %d %d %d\n", hold, wb * 2, h);
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < wb * 2; x++) {
                    int byte = rom_byte(rom, ptr + (unsigned)(y * wb + x / 2));
                    int nib = x % 2 ? byte & 15 : byte >> 4;
                    if (n + 2 < outlen) out[n++] = nib ? '#' : '.';
                }
                if (n + 2 < outlen) out[n++] = '\n';
            }
            out[n] = '\0';
        }
    }
    return 0;
}

int extract_all(const RomSet *rom, const char *out_dir, char *err, int errlen)
{
    static char params[8192], electrodes[16384];
    char heroes[2048], waves[4096], data_dir[1100];
    if (!rom->loaded) {
        snprintf(err, (size_t)errlen, "no ROM loaded");
        return -1;
    }
    /* decode everything first, write only when it all checks out */
    if (heroes_text(rom, heroes, sizeof heroes, err, errlen)) return -1;
    waves_text(rom, waves, sizeof waves);
    params_text(rom, params, sizeof params);
    if (electrodes_text(rom, electrodes, sizeof electrodes, err, errlen)) return -1;

    snprintf(data_dir, sizeof data_dir, "%s/data", out_dir);
    if (mkdir_p(data_dir)) {
        snprintf(err, (size_t)errlen, "cannot create %s", data_dir);
        return -1;
    }
    if (write_file(data_dir, "heroes.txt", heroes, err, errlen)) return -1;
    if (write_file(data_dir, "waves.txt", waves, err, errlen)) return -1;
    if (write_file(data_dir, "waveparams.txt", params, err, errlen)) return -1;
    if (write_file(data_dir, "electrodes.txt", electrodes, err, errlen)) return -1;
    return 0;
}
