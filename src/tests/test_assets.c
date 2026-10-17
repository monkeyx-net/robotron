/*
 * Asset loading: every PNG in sprites/ decodes (chunk CRCs and zlib Adler-32
 * are verified by the decoder), the atlas and font metadata match the known
 * files, JSON escapes decode, and png_write output reads back identically.
 *
 *   test_assets <repo root>
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "assets/assets.h"
#include "assets/json.h"
#include "assets/png.h"
#include "gfx/font.h"

static int failures;

#define CHECK(cond, ...)                                            \
    do {                                                            \
        if (!(cond)) {                                              \
            failures++;                                             \
            fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__);    \
            fprintf(stderr, __VA_ARGS__);                           \
            fputc('\n', stderr);                                    \
        }                                                           \
    } while (0)

static void check_png(const char *root, const char *name, int w, int h)
{
    char path[1024];
    snprintf(path, sizeof path, "%s/sprites/%s", root, name);
    Image img;
    const char *err = NULL;
    int rc = png_load(path, &img, &err);
    CHECK(rc == 0, "%s: %s", name, err ? err : "?");
    if (rc) return;
    CHECK(img.width == w && img.height == h, "%s: %dx%d, expected %dx%d", name, img.width, img.height, w, h);
    image_free(&img);
}

int main(int argc, char **argv)
{
    if (argc < 2) {
        fprintf(stderr, "usage: %s <repo root>\n", argv[0]);
        return 2;
    }
    const char *root = argv[1];

    /* sizes from the PNG headers */
    check_png(root, "atlas.png", 512, 67);
    check_png(root, "font_main.png", 237, 5);
    check_png(root, "font_alt.png", 301, 6);
    check_png(root, "grunt.png", 9, 12);
    check_png(root, "humans.png", 7, 13);
    check_png(root, "player.png", 7, 11);
    check_png(root, "players.png", 33, 13);

    /* JSON: escapes, nesting, numbers */
    const char *err = NULL;
    JsonValue *j = json_parse("{\"\\\\\": {\"w\": 4}, \"a\\u0041\": [1, -2.5, true, null], \"s\": \"x\\\"y\"}", &err);
    CHECK(j != NULL, "json_parse: %s", err ? err : "?");
    if (j) {
        CHECK(json_number(json_get(j, "\\"), "w", 0) == 4, "backslash key");
        const JsonValue *arr = json_get(j, "aA");
        CHECK(arr && arr->type == JSON_ARRAY && arr->child && arr->child->next->number == -2.5, "\\u escape / array");
        const JsonValue *s = json_get(j, "s");
        CHECK(s && s->type == JSON_STRING && !strcmp(s->string, "x\"y"), "escaped quote");
        json_free(j);
    }
    CHECK(json_parse("{\"a\": 1,}", &err) == NULL, "trailing comma must fail");
    CHECK(json_parse("[1 2]", &err) == NULL, "missing comma must fail");

    /* the real asset set */
    setenv("ROBOTRON_ASSETS", root, 1);
    static Assets a;
    char msg[512];
    int rc = assets_load(&a, NULL, msg, sizeof msg);
    CHECK(rc == 0, "assets_load: %s", msg);
    if (!rc) {
        CHECK(a.atlas.frame_count == 137, "atlas frames: %d", a.atlas.frame_count);
        CHECK(a.atlas.palette[1] == 0xFF0000 && a.atlas.palette[15] == 0xFFB600, "palette");
        CHECK(atlas_frame(&a.atlas, "logo2084_0") != NULL, "logo2084 frame");
        CHECK(atlas_frame(&a.atlas, "grunt_0") != NULL, "grunt_0 frame");
        CHECK(a.font_main.line_height == 5 && a.font_alt.line_height == 6, "line heights");
        CHECK(a.font_main.glyphs['0' - ' '].w == 4 && a.font_alt.glyphs['0' - ' '].w == 6, "digit widths");
        CHECK(a.font_main.glyphs['\\' - ' '].present, "backslash glyph");
        /* text layout: "A B" = A + 1 + space('0' width) + 1 + B */
        int wa = a.font_main.glyphs['A' - ' '].w, wb = a.font_main.glyphs['B' - ' '].w;
        CHECK(font_measure(&a, FONT_MAIN, "a b") == wa + 1 + 4 + 1 + wb, "measure 'a b'");
        CHECK(font_measure(&a, FONT_MAIN, "-") == 3, "measure '-'");
        CHECK(font_measure(&a, FONT_ALT, "(") == 4, "measure synth '('");
        assets_free(&a);
    }

    /* writer round trip, larger than one stored block */
    enum { W = 300, H = 250 };
    uint8_t *px = malloc(W * H * 4);
    for (int i = 0; i < W * H * 4; i++) px[i] = (uint8_t)(i * 7 + i / 13);
    char tmp[] = "/tmp/robotron_png_XXXXXX";
    int fd = mkstemp(tmp);
    CHECK(fd >= 0, "mkstemp");
    if (fd >= 0) {
        fclose(fdopen(fd, "w"));
        CHECK(png_write(tmp, px, W, H) == 0, "png_write");
        Image back;
        CHECK(png_load(tmp, &back, &err) == 0, "png_load(written): %s", err ? err : "?");
        CHECK(back.width == W && back.height == H && !memcmp(back.rgba, px, W * H * 4), "round trip pixels");
        image_free(&back);
        remove(tmp);
    }
    free(px);

    if (failures) {
        fprintf(stderr, "asset tests FAILED: %d\n", failures);
        return 1;
    }
    printf("asset tests passed\n");
    return 0;
}
