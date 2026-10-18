#include "assets/rom.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#include "assets/zip.h"

/* MAME `robotron` set: current name, old name, CRC32. */
static const struct { const char *mame, *old; uint32_t crc; } files[12] = {
    { "2084_rom_1b_3005-13.e4", "robotron.sb1", 0x66c7d3ef },
    { "2084_rom_2b_3005-14.c4", "robotron.sb2", 0x5bc6c614 },
    { "2084_rom_3b_3005-15.a4", "robotron.sb3", 0xe99a82be },
    { "2084_rom_4b_3005-16.e5", "robotron.sb4", 0xafb1c561 },
    { "2084_rom_5b_3005-17.c5", "robotron.sb5", 0x62691e77 },
    { "2084_rom_6b_3005-18.a5", "robotron.sb6", 0xbd2c853d },
    { "2084_rom_7b_3005-19.e6", "robotron.sb7", 0x49ac400c },
    { "2084_rom_8b_3005-20.c6", "robotron.sb8", 0x3a96e88c },
    { "2084_rom_9b_3005-21.a6", "robotron.sb9", 0xb124367b },
    { "2084_rom_10b_3005-22.a7", "robotron.sba", 0x13797024 },
    { "2084_rom_11b_3005-23.c7", "robotron.sbb", 0x7e3c1b87 },
    { "2084_rom_12b_3005-24.e7", "robotron.sbc", 0x645d543e },
};

static uint32_t crc32(const uint8_t *p, size_t n)
{
    uint32_t c = 0xFFFFFFFFu;
    while (n--) {
        c ^= *p++;
        for (int k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
    }
    return c ^ 0xFFFFFFFFu;
}

static int read_exact(const char *path, uint8_t *buf, size_t n)
{
    FILE *f = fopen(path, "rb");
    if (!f) return -1;
    size_t got = fread(buf, 1, n, f);
    int extra = fgetc(f) != EOF;
    fclose(f);
    return got == n && !extra ? 0 : -2;
}

/* One 4 KB ROM from a folder or a zip, by either of its names. 0 ok, -1 missing, -2 wrong size, -3 bad zip. */
static int read_rom(const char *src, int is_zip, int i, uint8_t *buf, char *err, int errlen)
{
    for (int alt = 0; alt < 2; alt++) {
        const char *name = alt ? files[i].old : files[i].mame;
        if (is_zip) {
            uint8_t *data;
            size_t len;
            int rc = zip_read(src, name, &data, &len, err, errlen);
            if (rc == -1) return -3;
            if (rc == -2) continue;
            int ok = len == 4096;
            if (ok) memcpy(buf, data, 4096);
            free(data);
            return ok ? 0 : -2;
        }
        char path[1100];
        snprintf(path, sizeof path, "%s/%s", src, name);
        int rc = read_exact(path, buf, 4096);
        if (rc != -1) return rc;
    }
    return -1;
}

int rom_load(RomSet *rom, const char *src, char *err, int errlen)
{
    memset(rom, 0, sizeof *rom);
    struct stat st;
    if (stat(src, &st) != 0) {
        snprintf(err, (size_t)errlen, "%s: not found", src);
        return -1;
    }
    int is_zip = S_ISREG(st.st_mode);
    for (int i = 0; i < 12; i++) {
        int rc = read_rom(src, is_zip, i, rom->prog[i], err, errlen);
        if (rc == -3) return -1;
        if (rc == -1) {
            snprintf(err, (size_t)errlen, "%s: missing %s (or %s)", src, files[i].mame, files[i].old);
            return -1;
        }
        if (rc == -2) {
            snprintf(err, (size_t)errlen, "%s: %s is not a 4096-byte ROM", src, files[i].mame);
            return -1;
        }
        if (crc32(rom->prog[i], sizeof rom->prog[i]) != files[i].crc) {
            snprintf(err, (size_t)errlen, "%s: %s is the wrong ROM (CRC mismatch); the MAME 'robotron' set is required",
                     src, files[i].mame);
            return -1;
        }
    }
    rom->loaded = 1;
    return 0;
}

int rom_byte(const RomSet *rom, unsigned addr)
{
    if (!rom->loaded) return -1;
    if (addr < 0x9000) return rom->prog[addr >> 12][addr & 0xFFF];
    if (addr >= 0xD000 && addr <= 0xFFFF) return rom->prog[9 + ((addr - 0xD000) >> 12)][addr & 0xFFF];
    return -1;
}
