/*
 * Heroes tables, saving and initials entry (no ROM needed: a fake factory list).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "game/entry.h"
#include "game/hiscore.h"
#include "game/storage.h"

static int failures;
#define CHECK(cond, ...)                                                    \
    do {                                                                    \
        if (!(cond)) {                                                      \
            failures++;                                                     \
            fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__);            \
            fprintf(stderr, __VA_ARGS__);                                   \
            fputc('\n', stderr);                                            \
        }                                                                   \
    } while (0)

static const EntryInput NONE = { 0, 0, 0 }, UP = { 1, 0, 0 }, DOWN = { 0, 1, 0 }, OK = { 0, 0, 1 };

int main(void)
{
    static Assets a;
    static const HeroRow rom[HEROES_ROWS] = {
        { "DRJ", 52127 }, { "LED", 50218 }, { "EPJ", 41255 }, { "JER", 41250 }, { "KID", 31920 },
        { "MLG", 31919 }, { "SSR", 26645 }, { "UNA", 26635 }, { "JRS", 25250 }, { "CJM", 24110 },
    };
    memcpy(a.rom_heroes, rom, sizeof rom);
    a.have_heroes = 1;

    SaveData d;
    memset(&d, 0, sizeof d);
    HeroTables t;
    hiscore_tables(&d, &a, &t);
    CHECK(t.hero_count == 10 && t.heroes[0].score == 52127 && t.heroes[9].score == 24110, "factory heroes");
    CHECK(t.all_time[0].score == 10000 && t.all_time[36].score == 10000 && !t.all_time[0].initials[0], "all-time blanks");
    CHECK(!hiscore_qualifies(&t, 0) && !hiscore_qualifies(&t, 10000) && hiscore_qualifies(&t, 10001), "qualify rule");
    CHECK(hiscore_is_new_top(&t, 10001), "new top");

    /* 30000 enters both tables; 12000 only ALL TIME */
    hiscore_insert(&d, &a, "ABC", 30000);
    hiscore_tables(&d, &a, &t);
    CHECK(t.heroes[6].score == 30000 && !strcmp(t.heroes[6].initials, "ABC"), "heroes row 7: %s %u", t.heroes[6].initials, t.heroes[6].score);
    CHECK(t.heroes[9].score == 25250, "CJM dropped off: last %u", t.heroes[9].score);
    CHECK(t.all_time[0].score == 30000 && t.all_time[1].score == 10000, "all-time #1");
    hiscore_insert(&d, &a, "X Y", 12000);
    hiscore_tables(&d, &a, &t);
    CHECK(t.heroes[9].score == 25250 && t.all_time[1].score == 12000 && !strcmp(t.all_time[1].initials, "X Y"),
          "12000 into ALL TIME only");

    /* save and load back, in a temp dir */
    char dir[] = "/tmp/robotron_save_XXXXXX";
    CHECK(mkdtemp(dir) != NULL, "mkdtemp");
    setenv("ROBOTRON_SAVE_DIR", dir, 1);
    d.high_score = 30000;
    CHECK(storage_save(&d) == 0, "save");
    SaveData back;
    storage_load(&back);
    CHECK(back.high_score == 30000 && back.hero_count == d.hero_count && back.all_time_count == d.all_time_count, "round trip counts");
    HeroTables t2;
    hiscore_tables(&back, &a, &t2);
    CHECK(!memcmp(&t, &t2, sizeof t), "round trip tables");
    remove(storage_path());
    rmdir(dir);
    SaveData none;
    storage_load(&none);
    CHECK(none.high_score == 0 && none.hero_count == 0, "missing file loads empty");

    /* entry: a held confirm doesn't lock a letter; up/down cycle; repeat; trim */
    Entry e;
    entry_start(&e, 30000, 3, OK);
    entry_step(&e, OK);
    CHECK(e.slot == 0, "held confirm ignored");
    entry_step(&e, NONE);
    entry_step(&e, UP);            /* A -> B */
    entry_step(&e, NONE);
    entry_step(&e, OK);            /* slot 0 = B */
    entry_step(&e, NONE);
    entry_step(&e, DOWN);          /* A -> space (wraps) */
    entry_step(&e, NONE);
    entry_step(&e, OK);            /* slot 1 = space */
    entry_step(&e, NONE);
    for (int i = 0; i < 24 + 7 * 2; i++) entry_step(&e, UP); /* 1 + repeats after 24 frames, every 7 */
    CHECK(e.initials[2] == 3, "repeat: letter %d (D expected)", e.initials[2]);
    entry_step(&e, NONE);
    entry_step(&e, DOWN);
    entry_step(&e, DOWN);          /* held: no extra step */
    entry_step(&e, NONE);
    entry_step(&e, DOWN);
    entry_step(&e, NONE);
    entry_step(&e, DOWN);          /* D -> A */
    entry_step(&e, NONE);
    entry_step(&e, OK);
    CHECK(e.done && !strcmp(e.result, "B A"), "result '%s'", e.result);

    entry_start(&e, 1, 3, NONE);
    entry_step(&e, OK);
    entry_step(&e, NONE);
    entry_step(&e, DOWN);
    entry_step(&e, NONE);
    entry_step(&e, OK);
    entry_step(&e, NONE);
    entry_step(&e, DOWN);
    entry_step(&e, NONE);
    entry_step(&e, OK);
    CHECK(e.done && !strcmp(e.result, "A"), "trailing spaces trimmed: '%s'", e.result);

    if (failures) {
        fprintf(stderr, "hiscore tests FAILED: %d\n", failures);
        return 1;
    }
    printf("hiscore tests passed\n");
    return 0;
}
