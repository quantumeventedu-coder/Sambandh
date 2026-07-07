// services/intelligence.js — orchestrator that assembles every signal
// (astrology + psychology + engagement + karma) and runs the full compatibility
// formula (spec §4). Also builds a user's own nakshatra personality profile.

const { chartFor } = require('./astro');
const { nakshatraByName, relationshipProfile } = require('../data/nakshatras');
const { animalForNakshatra, yoniCompatibility, YONI_ANIMALS } = require('../data/yoni');
const psychology = require('./psychology');
const { computeCompatibility } = require('./compatibility');

function karmaGrade(score) {
  if (score == null) return 'B';
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// A user's own nakshatra personality profile (spec §4.3 presentation).
function nakshatraProfile(user) {
  const chart = chartFor(user.astrology || {});
  if (!chart) return null;
  const atlas = nakshatraByName(chart.nakshatra);
  const rp = relationshipProfile(chart.nakshatra);
  const animal = atlas ? animalForNakshatra(atlas.name) : null;
  return {
    nakshatra: chart.nakshatra,
    title: atlas?.title || null,
    headline: rp?.headline || chart.nakshatra,
    moonSign: chart.rashiEn,
    sunSign: chart.sunSign,
    gana: atlas?.gana || null,
    personality: atlas?.core || null,
    emotionalNature: atlas?.emotional || null,
    // "intimate", never "sexual" (spec §4.3)
    intimateNature: atlas ? YONI_ANIMALS[animal]?.intimateStyle : null,
    yoniAnimal: animal,
    bestMatches: atlas?.best || [],
    hasBirthTime: chart.hasBirthTime
  };
}

// Read one participant's psychology from the shared chat's message list.
function psychologyFrom(messages, forUserId) {
  const seq = (messages || []).map(m => ({
    text: m.text, createdAt: m.createdAt, fromMe: String(m.from) === String(forUserId)
  }));
  return psychology.analyze(seq);
}

// Full pairwise intelligence. Callers pass the two user docs, the shared chat's
// messages (may be empty), each user's karma score, an engagement 0–1, and a
// criticalFlag. Returns the compatibility result plus the assembled signals.
function pairIntelligence(me, other, {
  messages = [], karmaScoreMe = null, karmaScoreOther = null,
  engagement = null, astrology = null, criticalFlag = false
} = {}) {
  // Astrology pieces (from routes-compat's computeAstrology, if available).
  const gunaMilan = astrology ? { total: astrology.gunaScore, max: astrology.gunaMax || 36, doshas: astrology.doshas || [] } : null;
  const yoniScore = astrology?.breakdown?.yoni?.got ?? null;
  const ganaScore = astrology?.breakdown?.gana?.got ?? null;
  const hasBirthTime = astrology ? !!astrology.birthTimeKnown : true;

  // Psychology from the shared chat (needs a reasonable number of messages).
  let psychMe = null, psychOther = null;
  if (messages.length >= 10) {
    psychMe = psychologyFrom(messages, me._id);
    psychOther = psychologyFrom(messages, other._id);
  }

  // Intimate (Yoni) compatibility for the caution line.
  let yoniCompat = null;
  const chartMe = chartFor(me.astrology || {}), chartOther = chartFor(other.astrology || {});
  if (chartMe && chartOther) {
    const aMe = animalForNakshatra(chartMe.nakshatra), aOther = animalForNakshatra(chartOther.nakshatra);
    if (aMe && aOther) yoniCompat = { ...yoniCompatibility(aMe, aOther), animals: [aMe, aOther] };
  }

  const sameIntent = (me.intent || []).some(i => (other.intent || []).includes(i));
  const sharedLanguage = (me.profile?.languages || []).some(l => (other.profile?.languages || []).includes(l));

  const result = computeCompatibility({
    gunaMilan, hasBirthTime, yoniScore, ganaScore,
    attachmentA: psychMe?.attachment?.style, attachmentB: psychOther?.attachment?.style,
    oceanA: psychMe?.bigFive, oceanB: psychOther?.bigFive,
    loveA: psychMe?.loveLanguage?.primary, loveB: psychOther?.loveLanguage?.primary,
    engagement,
    karmaGradeA: karmaGrade(karmaScoreMe), karmaGradeB: karmaGrade(karmaScoreOther),
    criticalFlag, sameIntent, sharedLanguage
  });

  return {
    ...result,
    signals: {
      astrologyAvailable: !!gunaMilan,
      psychologyAvailable: !!psychMe,
      yoni: yoniCompat,
      // Attachment is internal-only — never label the other user (spec §4.3).
      attachmentUsedInternally: !!psychMe
    }
  };
}

module.exports = { nakshatraProfile, pairIntelligence, karmaGrade };
