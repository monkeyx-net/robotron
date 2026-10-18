#include "game/hiscore.h"

#include <stdio.h>
#include <string.h>

#define ALL_TIME_DEFAULT 10000u

static int same(const HeroRow *a, const HeroRow *b)
{
    return a->score == b->score && !strcmp(a->initials, b->initials);
}

/* Stable sort, high to low (JS Array.sort is stable). */
static void sort_rows(HeroRow *rows, int n)
{
    for (int i = 1; i < n; i++) {
        HeroRow r = rows[i];
        int j = i - 1;
        while (j >= 0 && rows[j].score < r.score) {
            rows[j + 1] = rows[j];
            j--;
        }
        rows[j + 1] = r;
    }
}

/* fill(): rows, then the pad rows not already there, sorted, cut to max */
static int fill(const HeroRow *rows, int n, const HeroRow *pad, int npad, int max, HeroRow *out)
{
    HeroRow all[SAVE_MAX_ROWS + HEROES_ROWS];
    int k = 0;
    for (int i = 0; i < n && k < SAVE_MAX_ROWS; i++) all[k++] = rows[i];
    for (int i = 0; i < npad; i++) {
        int found = 0;
        for (int j = 0; j < n; j++) found |= same(&rows[j], &pad[i]);
        if (!found) all[k++] = pad[i];
    }
    sort_rows(all, k);
    if (k > max) k = max;
    memcpy(out, all, sizeof all[0] * (size_t)k);
    return k;
}

static int real_all_time(const SaveData *d, HeroRow *out)
{
    int k = 0;
    for (int i = 0; i < d->all_time_count; i++)
        if (d->all_time[i].initials[0] || d->all_time[i].score != ALL_TIME_DEFAULT) out[k++] = d->all_time[i];
    return k;
}

void hiscore_tables(const SaveData *d, const Assets *a, HeroTables *t)
{
    t->hero_count = fill(d->heroes, d->hero_count, a->rom_heroes, a->have_heroes ? HEROES_ROWS : 0, HEROES_ROWS,
                         t->heroes);
    HeroRow all[SAVE_MAX_ROWS + ALL_TIME_ROWS];
    int k = real_all_time(d, all);
    for (int i = 0; i < ALL_TIME_ROWS; i++) {
        memset(&all[k], 0, sizeof all[k]);
        all[k++].score = ALL_TIME_DEFAULT;
    }
    sort_rows(all, k);
    memcpy(t->all_time, all, sizeof t->all_time);
}

int hiscore_qualifies(const HeroTables *t, unsigned score)
{
    if (score == 0) return 0;
    if (t->hero_count == HEROES_ROWS && score > t->heroes[HEROES_ROWS - 1].score) return 1;
    if (t->hero_count < HEROES_ROWS) return 1; /* a table with room takes any score */
    return score > t->all_time[ALL_TIME_ROWS - 1].score;
}

int hiscore_is_new_top(const HeroTables *t, unsigned score)
{
    return score > t->all_time[0].score;
}

void hiscore_insert(SaveData *d, const Assets *a, const char *initials, unsigned score)
{
    HeroTables t;
    hiscore_tables(d, a, &t);
    HeroRow row;
    memset(&row, 0, sizeof row);
    snprintf(row.initials, sizeof row.initials, "%s", initials);
    row.score = score;

    if (t.hero_count < HEROES_ROWS || score > t.heroes[HEROES_ROWS - 1].score) {
        HeroRow rows[HEROES_ROWS + 1];
        rows[0] = row;
        memcpy(rows + 1, t.heroes, sizeof t.heroes[0] * (size_t)t.hero_count);
        int n = t.hero_count + 1;
        sort_rows(rows, n);
        if (n > HEROES_ROWS) n = HEROES_ROWS;
        memcpy(d->heroes, rows, sizeof rows[0] * (size_t)n);
        d->hero_count = n;
    }
    if (score > t.all_time[ALL_TIME_ROWS - 1].score) {
        HeroRow rows[SAVE_MAX_ROWS + 1];
        rows[0] = row;
        int n = 1 + real_all_time(d, rows + 1);
        sort_rows(rows, n);
        if (n > ALL_TIME_ROWS) n = ALL_TIME_ROWS;
        memcpy(d->all_time, rows, sizeof rows[0] * (size_t)n);
        d->all_time_count = n;
    }
}
