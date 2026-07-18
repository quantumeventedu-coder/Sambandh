// pg-odm.js — Mongoose-compatible document layer on PostgreSQL (Supabase).
//
// Activated when DATABASE_URL is set (src/db/odm.js does the switching).
// Each collection is one table: (id text primary key, doc jsonb). Documents
// keep their MongoDB shape — 24-hex string ids, ISO dates — so every route,
// model and business rule runs unchanged on either backend.
//
// SCALE MODEL (hardened July 2026):
//   · Reads translate the filter into a SQL WHERE on the JSONB column and let
//     Postgres do the work — no more "SELECT * → filter in Node". The JS matcher
//     still runs on the returned rows as the CORRECTNESS AUTHORITY, so the SQL
//     pre-filter only ever needs to be *permissive* (a superset); it can never
//     cause a wrong result, only affect how many rows Postgres returns.
//   · Every table gets a GIN index (array membership / containment) plus btree
//     expression indexes on hot reference paths (chatId, from, to, userId, …)
//     and unique indexes for fields declared `unique` (phone, razorpayPaymentId).
//   · findById hits the primary key directly.
//
// Implements exactly the API surface this codebase uses (verified by grep):
//   Model.find/findOne/findById/create/countDocuments/distinct/aggregate
//   Model.findByIdAndUpdate/findOneAndUpdate(+upsert,+$setOnInsert)/updateMany
//   Model.deleteOne/deleteMany · chains .sort .limit .select .lean .populate
//   filters: $ne $in $nin $gt $gte $lt $lte $exists $or $and $all $size $regex,
//   RegExp values, dot paths, array-membership equality
//   updates: plain paths, $set, $setOnInsert, $inc, $push · doc.save()

const crypto = require('crypto');
const { Pool } = require('pg');

let pool = null;
const registeredModels = {};
const ensuredTables = new Set();
const connection = { readyState: 0 };

// Single-level reference fields worth a btree index when present in a schema.
const HOT_PATHS = ['chatId', 'from', 'to', 'userId', 'viewingUserId', 'targetUserId',
  'reportedUserId', 'reporterId', 'razorpayOrderId', 'token'];

function newId() { return crypto.randomBytes(12).toString('hex'); }

function ObjectId(v) {
  if (!(this instanceof ObjectId)) return new ObjectId(v);
  this.str = v ? String(v) : newId();
}
ObjectId.prototype.toString = function () { return this.str; };
ObjectId.prototype.toJSON = function () { return this.str; };
ObjectId.isValid = v => /^[0-9a-fA-F]{24}$/.test(String(v));

const Types = { ObjectId, Mixed: 'Mixed' };

// ---------- (de)serialization ----------
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function toStorable(v) {
  if (v === undefined) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof ObjectId) return v.toString();
  if (Array.isArray(v)) return v.map(toStorable);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) {
      const s = toStorable(v[k]);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return v;
}

function revive(v) {
  if (typeof v === 'string' && ISO_RE.test(v)) return new Date(v);
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = revive(v[k]);
    return out;
  }
  return v;
}

// ---------- path helpers ----------
function getPath(doc, path) {
  const parts = String(path).split('.');
  let cur = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setPath(doc, path, value) {
  const parts = String(path).split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ---------- query matcher (authoritative Mongo semantics) ----------
function comparable(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string' && ISO_RE.test(v)) return new Date(v).getTime();
  return v;
}

function scalarEq(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (a instanceof Date || b instanceof Date) return comparable(a) === comparable(b);
  if (typeof a !== 'object' && typeof b !== 'object') return String(a) === String(b) || a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function valueMatches(docVal, cond) {
  if (cond instanceof RegExp) {
    if (Array.isArray(docVal)) return docVal.some(x => cond.test(String(x)));
    return typeof docVal === 'string' && cond.test(docVal);
  }
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date) && !(cond instanceof ObjectId)) {
    const ops = Object.keys(cond);
    if (ops.length && ops.every(k => k.startsWith('$'))) {
      for (const op of ops) {
        const arg = cond[op];
        switch (op) {
          case '$ne': if (matchEquality(docVal, arg)) return false; break;
          case '$in': {
            const arr = Array.isArray(docVal) ? docVal : [docVal];
            if (!arg.some(a => arr.some(d => scalarEq(d, a) || (a instanceof RegExp && a.test(String(d)))))) return false;
            break;
          }
          case '$nin': {
            const arr = Array.isArray(docVal) ? docVal : [docVal];
            if (arg.some(a => arr.some(d => scalarEq(d, a)))) return false;
            break;
          }
          case '$gt': if (!(comparable(docVal) > comparable(arg))) return false; break;
          case '$gte': if (!(comparable(docVal) >= comparable(arg))) return false; break;
          case '$lt': if (!(comparable(docVal) < comparable(arg))) return false; break;
          case '$lte': if (!(comparable(docVal) <= comparable(arg))) return false; break;
          case '$exists': if ((docVal !== undefined) !== !!arg) return false; break;
          case '$all': {
            const arr = Array.isArray(docVal) ? docVal : [];
            if (!arg.every(a => arr.some(d => scalarEq(d, a)))) return false;
            break;
          }
          case '$size': if (!Array.isArray(docVal) || docVal.length !== arg) return false; break;
          case '$regex': {
            const rx = arg instanceof RegExp ? arg : new RegExp(arg, cond.$options || '');
            if (!(typeof docVal === 'string' && rx.test(docVal))) return false;
            break;
          }
          case '$options': break;
          default: throw new Error('pg-odm: unsupported operator ' + op);
        }
      }
      return true;
    }
  }
  return matchEquality(docVal, cond);
}

function matchEquality(docVal, target) {
  if (Array.isArray(docVal) && !Array.isArray(target)) return docVal.some(d => scalarEq(d, target));
  return scalarEq(docVal, target);
}

function matches(doc, filter) {
  for (const key of Object.keys(filter || {})) {
    const cond = filter[key];
    if (key === '$or') { if (!cond.some(f => matches(doc, f))) return false; continue; }
    if (key === '$and') { if (!cond.every(f => matches(doc, f))) return false; continue; }
    if (!valueMatches(getPath(doc, key), cond)) return false;
  }
  return true;
}

// ---------- SQL pre-filter (a permissive superset; JS matcher is authority) ----------
// The ONLY characters allowed in a document path that gets interpolated into a
// JSONB expression. No quote, brace, backslash or space can appear, so a path can
// never break out of the SQL string literals built in jsonExpr().
//
// Values are always bound as parameters ($1, $2…) — never interpolated. KEYS
// cannot be bound (Postgres has no parameter slot for a path literal), so they
// must be validated instead. This check lives at the point of interpolation so a
// future caller cannot forget it; sqlPrefilter also screens keys earlier and
// simply omits anything unsafe from the WHERE clause.
const SAFE_PATH = /^[A-Za-z0-9_.]+$/;

function assertSafePath(key) {
  if (!SAFE_PATH.test(String(key))) {
    throw new Error(`pg-odm: unsafe document path ${JSON.stringify(String(key))}`);
  }
}

function jsonExpr(key) {
  assertSafePath(key);                 // fail closed — never interpolate an unvalidated key
  const parts = key.split('.');
  if (parts.length === 1) return { text: `doc->>'${parts[0]}'`, node: `doc->'${parts[0]}'` };
  const lit = `'{${parts.join(',')}}'`;
  return { text: `doc#>>${lit}`, node: `doc#>${lit}` };
}

function scalarStr(v) {
  return v instanceof ObjectId ? v.toString()
    : v instanceof Date ? v.toISOString()
      : String(v);
}

// Returns { where, params, full }. `full` = every key translated with EXACT
// semantics (safe to COUNT in SQL without the JS pass). Any key we can't
// translate is simply omitted from WHERE (superset) and clears `full`.
function sqlPrefilter(filter) {
  const parts = [], params = [];
  let full = true;
  const bind = v => { params.push(v); return '$' + params.length; };

  for (const key of Object.keys(filter || {})) {
    const cond = filter[key];
    const snap = params.length;           // roll-back point if this key isn't fully translatable
    const skip = () => { params.length = snap; full = false; }; // undo any stray binds

    if (key === '$or' || key === '$and') { full = false; continue; }
    // Unsafe keys are omitted from WHERE (the result stays a superset and the JS
    // pass filters exactly), so a hostile key degrades to "no SQL predicate"
    // rather than reaching the interpolation in jsonExpr().
    if (!SAFE_PATH.test(key)) { full = false; continue; }

    if (key === '_id') {
      if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
        if ('$in' in cond) { parts.push(`id = ANY(${bind(cond.$in.map(String))}::text[])`); continue; }
        if ('$nin' in cond) { parts.push(`NOT (id = ANY(${bind(cond.$nin.map(String))}::text[]))`); continue; }
        if ('$ne' in cond) { parts.push(`id <> ${bind(String(cond.$ne))}`); continue; }
        full = false; continue;
      }
      parts.push(`id = ${bind(scalarStr(cond))}`); continue;
    }

    const e = jsonExpr(key);
    if (cond instanceof RegExp) { full = false; continue; }

    // operator object
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !(cond instanceof ObjectId) && !Array.isArray(cond)) {
      const ops = Object.keys(cond);
      if (!ops.length || !ops.every(k => k.startsWith('$'))) { full = false; continue; }
      const local = []; let ok = true;
      for (const op of ops) {
        const arg = cond[op];
        if (op === '$exists') local.push(arg ? `${e.node} IS NOT NULL` : `${e.node} IS NULL`);
        else if (['$gt', '$gte', '$lt', '$lte'].includes(op)) {
          const s = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op];
          if (arg instanceof Date || typeof arg === 'string') {
            local.push(`(jsonb_typeof(${e.node}) = 'string' AND ${e.text} ${s} ${bind(arg instanceof Date ? arg.toISOString() : arg)})`);
          } else if (typeof arg === 'number') {
            local.push(`(jsonb_typeof(${e.node}) = 'number' AND (${e.text})::numeric ${s} ${bind(String(arg))}::numeric)`);
          } else { ok = false; break; }
        }
        else if (op === '$in') {
          if (!Array.isArray(arg) || !arg.every(a => a === null || ['string', 'number', 'boolean'].includes(typeof a) || a instanceof ObjectId)) { ok = false; break; }
          const arr = arg.map(scalarStr), p = bind(arr);
          // jsonb_exists_any = the ?| operator in function form (node-postgres mis-parses "?")
          local.push(`(${e.text} = ANY(${p}::text[]) OR (jsonb_typeof(${e.node}) = 'array' AND jsonb_exists_any(${e.node}, ${p}::text[])))`);
        }
        else if (op === '$all') {
          if (!Array.isArray(arg) || !arg.every(a => typeof a === 'string' || a instanceof ObjectId)) { ok = false; break; }
          local.push(`(jsonb_typeof(${e.node}) = 'array' AND jsonb_exists_all(${e.node}, ${bind(arg.map(scalarStr))}::text[]))`);
        }
        else { ok = false; break; } // $ne/$nin/$size/$regex → JS handles
      }
      // A key is only translatable if EVERY operator translated. A partial
      // translation would leave a bound param with no placeholder — roll back.
      if (ok && local.length && local.length === ops.filter(o => o !== '$options').length) parts.push(local.join(' AND '));
      else skip();
      continue;
    }

    // scalar equality: field == value OR (field is array containing value)
    if (cond === null || (typeof cond === 'object' && !(cond instanceof Date) && !(cond instanceof ObjectId))) { full = false; continue; }
    const p = bind(scalarStr(cond));
    // jsonb_exists = the "?" operator in function form (node-postgres mis-parses "?")
    parts.push(`(${e.text} = ${p} OR (jsonb_typeof(${e.node}) = 'array' AND jsonb_exists(${e.node}, ${p})))`);
  }
  return { where: parts.length ? parts.join(' AND ') : 'true', params, full };
}

// ---------- schema ----------
class Schema {
  constructor(def, options = {}) { this.def = def; this.options = options; }
  index() { return this; }
}
Schema.Types = Types;

function isFieldSpec(v) {
  return v && typeof v === 'object' && !Array.isArray(v) &&
    typeof v.type !== 'undefined' && (typeof v.type === 'function' || v.type === 'Mixed' || v.type === Types.ObjectId || v.type === Types.Mixed);
}

function applyDefaults(def, doc) {
  for (const key of Object.keys(def)) {
    const spec = def[key];
    if (key === '_id') continue;
    if (Array.isArray(spec)) { if (doc[key] === undefined) doc[key] = []; }
    else if (isFieldSpec(spec)) {
      if (doc[key] === undefined && spec.default !== undefined) doc[key] = typeof spec.default === 'function' ? spec.default() : spec.default;
    } else if (spec && typeof spec === 'object' && spec !== Types.Mixed && spec !== 'Mixed' && typeof spec !== 'function') {
      if (doc[key] === undefined) doc[key] = {};
      if (doc[key] && typeof doc[key] === 'object' && !Array.isArray(doc[key])) applyDefaults(spec, doc[key]);
    }
  }
}

function validate(def, doc, modelName) {
  for (const key of Object.keys(def)) {
    const spec = def[key];
    if (!isFieldSpec(spec)) continue;
    let required = spec.required;
    if (typeof required === 'function') required = required.call(doc);
    if (Array.isArray(spec.required)) required = spec.required[0];
    if (required && (doc[key] === undefined || doc[key] === null || doc[key] === '')) {
      throw new Error(`${modelName} validation failed: ${key}: Path \`${key}\` is required.`);
    }
    if (spec.enum && doc[key] !== undefined && doc[key] !== null && !spec.enum.includes(doc[key])) {
      throw new Error(`${modelName} validation failed: ${key}: \`${doc[key]}\` is not a valid enum value for path \`${key}\`.`);
    }
  }
}

function uniqueFieldsOf(def) {
  return Object.keys(def).filter(k => isFieldSpec(def[k]) && def[k].unique === true);
}

function refFor(def, path) {
  const s = def[path];
  const candidate = s || getPath(def, path);
  if (Array.isArray(candidate)) return candidate[0] && candidate[0].ref;
  return candidate && candidate.ref;
}

// ---------- table plumbing ----------
function tableName(modelName) { return modelName.toLowerCase() + 's'; }

async function ensureTable(model) {
  const t = model.table;
  if (ensuredTables.has(t)) return;
  await pool.query(`create table if not exists ${t} (id text primary key, doc jsonb not null)`);
  ensuredTables.add(t); // mark early: the table exists; indexes are best-effort accelerators

  // Index creation is non-fatal — a pre-existing duplicate on an already-populated
  // table must never brick reads/writes. New/clean tables get every index.
  const tryIndex = async (sql, label) => {
    try { await pool.query(sql); }
    catch (e) { console.warn(`[pg-odm] index ${label} on ${t} skipped: ${e.message.split('\n')[0]}`); }
  };
  // GIN accelerates array membership (?) and containment (@>)
  await tryIndex(`create index if not exists ${t}_doc_gin on ${t} using gin (doc)`, 'gin');
  // btree expression indexes on hot single-level reference paths present in the schema
  // (field names come from schema definitions, not user input — but they are still
  // interpolated into DDL, so they go through the same guard.)
  for (const f of HOT_PATHS) {
    if (model.schema.def[f] !== undefined) {
      assertSafePath(f);
      await tryIndex(`create index if not exists ${t}_${f.toLowerCase()}_idx on ${t} ((doc->>'${f}'))`, f);
    }
  }
  // DB-level uniqueness (partial: only when the field is present)
  for (const f of model._uniqueFields) {
    assertSafePath(f);
    await tryIndex(`create unique index if not exists ${t}_${f.toLowerCase()}_uniq on ${t} ((doc->>'${f}')) where doc->>'${f}' is not null`, f + '_uniq');
  }
}

async function loadDocs(model, filter) {
  await ensureTable(model);
  const { where, params } = sqlPrefilter(filter || {});
  let r;
  try {
    r = await pool.query(`select doc from ${model.table} where ${where}`, params);
  } catch (err) {
    console.error('[pg-odm] query failed on', model.table, '::', where, ':: params', JSON.stringify(params), '::', err.message);
    throw err;
  }
  const docs = r.rows.map(row => revive(row.doc));
  return (filter && Object.keys(filter).length) ? docs.filter(d => matches(d, filter)) : docs;
}

async function allDocs(model) {
  await ensureTable(model);
  const r = await pool.query(`select doc from ${model.table}`);
  return r.rows.map(row => revive(row.doc));
}

// ---------- query builder ----------
class Query {
  constructor(model, filter, mode) {
    this.model = model; this.filter = filter || {}; this.mode = mode;
    this._sort = null; this._limit = null; this._select = null; this._populate = [];
  }
  sort(s) { this._sort = s; return this; }
  limit(n) { this._limit = n; return this; }
  select(s) { this._select = s; return this; }
  lean() { this._lean = true; return this; }
  populate(path, select) { this._populate.push({ path, select }); return this; }

  async exec() {
    let docs = await loadDocs(this.model, this.filter);
    if (this._sort) {
      const keys = Object.entries(this._sort);
      docs.sort((a, b) => {
        for (const [k, dir] of keys) {
          const av = comparable(getPath(a, k)), bv = comparable(getPath(b, k));
          if (av === bv) continue;
          if (av === undefined) return 1;
          if (bv === undefined) return -1;
          return (av < bv ? -1 : 1) * (dir < 0 ? -1 : 1);
        }
        return 0;
      });
    }
    if (this._limit != null) docs = docs.slice(0, this._limit);
    for (const p of this._populate) docs = await populateDocs(this.model, docs, p);
    if (this._select) docs = docs.map(d => project(d, this._select));
    if (this.mode === 'one') {
      const d = docs[0] || null;
      return d && !this._lean && !this._select ? this.model._instance(d) : d;
    }
    return this._lean || this._select ? docs : docs.map(d => this.model._instance(d));
  }
  then(res, rej) { return this.exec().then(res, rej); }
  catch(rej) { return this.exec().catch(rej); }
}

function project(doc, selectStr) {
  const fields = String(selectStr).trim().split(/\s+/).filter(f => f && !f.startsWith('-'));
  if (!fields.length) return doc;
  const out = { _id: doc._id };
  for (const f of fields) { const v = getPath(doc, f); if (v !== undefined) setPath(out, f, v); }
  return out;
}

async function populateDocs(model, docs, { path, select }) {
  const refName = refFor(model.schema.def, path);
  const refModel = refName && registeredModels[refName];
  if (!refModel) return docs;
  const ids = new Set();
  for (const d of docs) {
    const v = getPath(d, path);
    if (Array.isArray(v)) v.forEach(x => x && ids.add(String(x)));
    else if (v) ids.add(String(v));
  }
  if (!ids.size) return docs;
  const refs = await loadDocs(refModel, { _id: { $in: [...ids] } });
  const byId = Object.fromEntries(refs.map(r => [String(r._id), select ? project(r, select) : r]));
  for (const d of docs) {
    const v = getPath(d, path);
    if (Array.isArray(v)) setPath(d, path, v.map(x => byId[String(x)] || x));
    else if (v && byId[String(v)]) setPath(d, path, byId[String(v)]);
  }
  return docs;
}

// ---------- updates ----------
function applyUpdate(doc, update, isInsert = false) {
  for (const key of Object.keys(update || {})) {
    const val = update[key];
    if (key === '$set') { for (const p of Object.keys(val)) setPath(doc, p, toPlain(val[p])); }
    else if (key === '$setOnInsert') { if (isInsert) for (const p of Object.keys(val)) setPath(doc, p, toPlain(val[p])); }
    else if (key === '$inc') { for (const p of Object.keys(val)) setPath(doc, p, (Number(getPath(doc, p)) || 0) + val[p]); }
    else if (key === '$push') { for (const p of Object.keys(val)) { const arr = getPath(doc, p) || []; arr.push(toPlain(val[p])); setPath(doc, p, arr); } }
    else if (key.startsWith('$')) throw new Error('pg-odm: unsupported update operator ' + key);
    else setPath(doc, key, toPlain(val));
  }
}
function toPlain(v) { return v instanceof ObjectId ? v.toString() : v; }

function dupError(modelName, err) {
  const e = new Error(`E11000 duplicate key error collection: ${modelName}`);
  e.code = 11000; e.cause = err;
  return e;
}

// ---------- model factory ----------
function model(name, schema) {
  if (registeredModels[name]) return registeredModels[name];

  class Model {
    constructor(data) { Object.assign(this, data); }
    static get table() { return tableName(name); }
    static get schema() { return schema; }
    static get _uniqueFields() { return uniqueFieldsOf(schema.def); }

    static _instance(plain) {
      const inst = new Model(plain);
      Object.defineProperty(inst, 'toObject', { enumerable: false, value: function () {
        return JSON.parse(JSON.stringify(toStorable({ ...this })));
      }});
      Object.defineProperty(inst, 'save', { enumerable: false, value: async function () {
        validate(schema.def, this, name);
        await ensureTable(Model);
        try {
          await pool.query(`update ${Model.table} set doc = $2 where id = $1`, [String(this._id), JSON.stringify(toStorable({ ...this }))]);
        } catch (err) { if (err.code === '23505') throw dupError(name, err); throw err; }
        return this;
      }});
      return inst;
    }

    static async create(data) {
      if (Array.isArray(data)) { const out = []; for (const d of data) out.push(await Model.create(d)); return out; }
      const doc = JSON.parse(JSON.stringify(toStorable({ ...data })));
      applyDefaults(schema.def, doc);
      if (schema.options && schema.options.timestamps) {
        doc.createdAt = doc.createdAt || new Date().toISOString();
        doc.updatedAt = new Date().toISOString();
      }
      doc._id = doc._id ? String(doc._id) : newId();
      const revived = revive(doc);
      validate(schema.def, revived, name);
      await ensureTable(Model);
      try {
        await pool.query(`insert into ${Model.table} (id, doc) values ($1, $2)`, [doc._id, JSON.stringify(doc)]);
      } catch (err) { if (err.code === '23505') throw dupError(name, err); throw err; }
      return Model._instance(revived);
    }

    static find(filter) { return new Query(Model, filter, 'many'); }
    static findOne(filter) { return new Query(Model, filter, 'one'); }
    static findById(id) {
      if (!id || !ObjectId.isValid(String(id))) return new Query(Model, { _id: '__never__' }, 'one');
      return new Query(Model, { _id: String(id) }, 'one');
    }

    static async countDocuments(filter) {
      await ensureTable(Model);
      const { where, params, full } = sqlPrefilter(filter || {});
      if (full) {
        const r = await pool.query(`select count(*)::int n from ${Model.table} where ${where}`, params);
        return r.rows[0].n;
      }
      return (await loadDocs(Model, filter)).length;
    }

    static async distinct(field, filter) {
      const docs = await loadDocs(Model, filter || {});
      const seen = new Map();
      for (const d of docs) {
        const v = getPath(d, field);
        for (const x of (Array.isArray(v) ? v : [v])) if (x !== undefined && x !== null) seen.set(String(x), x);
      }
      return [...seen.values()];
    }

    static async findByIdAndUpdate(id, update, options = {}) {
      return Model.findOneAndUpdate({ _id: String(id) }, update, options);
    }

    static async findOneAndUpdate(filter, update, options = {}) {
      const doc = (await loadDocs(Model, filter))[0];
      if (!doc) {
        if (!options.upsert) return null;
        const seed = {};
        for (const k of Object.keys(filter)) if (!k.startsWith('$') && typeof filter[k] !== 'object') setPath(seed, k, filter[k]);
        applyUpdate(seed, update, true);
        const created = await Model.create(seed);
        return options.new ? created : null;
      }
      const before = JSON.parse(JSON.stringify(toStorable(doc)));
      applyUpdate(doc, update);
      try {
        await pool.query(`update ${Model.table} set doc = $2 where id = $1`, [String(doc._id), JSON.stringify(toStorable(doc))]);
      } catch (err) { if (err.code === '23505') throw dupError(name, err); throw err; }
      return Model._instance(options.new ? doc : revive(before));
    }

    static async updateMany(filter, update) {
      const docs = await loadDocs(Model, filter);
      for (const doc of docs) {
        applyUpdate(doc, update);
        await pool.query(`update ${Model.table} set doc = $2 where id = $1`, [String(doc._id), JSON.stringify(toStorable(doc))]);
      }
      return { modifiedCount: docs.length };
    }

    static async deleteOne(filter) {
      const doc = (await loadDocs(Model, filter))[0];
      if (doc) await pool.query(`delete from ${Model.table} where id = $1`, [String(doc._id)]);
      return { deletedCount: doc ? 1 : 0 };
    }

    static async deleteMany(filter) {
      const docs = await loadDocs(Model, filter);
      for (const d of docs) await pool.query(`delete from ${Model.table} where id = $1`, [String(d._id)]);
      return { deletedCount: docs.length };
    }

    static async aggregate(pipeline) {
      let rows = await allDocs(Model);
      let grouped = null;
      for (const stage of pipeline) {
        if (stage.$match) rows = rows.filter(d => matches(d, stage.$match));
        else if (stage.$group) {
          const spec = stage.$group;
          const groups = new Map();
          for (const d of rows) {
            const key = spec._id === null ? null :
              typeof spec._id === 'string' && spec._id.startsWith('$') ? getPath(d, spec._id.slice(1)) : spec._id;
            const k = key === null ? '__null__' : String(key);
            if (!groups.has(k)) { const init = { _id: key }; for (const f of Object.keys(spec)) if (f !== '_id') init[f] = 0; groups.set(k, init); }
            const g = groups.get(k);
            for (const f of Object.keys(spec)) {
              if (f === '_id') continue;
              const acc = spec[f];
              if (acc.$sum !== undefined) g[f] += acc.$sum === 1 ? 1 : typeof acc.$sum === 'string' ? (Number(getPath(d, acc.$sum.slice(1))) || 0) : acc.$sum;
            }
          }
          grouped = [...groups.values()];
        }
        else if (stage.$sort) {
          const target = grouped || rows;
          const keys = Object.entries(stage.$sort);
          target.sort((a, b) => {
            for (const [k, dir] of keys) {
              const av = comparable(getPath(a, k)), bv = comparable(getPath(b, k));
              if (av === bv) continue;
              return (av < bv ? -1 : 1) * (dir < 0 ? -1 : 1);
            }
            return 0;
          });
        }
      }
      return grouped || rows;
    }
  }

  registeredModels[name] = Model;
  return Model;
}

// ---------- connection ----------
// Supabase pooler modes (same host, different port):
//   :5432 SESSION     — each client holds a DEDICATED Postgres connection for its
//                       whole life. Capped at pool_size (~15). Fine for one long-
//                       running server; fatal for serverless.
//   :6543 TRANSACTION — connections are MULTIPLEXED: one is held only for the
//                       duration of a statement, then returned. Hundreds of
//                       clients share a small pool.
// Serverless runs many independent lambdas, each with its own pool, so session
// mode is exhausted almost immediately → "EMAXCONNSESSION: max clients reached in
// session mode". Transaction mode is Supabase's documented serverless setup, and
// it is safe here because this ODM only issues single, parameterised,
// unnamed-prepared-statement queries (no BEGIN/SET/LISTEN/named statements).
function poolerPortFor(u) {
  const port = +(u.port || 5432);
  const isSupabasePooler = /pooler\.supabase\.com$/i.test(u.hostname);
  if (isSupabasePooler && port === 5432 && (process.env.VERCEL || process.env.PG_TRANSACTION_POOL === 'true')) {
    console.log('[DB] serverless detected → using Supabase TRANSACTION pooler :6543 (session :5432 caps at ~15 clients)');
    return 6543;
  }
  return port;
}

async function connect(url) {
  const u = new URL(url);
  const port = poolerPortFor(u);
  const transactionMode = port === 6543;
  pool = new Pool({
    host: u.hostname,
    port,
    database: u.pathname.replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: false },
    // Transaction mode multiplexes, so a couple of connections per lambda is
    // plenty and leaves headroom for many concurrent lambdas.
    max: process.env.VERCEL ? 2 : 8,
    // Release idle connections fast on serverless so a warm-but-idle lambda
    // isn't squatting on a slot another one needs.
    idleTimeoutMillis: process.env.VERCEL ? 5000 : 20000,
    connectionTimeoutMillis: 15000,
    ...(transactionMode ? { statement_timeout: 20000 } : {})
  });
  await pool.query('select 1');
  connection.readyState = 1;
  return module.exports;
}

async function disconnect() {
  if (pool) await pool.end();
  pool = null;
  connection.readyState = 0;
  ensuredTables.clear();
}

// Test-only seam: inject a pre-built pg-compatible executor ({ query, end }) so the
// ODM can run against an in-process Postgres (pglite) in tests — exercising the
// REAL SQL/JSONB engine production uses, not a Mongo emulator (see ADR-001). Not
// used by any production path; production always goes through connect(url).
function _setPoolForTests(poolLike) { pool = poolLike; connection.readyState = poolLike ? 1 : 0; }

module.exports = { Schema, model, connect, disconnect, connection, Types, isPg: true };

// Internals exposed for unit tests only. The SQL builder is pure (filter in, SQL
// + bound params out), so it can — and must — be tested without a database.
// Not part of the public ODM surface; do not use from application code.
module.exports._internal = { SAFE_PATH, assertSafePath, jsonExpr, sqlPrefilter, scalarStr, _setPoolForTests };
