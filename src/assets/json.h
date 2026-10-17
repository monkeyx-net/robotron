/*
 * Small JSON reader for the asset metadata (the sprites/ JSON files). Parses a whole
 * document into a tree; numbers are doubles, strings are UTF-8 with escapes
 * decoded. Not for untrusted megabyte inputs, just our own small files.
 */
#ifndef ROBOTRON_JSON_H
#define ROBOTRON_JSON_H

#include <stddef.h>

typedef enum { JSON_NULL, JSON_BOOL, JSON_NUMBER, JSON_STRING, JSON_ARRAY, JSON_OBJECT } JsonType;

typedef struct JsonValue JsonValue;
struct JsonValue {
    JsonType type;
    double number;      /* JSON_NUMBER, JSON_BOOL (0/1) */
    char *string;       /* JSON_STRING */
    char *key;          /* set on members of an object */
    JsonValue *child;   /* first element/member of an array/object */
    JsonValue *next;    /* next sibling */
};

/* Parse text (NUL-terminated). Returns NULL on error and sets *err. */
JsonValue *json_parse(const char *text, const char **err);
/* Read and parse a file. */
JsonValue *json_load(const char *path, const char **err);
void json_free(JsonValue *v);

/* Member of an object by key, or NULL. */
const JsonValue *json_get(const JsonValue *obj, const char *key);
/* Number member, or `fallback` if missing or not a number. */
double json_number(const JsonValue *obj, const char *key, double fallback);

#endif
