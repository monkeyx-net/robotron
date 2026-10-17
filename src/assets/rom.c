#include "assets/rom.h"

#include <stdio.h>
#include <string.h>

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

int rom_load(RomSet *rom, const char *dir, char *err, int errlen)
{
    memset(rom, 0, sizeof *rom);
    for (int i = 0; i < 12; i++) {
        char path[1100];
        int rc = -1;
        for (int alt = 0; alt < 2 && rc == -1; alt++) {
            snprintf(path, sizeof path, "%s/%s", dir, alt ? files[i].old : files[i].mame);
            rc = read_exact(path, rom->prog[i], sizeof rom->prog[i]);
        }
        if (rc == -1) {
            snprintf(err, (size_t)errlen, "%s: missing %s (or %s)", dir, files[i].mame, files[i].old);
            return -1;
        }
        if (rc == -2) {
            snprintf(err, (size_t)errlen, "%s: not a 4096-byte ROM", path);
            return -1;
        }
        if (crc32(rom->prog[i], sizeof rom->prog[i]) != files[i].crc) {
            snprintf(err, (size_t)errlen, "%s: wrong ROM (CRC mismatch); the MAME 'robotron' set is required", path);
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
