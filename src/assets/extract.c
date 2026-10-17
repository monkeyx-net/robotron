#include "assets/extract.h"

#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>

#define HEROES_ADDR 0xE495
#define HEROES_ROWS 10
#define WAVES_ADDR 0x2E24
#define WAVES 40
#define WAVE_FIELDS 9

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

int extract_all(const RomSet *rom, const char *out_dir, char *err, int errlen)
{
    char heroes[2048], waves[4096], data_dir[1100];
    if (!rom->loaded) {
        snprintf(err, (size_t)errlen, "no ROM loaded");
        return -1;
    }
    /* decode everything first, write only when it all checks out */
    if (heroes_text(rom, heroes, sizeof heroes, err, errlen)) return -1;
    waves_text(rom, waves, sizeof waves);

    snprintf(data_dir, sizeof data_dir, "%s/data", out_dir);
    if (mkdir_p(data_dir)) {
        snprintf(err, (size_t)errlen, "cannot create %s", data_dir);
        return -1;
    }
    if (write_file(data_dir, "heroes.txt", heroes, err, errlen)) return -1;
    if (write_file(data_dir, "waves.txt", waves, err, errlen)) return -1;
    return 0;
}
