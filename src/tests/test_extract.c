/*
 * Extractor check (needs the user's ROM set, so it runs only when CMake finds
 * one): extract into a temp dir, then compare
 *   - heroes.txt with the ROM's factory list as the web build has it, and
 *   - waves.txt with js/waveTable.ts, all 40 waves x 9 counts.
 *
 *   test_extract <rom dir> <repo root>
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "assets/extract.h"
#include "assets/rom.h"

static int failures;
#define CHECK(cond, ...)                                                       \
    do {                                                                       \
        if (!(cond)) {                                                         \
            failures++;                                                        \
            fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__);               \
            fprintf(stderr, __VA_ARGS__);                                      \
            fputc('\n', stderr);                                               \
        }                                                                      \
    } while (0)

static char *slurp(const char *path)
{
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *s = malloc((size_t)n + 1);
    if (s && fread(s, 1, (size_t)n, f) == (size_t)n) s[n] = '\0';
    else { free(s); s = NULL; }
    fclose(f);
    return s;
}

/* Values of `field: N` in waveTable.ts, in file order (the interface lines have no number). */
static int web_values(const char *src, const char *field, int *out, int max)
{
    char key[32];
    int n = 0;
    snprintf(key, sizeof key, "%s:", field);
    for (const char *p = strstr(src, key); p && n < max; p = strstr(p + 1, key)) {
        int v;
        if (sscanf(p + strlen(key), " %d", &v) == 1) out[n++] = v;
    }
    return n;
}

int main(int argc, char **argv)
{
    if (argc < 3) {
        fprintf(stderr, "usage: %s <rom dir> <repo root>\n", argv[0]);
        return 2;
    }
    static RomSet rom;
    char err[512], dir[] = "/tmp/robotron_extract_XXXXXX", path[1100];
    if (rom_load(&rom, argv[1], err, sizeof err)) {
        fprintf(stderr, "%s\n", err);
        return 1;
    }
    if (!mkdtemp(dir)) return 1;
    CHECK(extract_all(&rom, dir, err, sizeof err) == 0, "extract_all: %s", err);

    /* heroes */
    static const struct { const char *i; unsigned s; } heroes[10] = {
        { "DRJ", 52127 }, { "LED", 50218 }, { "EPJ", 41255 }, { "JER", 41250 }, { "KID", 31920 },
        { "MLG", 31919 }, { "SSR", 26645 }, { "UNA", 26635 }, { "JRS", 25250 }, { "CJM", 24110 },
    };
    snprintf(path, sizeof path, "%s/data/heroes.txt", dir);
    FILE *f = fopen(path, "r");
    CHECK(f != NULL, "no heroes.txt");
    int row = 0;
    char line[256];
    while (f && fgets(line, sizeof line, f)) {
        char ini[8];
        unsigned score;
        if (line[0] == '#') continue;
        CHECK(row < 10 && sscanf(line, "%7s %u", ini, &score) == 2 && !strcmp(ini, heroes[row].i) &&
              score == heroes[row].s, "heroes row %d: %s", row + 1, line);
        row++;
    }
    if (f) fclose(f);
    CHECK(row == 10, "heroes rows: %d", row);

    /* waves against the web build's generated table */
    static const char *fields[9] = { "grunts", "electrodes", "mommies", "daddies", "mikeys",
                                     "hulks", "brains", "spheroids", "quarks" };
    snprintf(path, sizeof path, "%s/js/waveTable.ts", argv[2]);
    char *web = slurp(path);
    CHECK(web != NULL, "cannot read %s", path);
    int expect[9][40];
    for (int k = 0; web && k < 9; k++)
        CHECK(web_values(web, fields[k], expect[k], 40) == 40, "waveTable.ts: 40 %s values", fields[k]);
    snprintf(path, sizeof path, "%s/data/waves.txt", dir);
    f = fopen(path, "r");
    CHECK(f != NULL, "no waves.txt");
    int waves = 0;
    while (f && web && fgets(line, sizeof line, f)) {
        int w, v[9];
        if (line[0] == '#') continue;
        if (sscanf(line, "%d %d %d %d %d %d %d %d %d %d", &w, &v[0], &v[1], &v[2], &v[3], &v[4], &v[5],
                   &v[6], &v[7], &v[8]) != 10 || w != waves + 1) {
            CHECK(0, "waves.txt line: %s", line);
            break;
        }
        for (int k = 0; k < 9; k++)
            CHECK(v[k] == expect[k][waves], "wave %d %s: %d, web %d", w, fields[k], v[k], expect[k][waves]);
        waves++;
    }
    if (f) fclose(f);
    CHECK(waves == 40, "waves: %d", waves);
    free(web);

    snprintf(path, sizeof path, "%s/data/heroes.txt", dir); remove(path);
    snprintf(path, sizeof path, "%s/data/waves.txt", dir); remove(path);
    snprintf(path, sizeof path, "%s/data", dir); remove(path);
    remove(dir);

    if (failures) {
        fprintf(stderr, "extract tests FAILED: %d\n", failures);
        return 1;
    }
    printf("extract tests passed: heroes and 40 waves x 9 counts match\n");
    return 0;
}
