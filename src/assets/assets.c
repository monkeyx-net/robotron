#include "assets/assets.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#include "assets/json.h"

static int has_file(const char *dir, const char *rel)
{
    char path[1100];
    struct stat st;
    snprintf(path, sizeof path, "%s/%s", dir, rel);
    return stat(path, &st) == 0;
}

/* First search dir holding `rel`: $ROBOTRON_ASSETS, <exe dir>/assets, source tree. */
static int find_dir(char *out, size_t outlen, const char *argv0, const char *rel)
{
    const char *env = getenv("ROBOTRON_ASSETS");
    if (env && has_file(env, rel)) {
        snprintf(out, outlen, "%s", env);
        return 0;
    }
    if (argv0) {
        char exe_dir[900];
        snprintf(exe_dir, sizeof exe_dir, "%s", argv0);
        char *slash = strrchr(exe_dir, '/');
        if (slash) *slash = '\0';
        else snprintf(exe_dir, sizeof exe_dir, ".");
        snprintf(out, outlen, "%s/assets", exe_dir);
        if (has_file(out, rel)) return 0;
    }
#ifdef ROBOTRON_SOURCE_DIR
    if (has_file(ROBOTRON_SOURCE_DIR, rel)) {
        snprintf(out, outlen, "%s", ROBOTRON_SOURCE_DIR);
        return 0;
    }
#endif
    out[0] = '\0';
    return -1;
}

/* Lines of a data table, '#' comments and blank lines skipped; calls row() per line. */
static int read_table(const char *dir, const char *name, int (*row)(Assets *, int, const char *), Assets *a)
{
    char path[1100], line[256];
    snprintf(path, sizeof path, "%s/data/%s", dir, name);
    FILE *f = fopen(path, "r");
    if (!f) return -1;
    int n = 0, bad = 0;
    while (fgets(line, sizeof line, f)) {
        if (line[0] == '#' || line[0] == '\n') continue;
        if (row(a, n++, line)) bad = 1;
    }
    fclose(f);
    return bad ? -1 : n;
}

static int hero_row(Assets *a, int i, const char *line)
{
    if (i >= HEROES_ROWS) return -1;
    HeroRow *r = &a->rom_heroes[i];
    return sscanf(line, "%3s %u", r->initials, &r->score) == 2 ? 0 : -1;
}

/* waveparams.txt: 12 "name v*43" lines, then "mercy w a b c d" lines */
static int param_row(Assets *a, int i, const char *line)
{
    if (!strncmp(line, "mercy", 5)) {
        int w, v[4];
        if (sscanf(line, "mercy %d %d %d %d %d", &w, &v[0], &v[1], &v[2], &v[3]) != 5 || w < 1 || w > 4) return -1;
        for (int k = 0; k < 4; k++) a->mercy[w - 1][k] = (unsigned char)v[k];
        return 0;
    }
    if (i >= PARAM_TABLES) return -1;
    const char *p = strchr(line, ' ');
    for (int k = 0; k < PARAM_BYTES; k++) {
        int v, off;
        if (!p || sscanf(p, " %d%n", &v, &off) != 1 || v < 0 || v > 255) return -1;
        a->params[i][k] = (unsigned char)v;
        p += off;
    }
    return 0;
}

/* electrodes.txt: "look w entry", "frame hold w h", then h rows */
static int load_electrodes(Assets *a, const char *dir)
{
    char path[1100], line[512];
    snprintf(path, sizeof path, "%s/data/electrodes.txt", dir);
    FILE *f = fopen(path, "r");
    if (!f) return -1;
    ElectrodeLook *look = NULL;
    ElectrodeFrame *fr = NULL;
    int looks = 0, row = 0, bad = 0;
    while (!bad && fgets(line, sizeof line, f)) {
        int w, e, hold, fw, fh;
        line[strcspn(line, "\n")] = '\0';
        if (line[0] == '#' && line[1] == ' ') continue;
        if (sscanf(line, "look %d %d", &w, &e) == 2) {
            if (w != looks + 1 || w > 10) { bad = 1; break; }
            look = &a->electrodes[looks++];
            look->entry = e;
            look->nframes = 0;
            fr = NULL;
        } else if (sscanf(line, "frame %d %d %d", &hold, &fw, &fh) == 3) {
            if (!look || look->nframes == 3 || fw < 1 || fw > 24 || fh < 1 || fh > 24) { bad = 1; break; }
            fr = &look->frames[look->nframes++];
            fr->hold = hold;
            fr->w = fw;
            fr->h = fh;
            row = 0;
        } else if (fr && row < fr->h && (int)strlen(line) == fr->w) {
            memcpy(fr->rows[row++], line, (size_t)fr->w + 1);
        } else if (line[0]) {
            bad = 1;
        }
    }
    fclose(f);
    return bad || looks != 10 ? -1 : 0;
}

static int wave_row(Assets *a, int i, const char *line)
{
    int w, v[WAVE_FIELDS];
    if (i >= WAVES || sscanf(line, "%d %d %d %d %d %d %d %d %d %d", &w, &v[0], &v[1], &v[2], &v[3], &v[4],
                             &v[5], &v[6], &v[7], &v[8]) != 10 || w != i + 1)
        return -1;
    for (int k = 0; k < WAVE_FIELDS; k++) {
        if (v[k] < 0 || v[k] > 255) return -1;
        a->waves[i][k] = (unsigned char)v[k];
    }
    return 0;
}

static int load_image(const Assets *a, const char *name, Image *img, char *err, int errlen)
{
    char path[1100];
    const char *e = NULL;
    snprintf(path, sizeof path, "%s/sprites/%s.png", a->sprites_dir, name);
    if (png_load(path, img, &e)) {
        snprintf(err, (size_t)errlen, "%s: %s", path, e);
        return -1;
    }
    return 0;
}

static JsonValue *load_meta(const Assets *a, const char *name, char *err, int errlen)
{
    char path[1100];
    const char *e = NULL;
    snprintf(path, sizeof path, "%s/sprites/%s.json", a->sprites_dir, name);
    JsonValue *meta = json_load(path, &e);
    if (!meta) snprintf(err, (size_t)errlen, "%s: %s", path, e);
    return meta;
}

/* A rect from {x,y,w,h}, checked against the image. */
static int read_rect(const JsonValue *v, const Image *img, int *x, int *y, int *w, int *h)
{
    *x = (int)json_number(v, "x", -1);
    *y = (int)json_number(v, "y", -1);
    *w = (int)json_number(v, "w", -1);
    *h = (int)json_number(v, "h", -1);
    return *x >= 0 && *y >= 0 && *w > 0 && *h > 0 && *x + *w <= img->width && *y + *h <= img->height;
}

static int load_atlas(Assets *a, char *err, int errlen)
{
    Atlas *at = &a->atlas;
    if (load_image(a, "atlas", &at->image, err, errlen)) return -1;
    JsonValue *meta = load_meta(a, "atlas", err, errlen);
    if (!meta) return -1;

    const JsonValue *frames = json_get(meta, "frames");
    const JsonValue *palette = json_get(meta, "palette");
    int rc = -1;
    if (!frames || frames->type != JSON_OBJECT || !palette || palette->type != JSON_ARRAY) {
        snprintf(err, (size_t)errlen, "atlas.json: missing frames or palette");
        goto done;
    }
    for (const JsonValue *f = frames->child; f; f = f->next) {
        if (at->frame_count == MAX_ATLAS_FRAMES || strlen(f->key) >= sizeof at->frames[0].name) {
            snprintf(err, (size_t)errlen, "atlas.json: too many frames or name too long");
            goto done;
        }
        AtlasFrame *fr = &at->frames[at->frame_count++];
        snprintf(fr->name, sizeof fr->name, "%s", f->key);
        if (!read_rect(f, &at->image, &fr->x, &fr->y, &fr->w, &fr->h)) {
            snprintf(err, (size_t)errlen, "atlas.json: frame %s is outside the sheet", f->key);
            goto done;
        }
    }
    int i = 0;
    for (const JsonValue *p = palette->child; p && i < 16; p = p->next, i++) {
        const JsonValue *c = p->child;
        unsigned rgb = 0;
        for (int k = 0; k < 3; k++, c = c ? c->next : NULL)
            rgb = rgb << 8 | (c && c->type == JSON_NUMBER ? (unsigned)c->number & 0xFF : 0);
        at->palette[i] = rgb;
    }
    rc = 0;
done:
    json_free(meta);
    return rc;
}

static int load_font(Assets *a, Font *font, const char *name, char *err, int errlen)
{
    if (load_image(a, name, &font->image, err, errlen)) return -1;
    JsonValue *meta = load_meta(a, name, err, errlen);
    if (!meta) return -1;
    int rc = -1;
    const JsonValue *glyphs = json_get(meta, "glyphs");
    font->line_height = (int)json_number(meta, "lineHeight", 5);
    if (!glyphs || glyphs->type != JSON_OBJECT) {
        snprintf(err, (size_t)errlen, "%s.json: missing glyphs", name);
        goto done;
    }
    for (const JsonValue *g = glyphs->child; g; g = g->next) {
        unsigned char ch = (unsigned char)g->key[0];
        if (g->key[1] || ch < ' ' || ch > '~') continue;
        Glyph *gl = &font->glyphs[ch - ' '];
        if (!read_rect(g, &font->image, &gl->x, &gl->y, &gl->w, &gl->h)) {
            snprintf(err, (size_t)errlen, "%s.json: glyph '%c' is outside the sheet", name, ch);
            goto done;
        }
        gl->present = 1;
    }
    rc = 0;
done:
    json_free(meta);
    return rc;
}

int assets_load(Assets *a, const char *argv0, char *err, int errlen)
{
    memset(a, 0, sizeof *a);
    if (find_dir(a->sprites_dir, sizeof a->sprites_dir, argv0, "sprites/atlas.json")) {
        snprintf(err, (size_t)errlen,
                 "game assets not found: set ROBOTRON_ASSETS, or put an assets/ folder next to the program");
        return -1;
    }
    if (load_atlas(a, err, errlen) || load_font(a, &a->font_main, "font_main", err, errlen) ||
        load_font(a, &a->font_alt, "font_alt", err, errlen)) {
        assets_free(a);
        return -1;
    }
    /* ROM tables are optional: without them the game runs with what it has */
    if (!find_dir(a->data_dir, sizeof a->data_dir, argv0, "data/heroes.txt")) {
        a->have_heroes = read_table(a->data_dir, "heroes.txt", hero_row, a) == HEROES_ROWS;
        a->have_waves = read_table(a->data_dir, "waves.txt", wave_row, a) == WAVES;
        a->have_params = read_table(a->data_dir, "waveparams.txt", param_row, a) == PARAM_TABLES + 4;
        a->have_electrodes = load_electrodes(a, a->data_dir) == 0;
    }
    return 0;
}

void assets_free(Assets *a)
{
    image_free(&a->atlas.image);
    image_free(&a->font_main.image);
    image_free(&a->font_alt.image);
}

const AtlasFrame *atlas_frame(const Atlas *atlas, const char *name)
{
    for (int i = 0; i < atlas->frame_count; i++)
        if (!strcmp(atlas->frames[i].name, name)) return &atlas->frames[i];
    return NULL;
}
