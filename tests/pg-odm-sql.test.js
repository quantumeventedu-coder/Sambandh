// tests/pg-odm-sql.test.js — the SQL builder. This file was at 0% coverage: 669
// lines of hand-written SQL generation with nothing verifying it.
//
// The invariant that matters: a document path is interpolated into the SQL string
// (Postgres has no parameter slot for a JSONB path), so a hostile KEY is the one
// way this ORM could be injected. VALUES are always bound as $1/$2 and are never
// a risk. These tests pin both halves.
//
// The builder is pure — filter in, { where, params } out — so no database is
// needed. Every test can fail: the "safe" cases assert exact SQL, so a guard that
// rejected everything would break them.

const { _internal } = require('../src/db/pg-odm');
const { SAFE_PATH, assertSafePath, jsonExpr, sqlPrefilter } = _internal;

describe('SAFE_PATH — what may be interpolated into SQL', () => {
  test.each([
    'phone', '_id', 'profile.city', 'membership.tierExpiresAt', 'photos.0.url', 'a_b.c1'
  ])('accepts the real path %s', (p) => {
    expect(SAFE_PATH.test(p)).toBe(true);
    expect(() => assertSafePath(p)).not.toThrow();
  });

  // Every one of these could break out of the string literal in jsonExpr().
  test.each([
    "a'||(select version())||'",     // quote → concatenation
    "a','x')::text) OR 1=1 --",      // quote → close the call, inject a predicate
    'a"b',                           // double quote
    'a\\b',                          // backslash escape
    'a b',                           // space
    'a;drop table users',            // statement separator
    'a{b}',                          // brace → breaks the #> path literal
    'a,b',                           // comma → extra path element
    '',                              // empty
    '$where'                         // operator-looking key
  ])('rejects the hostile path %j', (p) => {
    expect(SAFE_PATH.test(p)).toBe(false);
    expect(() => assertSafePath(p)).toThrow(/unsafe document path/);
  });
});

describe('jsonExpr fails closed at the point of interpolation', () => {
  test('builds the expected expression for a top-level key', () => {
    expect(jsonExpr('phone').text).toBe("doc->>'phone'");
  });

  test('builds the expected expression for a nested path', () => {
    expect(jsonExpr('profile.city').text).toBe("doc#>>'{profile,city}'");
  });

  // The regression this locks: validation used to live only in the caller, so a
  // new call site would silently re-open injection.
  test('throws on a hostile key even when called directly (not just via the caller)', () => {
    expect(() => jsonExpr("a','x')::text) OR 1=1 --")).toThrow(/unsafe document path/);
    expect(() => jsonExpr("a'||(select version())||'")).toThrow(/unsafe document path/);
  });
});

describe('sqlPrefilter — values are BOUND, never interpolated', () => {
  test('a scalar value becomes a bound parameter, not SQL text', () => {
    const { where, params } = sqlPrefilter({ phone: '+919000000001' });
    expect(where).toContain('$1');
    expect(params).toContain('+919000000001');
    expect(where).not.toContain('+919000000001');   // the value never appears in SQL text
  });

  // The classic injection attempt via a VALUE — must be inert because it is bound.
  test("a value containing quotes/--/OR 1=1 is bound and cannot alter the SQL", () => {
    const evil = "' OR 1=1 --";
    const { where, params } = sqlPrefilter({ phone: evil });
    expect(params).toContain(evil);
    expect(where).not.toContain('OR 1=1');
    expect(where).toContain('$1');
  });

  test('_id is matched on the real column, bound', () => {
    const { where, params } = sqlPrefilter({ _id: '64b7f9c2e1a4d5f6a7b8c9d0' });
    expect(where).toContain('id = $1');
    expect(params).toEqual(['64b7f9c2e1a4d5f6a7b8c9d0']);
  });

  test('$in on _id binds the whole array', () => {
    const { where, params } = sqlPrefilter({ _id: { $in: ['a', 'b'] } });
    expect(where).toContain('= ANY($1::text[])');
    expect(params[0]).toEqual(['a', 'b']);
  });
});

describe('sqlPrefilter — a hostile KEY never reaches SQL', () => {
  test('a hostile key is omitted from WHERE and marks the filter not-full', () => {
    const r = sqlPrefilter({ "a','x')::text) OR 1=1 --": 1 });
    expect(r.where === '' || !/OR 1=1/.test(r.where)).toBe(true);
    expect(r.full).toBe(false);                    // caller must fall back to the JS pass
  });

  test('a hostile key mixed with a safe one keeps the safe predicate and drops the hostile one', () => {
    const r = sqlPrefilter({ phone: '+91900', "x'; drop table users; --": 1 });
    expect(r.where).toContain('$1');
    expect(r.params).toContain('+91900');
    expect(r.where.toLowerCase()).not.toContain('drop table');
    expect(r.full).toBe(false);
  });

  test('$or/$and are not translated (handled by the JS pass) and never interpolated', () => {
    const r = sqlPrefilter({ $or: [{ a: 1 }, { b: 2 }] });
    expect(r.full).toBe(false);
    expect(r.where).not.toContain('$or');
  });

  // Negative control: proves the builder DOES translate ordinary filters, so the
  // tests above are meaningful rather than "everything is skipped".
  test('an ordinary filter IS fully translated (guard is not just refusing everything)', () => {
    const r = sqlPrefilter({ phone: '+919000000001' });
    expect(r.full).toBe(true);
    expect(r.where).not.toBe('');
  });
});
