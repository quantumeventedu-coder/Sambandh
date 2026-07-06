// pg-odm.js — Mongoose-compatible document layer on PostgreSQL (Supabase).
//
// Activated when DATABASE_URL is set (src/db/odm.js does the switching).
// Each collection is one table: (id text primary key, doc jsonb). Documents
// keep their MongoDB shape — 24-hex string ids, ISO dates — so every route,
// model and business rule runs unchanged on either backend.
//
// Implements exactly the API surface this codebase uses (verified by grep):
//   Model.find/findOne/findById/create/countDocuments/distinct/aggregate
//   Model.findByIdAndUpdate/findOneAndUpdate/updateMany/deleteOne/deleteMany
//   chains: .sort .limit .select .lean .populate — plus doc.save()
//   filters: $ne $in $nin $gt $gte $lt $lte $exists $or $and $all $size,
//   RegExp values, dot paths, array-membership equality
//   updates: plain $set-style paths, $inc, $set
// Scale note: queries scan the table and match in JS — correct and plenty for
// launch-scale data; move hot filters into SQL predicates before large scale.

const crypto = require('crypto');
const { Pool } = require('pg');

let pool = null;
const registeredModels = {};
const ensuredTables = new Set();
const connection = { readyState: 0 };

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

// ---------- query matcher (Mongo semantics for the operators we use) ----------
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
          case '$size': {
            if (!Array.isArray(docVal) || docVal.length !== arg) return false;
            break;
          }
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
  if (Array.isArray(docVal) && !Array.isArray(target)) {
    return docVal.some(d => scalarEq(d, target));
  }
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
    if (Array.isArray(spec)) {
      if (doc[key] === undefined) doc[key] = [];
    } else if (isFieldSpec(spec)) {
      if (doc[key] === undefined && spec.default !== undefined) {
        doc[key] = typeof spec.default === 'function' ? spec.default() : spec.default;
      }
    } else if (spec && typeof spec === 'object' && !(spec === Types.Mixed) && spec !== 'Mixed' && typeof spec !== 'function') {
      // nested object definition
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

function refFor(def, path) {
  const spec = getPath(def, path.split('.').join('.'));
  const s = def[path];
  const candidate = s || spec;
  if (Array.isArray(candidate)) return candidate[0] && candidate[0].ref;
  return candidate && candidate.ref;
}

// ---------- table plumbing ----------
function tableName(modelName) { return modelName.toLowerCase() + 's'; }

async function ensureTable(t) {
  if (ensuredTables.has(t)) return;
  await pool.query(`create table if not exists ${t} (id text primary key, doc jsonb not null)`);
  ensuredTables.add(t);
}

async function allDocs(t) {
  await ensureTable(t);
  const r = await pool.query(`select doc from ${t}`);
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
    let docs = (await allDocs(this.model.table)).filter(d => matches(d, this.filter));
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
  for (const f of fields) {
    const v = getPath(doc, f);
    if (v !== undefined) setPath(out, f, v);
  }
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
  const refs = (await allDocs(refModel.table)).filter(r => ids.has(String(r._id)));
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
    else if (key === '$push') {
      for (const p of Object.keys(val)) {
        const arr = getPath(doc, p) || [];
        arr.push(toPlain(val[p]));
        setPath(doc, p, arr);
      }
    }
    else if (key.startsWith('$')) throw new Error('pg-odm: unsupported update operator ' + key);
    else setPath(doc, key, toPlain(val));
  }
}
function toPlain(v) { return v instanceof ObjectId ? v.toString() : v; }

// ---------- model factory ----------
function model(name, schema) {
  if (registeredModels[name]) return registeredModels[name];

  class Model {
    constructor(data) { Object.assign(this, data); }

    static get table() { return tableName(name); }
    static get schema() { return schema; }

    static _instance(plain) {
      const inst = new Model(plain);
      Object.defineProperty(inst, 'toObject', { enumerable: false, value: function () {
        return JSON.parse(JSON.stringify(toStorable({ ...this })));
      }});
      Object.defineProperty(inst, 'save', { enumerable: false, value: async function () {
        validate(schema.def, this, name);
        const stored = toStorable({ ...this });
        await ensureTable(Model.table);
        await pool.query(`update ${Model.table} set doc = $2 where id = $1`, [String(this._id), JSON.stringify(stored)]);
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
      await ensureTable(Model.table);
      await pool.query(`insert into ${Model.table} (id, doc) values ($1, $2)`, [doc._id, JSON.stringify(doc)]);
      return Model._instance(revived);
    }

    static find(filter) { return new Query(Model, filter, 'many'); }
    static findOne(filter) { return new Query(Model, filter, 'one'); }
    static findById(id) {
      if (!id || !ObjectId.isValid(String(id))) return new Query(Model, { _id: '__never__' }, 'one');
      return new Query(Model, { _id: String(id) }, 'one');
    }

    static async countDocuments(filter) {
      if (!filter || !Object.keys(filter).length) {
        await ensureTable(Model.table);
        const r = await pool.query(`select count(*)::int as n from ${Model.table}`);
        return r.rows[0].n;
      }
      return (await allDocs(Model.table)).filter(d => matches(d, filter)).length;
    }

    static async distinct(field, filter) {
      const docs = (await allDocs(Model.table)).filter(d => matches(d, filter || {}));
      const seen = new Map();
      for (const d of docs) {
        const v = getPath(d, field);
        const vals = Array.isArray(v) ? v : [v];
        for (const x of vals) if (x !== undefined && x !== null) seen.set(String(x), x);
      }
      return [...seen.values()];
    }

    static async findByIdAndUpdate(id, update, options = {}) {
      return Model.findOneAndUpdate({ _id: String(id) }, update, options);
    }

    static async findOneAndUpdate(filter, update, options = {}) {
      const docs = (await allDocs(Model.table)).filter(d => matches(d, filter));
      let doc = docs[0];
      if (!doc) {
        if (!options.upsert) return null;
        // Seed from equality fields in the filter, then apply the update
        const seed = {};
        for (const k of Object.keys(filter)) {
          if (k.startsWith('$')) continue;
          const val = filter[k];
          if (val === null || typeof val !== 'object' || val instanceof Date || val instanceof ObjectId) setPath(seed, k, toPlain(val));
        }
        applyUpdate(seed, update, true);
        const created = await Model.create(seed);
        return options.new ? created : null;
      }
      const before = JSON.parse(JSON.stringify(toStorable(doc)));
      applyUpdate(doc, update);
      await pool.query(`update ${Model.table} set doc = $2 where id = $1`,
        [String(doc._id), JSON.stringify(toStorable(doc))]);
      return Model._instance(options.new ? doc : revive(before));
    }

    static async updateMany(filter, update) {
      const docs = (await allDocs(Model.table)).filter(d => matches(d, filter));
      for (const doc of docs) {
        applyUpdate(doc, update);
        await pool.query(`update ${Model.table} set doc = $2 where id = $1`,
          [String(doc._id), JSON.stringify(toStorable(doc))]);
      }
      return { modifiedCount: docs.length };
    }

    static async deleteOne(filter) {
      const docs = (await allDocs(Model.table)).filter(d => matches(d, filter));
      if (docs[0]) await pool.query(`delete from ${Model.table} where id = $1`, [String(docs[0]._id)]);
      return { deletedCount: docs[0] ? 1 : 0 };
    }

    static async deleteMany(filter) {
      const docs = (await allDocs(Model.table)).filter(d => matches(d, filter));
      for (const d of docs) await pool.query(`delete from ${Model.table} where id = $1`, [String(d._id)]);
      return { deletedCount: docs.length };
    }

    static async aggregate(pipeline) {
      let rows = await allDocs(Model.table);
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
            if (!groups.has(k)) {
              const init = { _id: key };
              for (const f of Object.keys(spec)) if (f !== '_id') init[f] = 0;
              groups.set(k, init);
            }
            const g = groups.get(k);
            for (const f of Object.keys(spec)) {
              if (f === '_id') continue;
              const acc = spec[f];
              if (acc.$sum !== undefined) {
                const inc = acc.$sum === 1 ? 1 :
                  typeof acc.$sum === 'string' ? (Number(getPath(d, acc.$sum.slice(1))) || 0) : acc.$sum;
                g[f] += inc;
              }
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
async function connect(url) {
  const u = new URL(url);
  pool = new Pool({
    host: u.hostname,
    port: +(u.port || 5432),
    database: u.pathname.replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: false },
    max: process.env.VERCEL ? 2 : 6,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 15000
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

module.exports = { Schema, model, connect, disconnect, connection, Types, isPg: true };
