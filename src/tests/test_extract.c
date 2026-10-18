/*
 * Extractor check (needs the user's ROM set, so it runs only when CMake finds
 * one): extract into a temp dir, then compare
 *   - heroes.txt with the ROM's factory list as the web build has it, and
 *   - waves.txt with js/waveTable.ts, all 40 waves x 9 counts,
 *   - waveparams.txt with js/core/WaveParams.ts (12 tables x 43 bytes), and
 *   - electrodes.txt with js/core/ElectrodeShapes.ts (10 looks, every row).
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

    /* wave parameter tables: every number after "hdr:" in WaveParams.ts, in order */
    snprintf(path, sizeof path, "%s/js/core/WaveParams.ts", argv[2]);
    char *wp = slurp(path);
    snprintf(path, sizeof path, "%s/data/waveparams.txt", dir);
    char *mine = slurp(path);
    CHECK(wp && mine, "cannot read WaveParams.ts or waveparams.txt");
    if (wp && mine) {
        const char *p = wp, *m = mine;
        for (int t = 0; t < 12; t++) {
            p = strstr(p, "{ hdr: 0x");
            CHECK(p != NULL, "WaveParams.ts table %d", t);
            if (!p) break;
            int web_v[43], n = 0;
            const char *end = strchr(p, '}');
            for (const char *q = p; q < end && n < 43; q++)
                if (q[0] == '0' && q[1] == 'x') web_v[n++] = (int)strtol(q, (char **)&q, 16);
            p = end;
            while (*m == '#') m = strchr(m, '\n') + 1;
            char name[32];
            int off = 0, v;
            sscanf(m, "%31s%n", name, &off);
            m += off;
            for (int i = 0; i < 43; i++) {
                if (sscanf(m, " %d%n", &v, &off) != 1) { CHECK(0, "waveparams.txt %s short", name); break; }
                m += off;
                CHECK(i < n && v == web_v[i], "param %s byte %d: %d, web %d", name, i, v, i < n ? web_v[i] : -1);
            }
            m = strchr(m, '\n') + 1;
        }
        CHECK(strstr(mine, "mercy 1 38 96 30 15") && strstr(mine, "mercy 4 30 30 15 7"), "mercy table");
    }
    free(wp);
    free(mine);

    /* electrodes: palette entries, holds and rows in the same order as ElectrodeShapes.ts */
    snprintf(path, sizeof path, "%s/js/core/ElectrodeShapes.ts", argv[2]);
    char *es = slurp(path);
    snprintf(path, sizeof path, "%s/data/electrodes.txt", dir);
    mine = slurp(path);
    CHECK(es && mine, "cannot read ElectrodeShapes.ts or electrodes.txt");
    if (es && mine) {
        /* flatten both into "E<entry> H<hold> <row> ..." token streams and compare */
        static char a[32768], b[32768];
        size_t na = 0, nb = 0;
        for (const char *q = strstr(es, "const LOOKS"); q && *q; q++) {
            if (!strncmp(q, "entry: 0x", 9)) na += (size_t)snprintf(a + na, sizeof a - na, "E%ld ", strtol(q + 9, NULL, 16));
            else if (!strncmp(q, "hold: ", 6)) na += (size_t)snprintf(a + na, sizeof a - na, "H%ld ", strtol(q + 6, NULL, 10));
            else if (*q == '\'' && (q[1] == '.' || q[1] == '#')) {
                const char *e = strchr(q + 1, '\'');
                na += (size_t)snprintf(a + na, sizeof a - na, "%.*s ", (int)(e - q - 1), q + 1);
                q = e;
            } else if (!strncmp(q, "export function", 15)) break;
        }
        for (const char *q = mine; *q;) {
            const char *e = strchr(q, '\n');
            if (!e) e = q + strlen(q);
            int ent, hold;
            if (q[0] == '#' && q[1] == ' ') {
            } else if (sscanf(q, "look %*d %d", &ent) == 1) nb += (size_t)snprintf(b + nb, sizeof b - nb, "E%d ", ent);
            else if (sscanf(q, "frame %d", &hold) == 1) nb += (size_t)snprintf(b + nb, sizeof b - nb, "H%d ", hold);
            else if (e > q) nb += (size_t)snprintf(b + nb, sizeof b - nb, "%.*s ", (int)(e - q), q);
            q = *e ? e + 1 : e;
        }
        CHECK(na > 1000 && !strcmp(a, b), "electrode looks differ from ElectrodeShapes.ts");
    }
    free(es);
    free(mine);

    snprintf(path, sizeof path, "%s/data/heroes.txt", dir); remove(path);
    snprintf(path, sizeof path, "%s/data/waves.txt", dir); remove(path);
    snprintf(path, sizeof path, "%s/data/waveparams.txt", dir); remove(path);
    snprintf(path, sizeof path, "%s/data/electrodes.txt", dir); remove(path);
    snprintf(path, sizeof path, "%s/data", dir); remove(path);
    remove(dir);

    if (failures) {
        fprintf(stderr, "extract tests FAILED: %d\n", failures);
        return 1;
    }
    printf("extract tests passed: heroes, waves, wave params, mercy and electrodes match the web build\n");
    return 0;
}
