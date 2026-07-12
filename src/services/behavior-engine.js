// services/behavior-engine.js — turns a user's raw event stream (models/Event)
// into an evolving, uncertainty-aware behavioural read: activity level, temporal
// consistency, behavioural DRIFT (recent window vs baseline), and HABITS. This is
// the shipping implementation of Vol I Ch 5/9 of the architecture manual — the
// "next real step" the spec flagged as not-yet-built. Pure & deterministic: feed
// it events, get a report. No labels are stored; behaviour is always re-derived.

const DAY = 86400000;
const IST = 5.5 * 3600000;                       // India-centric hour-of-day habit
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a, m = mean(a)) => (a.length ? Math.sqrt(mean(a.map(x => (x - m) ** 2))) : 0);
const argmax = a => a.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);

// The main read. `now` is injectable for deterministic tests.
function analyze(events, now = Date.now()) {
  const evs = (events || [])
    .filter(e => e && e.createdAt && e.type)
    .map(e => ({ type: e.type, t: new Date(e.createdAt).getTime() }))
    .sort((a, b) => a.t - b.t);
  const n = evs.length;
  if (n === 0) return { available: false, reason: 'no events yet' };

  const ts = evs.map(e => e.t);
  const firstAt = ts[0], lastAt = ts[n - 1];
  const spanDays = Math.max((lastAt - firstAt) / DAY, 0);
  const totalDays = Math.max(1, Math.round(spanDays) + 1);
  const recencyDays = Math.max(0, (now - lastAt) / DAY);

  // ---- daily buckets → activity + consistency ----
  const dayKey = t => Math.floor(t / DAY);
  const byDay = new Map();
  for (const t of ts) byDay.set(dayKey(t), (byDay.get(dayKey(t)) || 0) + 1);
  const activeDays = byDay.size;
  const perActiveDay = n / activeDays;
  const perCalendarDay = n / totalDays;

  // Consistency = how evenly activity is spread across the observed window.
  // Coefficient of variation of daily counts → steadiness in [0,1].
  const dailyCounts = [...byDay.values()];
  const mC = mean(dailyCounts), sC = std(dailyCounts, mC);
  const cv = mC > 0 ? sC / mC : 0;
  const steadiness = clamp(1 - cv / 2);            // cv 0 → 1.0 ; cv ≥ 2 → 0
  const consistencyLabel = steadiness > 0.66 ? 'very steady' : steadiness > 0.4 ? 'moderate' : 'sporadic';

  // ---- behavioural drift: recent 7d vs the previous 7d ----
  const recent = ts.filter(t => t >= now - 7 * DAY).length;
  const previous = ts.filter(t => t >= now - 14 * DAY && t < now - 7 * DAY).length;
  const driftMag = (recent - previous) / Math.max(previous, 1);
  const direction = driftMag > 0.25 ? 'rising' : driftMag < -0.25 ? 'declining' : 'steady';
  const driftConfidence = clamp((Math.min(previous + recent, 20) / 20));

  // ---- habits: dominant hour (IST) + weekday, and daily-habit detection ----
  const hours = new Array(24).fill(0), weekdays = new Array(7).fill(0);
  for (const t of ts) {
    const d = new Date(t + IST);
    hours[d.getUTCHours()]++; weekdays[d.getUTCDay()]++;
  }
  const activeDaysLast14 = new Set(ts.filter(t => t >= now - 14 * DAY).map(dayKey)).size;
  const dailyHabit = activeDaysLast14 >= 10;       // active ≥10 of the last 14 days

  // ---- engagement mix by event type ----
  const mix = {};
  for (const e of evs) mix[e.type] = (mix[e.type] || 0) + 1;

  // Confidence grows with volume + observed span.
  const confidence = clamp((Math.min(n, 60) / 60) * 0.6 + (Math.min(totalDays, 30) / 30) * 0.4);

  return {
    available: true,
    events: n,
    activeDays,
    spanDays: +spanDays.toFixed(1),
    recencyDays: +recencyDays.toFixed(1),
    confidence: +confidence.toFixed(2),
    activity: {
      perCalendarDay: +perCalendarDay.toFixed(2),
      perActiveDay: +perActiveDay.toFixed(2),
      recent7: recent, previous7: previous,
      status: recencyDays < 1 ? 'active today' : recencyDays < 7 ? 'active this week' : recencyDays < 30 ? 'quiet' : 'dormant'
    },
    consistency: { steadiness: +steadiness.toFixed(2), cv: +cv.toFixed(2), label: consistencyLabel },
    drift: { direction, magnitude: +driftMag.toFixed(2), recent7: recent, previous7: previous, confidence: +driftConfidence.toFixed(2) },
    habits: { dominantHourIST: argmax(hours), dominantWeekday: WEEKDAYS[argmax(weekdays)], dailyHabit, activeDaysLast14 },
    mix
  };
}

// Human-readable insight lines derived from a report — used by the in-app
// "your rhythm" view and the super-admin dossier. Never over-claims: lines are
// hedged and omitted when confidence is low.
function summarize(report) {
  if (!report || !report.available) return [];
  const out = [];
  const a = report.activity, d = report.drift, c = report.consistency, h = report.habits;
  const acts = `${a.perActiveDay} action${a.perActiveDay === 1 ? '' : 's'}`;
  out.push(`You're ${a.status} — about ${acts} on the days you're active.`);
  if (d.confidence >= 0.4) {
    if (d.direction === 'rising') out.push(`Your engagement is rising (${d.recent7} vs ${d.previous7} in the prior week).`);
    else if (d.direction === 'declining') out.push(`Your engagement has dipped recently (${d.recent7} vs ${d.previous7} the week before).`);
    else out.push('Your engagement is holding steady week over week.');
  }
  if (report.events >= 10) out.push(`Your rhythm is ${c.label}.`);
  if (h.dailyHabit) out.push(`You've shown up on ${h.activeDaysLast14} of the last 14 days — a real daily habit.`);
  if (report.events >= 12) out.push(`You're most active around ${h.dominantHourIST}:00 IST, often on ${h.dominantWeekday}.`);
  return out;
}

module.exports = { analyze, summarize };
