#include "game/storage.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#ifdef _WIN32
#include <direct.h>
#define mkdir(dir, mode) _mkdir(dir)
#endif

static char path[1100];

static int mkdir_p(const char *dir)
{
    char tmp[1024];
    snprintf(tmp, sizeof tmp, "%s", dir);
    for (char *p = tmp + 1; *p; p++) {
        if (*p != '/') continue;
        *p = '\0';
        if (mkdir(tmp, 0755) && errno != EEXIST) return -1;
        *p = '/';
    }
    return mkdir(tmp, 0755) && errno != EEXIST ? -1 : 0;
}

static const char *save_dir(char *buf, size_t len)
{
    const char *env = getenv("ROBOTRON_SAVE_DIR");
    if (env && *env) return env;
    const char *xdg = getenv("XDG_DATA_HOME");
    if (xdg && *xdg) {
        snprintf(buf, len, "%s/robotron", xdg);
        return buf;
    }
#ifdef _WIN32
    const char *appdata = getenv("APPDATA");
    if (appdata && *appdata) {
        snprintf(buf, len, "%s/robotron", appdata);
        return buf;
    }
#endif
    const char *home = getenv("HOME");
    snprintf(buf, len, "%s/.local/share/robotron", home && *home ? home : ".");
    return buf;
}

const char *storage_path(void)
{
    char dir[1024];
    snprintf(path, sizeof path, "%s/scores.txt", save_dir(dir, sizeof dir));
    return path;
}

/* "<score> <initials...>": initials may hold spaces or be empty */
static int parse_row(const char *rest, HeroRow *r)
{
    char *end;
    unsigned long score = strtoul(rest, &end, 10);
    if (end == rest) return -1;
    while (*end == ' ') end++;
    size_t n = strcspn(end, "\n");
    if (n >= sizeof r->initials) n = sizeof r->initials - 1;
    memcpy(r->initials, end, n);
    r->initials[n] = '\0';
    r->score = (unsigned)score;
    return 0;
}

static int clampi(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }

void storage_load(SaveData *d)
{
    memset(d, 0, sizeof *d);
    d->op = OPERATOR_FACTORY;
    FILE *f = fopen(storage_path(), "r");
    if (!f) return;
    char line[256];
    while (fgets(line, sizeof line, f)) {
        int e, t, df, l;
        if (sscanf(line, "graphics %d %d %d %d", &e, &t, &df, &l) == 4) {
            d->gfx.mode = clampi(e, GFX_CLASSIC, GFX_HD);
            d->gfx.smooth = t != 0;
            d->gfx.glow = df != 0;
            d->gfx.scanlines = l != 0;
        } else if (sscanf(line, "operator %d %d %d %d", &e, &t, &df, &l) == 4) {
            /* sanitize, as OperatorSettings.ts does with old or corrupt storage */
            d->op.extra_man_every = e == 0 || e == 20000 || e == 25000 || e == 30000 || e == 50000 ? e : 25000;
            d->op.turns = clampi(t, 1, 20);
            d->op.difficulty = clampi(df, 0, 10);
            d->op.letters = clampi(l, 3, 20);
        } else if (!strncmp(line, "highscore ", 10)) {
            d->high_score = (unsigned)strtoul(line + 10, NULL, 10);
        } else if (!strncmp(line, "hero ", 5) && d->hero_count < SAVE_MAX_ROWS) {
            if (!parse_row(line + 5, &d->heroes[d->hero_count])) d->hero_count++;
        } else if (!strncmp(line, "alltime ", 8) && d->all_time_count < SAVE_MAX_ROWS) {
            if (!parse_row(line + 8, &d->all_time[d->all_time_count])) d->all_time_count++;
        }
    }
    fclose(f);
}

int storage_save(const SaveData *d)
{
    char dir[1024], tmp[1200];
    if (mkdir_p(save_dir(dir, sizeof dir))) return -1;
    const char *p = storage_path();
    snprintf(tmp, sizeof tmp, "%s.tmp", p);
    FILE *f = fopen(tmp, "w");
    if (!f) return -1;
    int bad = fprintf(f, "# Robotron: 2084 saved settings and scores\noperator %d %d %d %d\nhighscore %u\n",
                      d->op.extra_man_every, d->op.turns, d->op.difficulty, d->op.letters, d->high_score) < 0;
    bad |= fprintf(f, "graphics %d %d %d %d\n", d->gfx.mode, d->gfx.smooth, d->gfx.glow, d->gfx.scanlines) < 0;
    for (int i = 0; i < d->hero_count; i++) bad |= fprintf(f, "hero %u %s\n", d->heroes[i].score, d->heroes[i].initials) < 0;
    for (int i = 0; i < d->all_time_count; i++)
        bad |= fprintf(f, "alltime %u %s\n", d->all_time[i].score, d->all_time[i].initials) < 0;
    bad |= fflush(f) != 0;
    bad |= fclose(f) != 0;
#ifdef _WIN32
    if (!bad) remove(p); /* Windows rename() does not replace */
#endif
    if (bad || rename(tmp, p)) {
        remove(tmp);
        return -1;
    }
    return 0;
}
