#include "assets/json.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const char *p;
    const char *err;
    int depth;
} Parser;

static void skip_ws(Parser *ps)
{
    while (*ps->p == ' ' || *ps->p == '\t' || *ps->p == '\n' || *ps->p == '\r') ps->p++;
}

static JsonValue *new_value(Parser *ps, JsonType type)
{
    JsonValue *v = calloc(1, sizeof *v);
    if (!v) ps->err = "out of memory";
    else v->type = type;
    return v;
}

static int hex4(const char *s, unsigned *out)
{
    unsigned v = 0;
    for (int i = 0; i < 4; i++) {
        char c = s[i];
        v <<= 4;
        if (c >= '0' && c <= '9') v |= (unsigned)(c - '0');
        else if (c >= 'a' && c <= 'f') v |= (unsigned)(c - 'a' + 10);
        else if (c >= 'A' && c <= 'F') v |= (unsigned)(c - 'A' + 10);
        else return -1;
    }
    *out = v;
    return 0;
}

static size_t utf8_put(char *dst, unsigned cp)
{
    if (cp < 0x80) { dst[0] = (char)cp; return 1; }
    if (cp < 0x800) { dst[0] = (char)(0xC0 | cp >> 6); dst[1] = (char)(0x80 | (cp & 0x3F)); return 2; }
    if (cp < 0x10000) {
        dst[0] = (char)(0xE0 | cp >> 12); dst[1] = (char)(0x80 | (cp >> 6 & 0x3F));
        dst[2] = (char)(0x80 | (cp & 0x3F)); return 3;
    }
    dst[0] = (char)(0xF0 | cp >> 18); dst[1] = (char)(0x80 | (cp >> 12 & 0x3F));
    dst[2] = (char)(0x80 | (cp >> 6 & 0x3F)); dst[3] = (char)(0x80 | (cp & 0x3F)); return 4;
}

/* Parse a string starting at the opening quote. Decoded text never exceeds the source length. */
static char *parse_string(Parser *ps)
{
    const char *start = ++ps->p;
    const char *end = start;
    while (*end && *end != '"') end += *end == '\\' && end[1] ? 2 : 1;
    if (*end != '"') { ps->err = "unterminated string"; return NULL; }
    char *out = malloc((size_t)(end - start) + 1), *o = out;
    if (!out) { ps->err = "out of memory"; return NULL; }
    const char *s = start;
    while (s < end) {
        if ((unsigned char)*s < 0x20) { ps->err = "control character in string"; free(out); return NULL; }
        if (*s != '\\') { *o++ = *s++; continue; }
        s++;
        switch (*s) {
        case '"': *o++ = '"'; s++; break;
        case '\\': *o++ = '\\'; s++; break;
        case '/': *o++ = '/'; s++; break;
        case 'b': *o++ = '\b'; s++; break;
        case 'f': *o++ = '\f'; s++; break;
        case 'n': *o++ = '\n'; s++; break;
        case 'r': *o++ = '\r'; s++; break;
        case 't': *o++ = '\t'; s++; break;
        case 'u': {
            unsigned cp;
            if (end - s < 5 || hex4(s + 1, &cp)) { ps->err = "bad \\u escape"; free(out); return NULL; }
            s += 5;
            if (cp >= 0xD800 && cp < 0xDC00 && end - s >= 6 && s[0] == '\\' && s[1] == 'u') {
                unsigned lo;
                if (!hex4(s + 2, &lo) && lo >= 0xDC00 && lo < 0xE000) {
                    cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                    s += 6;
                }
            }
            o += utf8_put(o, cp);
            break;
        }
        default: ps->err = "bad escape"; free(out); return NULL;
        }
    }
    *o = '\0';
    ps->p = end + 1;
    return out;
}

static JsonValue *parse_value(Parser *ps);

static JsonValue *parse_container(Parser *ps, JsonType type, char close)
{
    JsonValue *v = new_value(ps, type), **tail;
    if (!v) return NULL;
    tail = &v->child;
    if (++ps->depth > 64) { ps->err = "nested too deeply"; return v; }
    ps->p++;
    skip_ws(ps);
    if (*ps->p == close) { ps->p++; ps->depth--; return v; }
    for (;;) {
        char *key = NULL;
        if (type == JSON_OBJECT) {
            skip_ws(ps);
            if (*ps->p != '"') { ps->err = "expected a key"; return v; }
            if (!(key = parse_string(ps))) return v;
            skip_ws(ps);
            if (*ps->p != ':') { ps->err = "expected ':'"; free(key); return v; }
            ps->p++;
        }
        JsonValue *item = parse_value(ps);
        if (!item) { free(key); return v; }
        item->key = key;
        *tail = item;
        tail = &item->next;
        if (ps->err) return v;
        skip_ws(ps);
        if (*ps->p == ',') { ps->p++; continue; }
        if (*ps->p == close) { ps->p++; ps->depth--; return v; }
        ps->err = type == JSON_OBJECT ? "expected ',' or '}'" : "expected ',' or ']'";
        return v;
    }
}

static JsonValue *parse_value(Parser *ps)
{
    skip_ws(ps);
    char c = *ps->p;
    if (c == '{') return parse_container(ps, JSON_OBJECT, '}');
    if (c == '[') return parse_container(ps, JSON_ARRAY, ']');
    if (c == '"') {
        char *s = parse_string(ps);
        if (!s) return NULL;
        JsonValue *v = new_value(ps, JSON_STRING);
        if (v) v->string = s; else free(s);
        return v;
    }
    if (!strncmp(ps->p, "true", 4) || !strncmp(ps->p, "false", 5)) {
        JsonValue *v = new_value(ps, JSON_BOOL);
        int t = c == 't';
        if (v) v->number = t;
        ps->p += t ? 4 : 5;
        return v;
    }
    if (!strncmp(ps->p, "null", 4)) {
        ps->p += 4;
        return new_value(ps, JSON_NULL);
    }
    if (c == '-' || (c >= '0' && c <= '9')) {
        char *end;
        double d = strtod(ps->p, &end);
        if (end == ps->p) { ps->err = "bad number"; return NULL; }
        ps->p = end;
        JsonValue *v = new_value(ps, JSON_NUMBER);
        if (v) v->number = d;
        return v;
    }
    ps->err = "unexpected character";
    return NULL;
}

JsonValue *json_parse(const char *text, const char **err)
{
    Parser ps = { .p = text };
    JsonValue *v = parse_value(&ps);
    if (!ps.err) {
        skip_ws(&ps);
        if (*ps.p) ps.err = "trailing characters";
    }
    if (ps.err) {
        json_free(v);
        if (err) *err = ps.err;
        return NULL;
    }
    return v;
}

JsonValue *json_load(const char *path, const char **err)
{
    FILE *f = fopen(path, "rb");
    if (!f) {
        if (err) *err = "cannot open file";
        return NULL;
    }
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = n >= 0 ? malloc((size_t)n + 1) : NULL;
    if (!buf || fread(buf, 1, (size_t)n, f) != (size_t)n) {
        fclose(f);
        free(buf);
        if (err) *err = "cannot read file";
        return NULL;
    }
    fclose(f);
    buf[n] = '\0';
    JsonValue *v = json_parse(buf, err);
    free(buf);
    return v;
}

void json_free(JsonValue *v)
{
    while (v) {
        JsonValue *next = v->next;
        json_free(v->child);
        free(v->string);
        free(v->key);
        free(v);
        v = next;
    }
}

const JsonValue *json_get(const JsonValue *obj, const char *key)
{
    if (!obj || obj->type != JSON_OBJECT) return NULL;
    for (const JsonValue *m = obj->child; m; m = m->next)
        if (m->key && !strcmp(m->key, key)) return m;
    return NULL;
}

double json_number(const JsonValue *obj, const char *key, double fallback)
{
    const JsonValue *m = json_get(obj, key);
    return m && m->type == JSON_NUMBER ? m->number : fallback;
}
