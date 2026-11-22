// data/setu-journey.js — the Setu Journey model (from the Sambandh Setu designs).
//
// Eight stages a matched pair moves through together. A stage completes only
// when BOTH people complete it. Reflect asks ten questions; every answer has its
// own sharing choice (keep private / share with match / share later).

const STAGES = [
  { key: 'connect', label: 'Connect', description: 'Find a relevant person and accept a connection.' },
  { key: 'understand', label: 'Understand', description: 'Get to know each other through conversations at your own pace.' },
  { key: 'reflect', label: 'Reflect', description: 'Answer ten questions privately, and choose what to share.' },
  { key: 'discuss', label: 'Discuss', description: 'Talk through values, expectations and plans that matter to you both.' },
  { key: 'agree', label: 'Agree', description: 'Note what you agree on, and what still needs time.' },
  { key: 'family', label: 'Family', description: 'Involve family when you are both ready — optional and consent-based.' },
  { key: 'reflect_again', label: 'Reflect Again', description: 'Look back at how things have grown, privately and honestly.' },
  { key: 'decision', label: 'Decision', description: 'Decide your next step together — no pressure, no timelines.' }
];
const STAGE_KEYS = STAGES.map(s => s.key);

const OTHER = { value: 'other', label: 'Other (please specify)' };
const REFLECT_QUESTIONS = [
  { key: 'q01', order: 1, category: 'Values & Beliefs', type: 'multi', max: 3, prompt: 'What matters most to you in a marriage?', hint: 'You can select up to 3 options.',
    options: [['emotional_understanding', 'Emotional understanding'], ['family_relationships', 'Family relationships'], ['career_growth', 'Career growth'], ['financial_stability', 'Financial stability'], ['personal_independence', 'Personal independence'], ['shared_interests', 'Shared interests and hobbies'], ['spiritual_alignment', 'Spiritual or religious alignment']] },
  { key: 'q02', order: 2, category: 'Lifestyle & Daily Life', type: 'single', prompt: 'Where would you ideally like to live after marriage?',
    options: [['with_family', 'With my family'], ['independently', 'Independently'], ['open_to_either', 'Open to either'], ['depends', 'Depends on circumstances'], ['not_sure', 'Not sure yet']] },
  { key: 'q03', order: 3, category: 'Career & Goals', type: 'scale', prompt: 'How important is career growth to you after marriage?', hint: 'Select a rating from 1 to 5.', minLabel: 'Not important at all', maxLabel: 'Very important' },
  { key: 'q04', order: 4, category: 'Lifestyle & Daily Life', type: 'multi', max: 6, prompt: 'What are your expectations around household responsibilities?', hint: 'You can select all that apply.',
    options: [['share_equally', 'Share work equally'], ['by_availability', 'Divide based on availability'], ['no_expectation', "I don't have a specific expectation"], ['discuss_adjust', 'Open to discussing and adjusting'], ['traditional_roles', 'Prefer traditional roles']] },
  { key: 'q05', order: 5, category: 'Emotions & Communication', type: 'single', prompt: 'How do you prefer to communicate when something is bothering you?',
    options: [['immediately', 'Talk about it immediately'], ['calm_first', 'Take time to calm down first'], ['later', 'Discuss it later'], ['written', 'Prefer written communication'], ['depends', 'It depends on the situation']] },
  { key: 'q06', order: 6, category: 'Values & Beliefs', type: 'text', max: 500, prompt: 'What personal values would you not want to compromise on?', hint: 'Share your thoughts in your own words.' },
  { key: 'q07', order: 7, category: 'Emotions & Communication', type: 'multi', max: 3, prompt: 'What concerns, if any, do you have about entering marriage?', hint: 'You can select up to 3 options.',
    options: [['new_family', 'Adjusting to a new family'], ['career_family', 'Balancing career and family'], ['financial', 'Financial responsibilities'], ['freedom', 'Loss of personal freedom'], ['expectations', 'Differences in expectations'], ['long_distance', 'Long-distance relationships'], ['none', "I don't have major concerns"]] },
  { key: 'q08', order: 8, category: 'Emotions & Communication', type: 'scale', prompt: 'How comfortable are you discussing difficult topics with a partner?', hint: 'Select a rating from 1 to 5.', minLabel: 'Not comfortable', maxLabel: 'Very comfortable' },
  { key: 'q09', order: 9, category: 'Lifestyle & Daily Life', type: 'text', max: 500, prompt: 'How do you want to balance personal independence and shared responsibilities?', hint: 'Share your thoughts in your own words.' },
  { key: 'q10', order: 10, category: 'Emotions & Communication', type: 'text', max: 500, prompt: 'What would help you feel respected and emotionally supported in a marriage?', hint: 'Share your thoughts in your own words.' }
].map(q => ({ ...q, options: q.options ? [...q.options.map(([value, label]) => ({ value, label })), ...(q.type !== 'scale' && q.type !== 'text' ? [OTHER] : [])] : undefined }));

const SHARING = ['keep_private', 'share_with_match', 'share_later'];

// Validate one answer against its question. Returns { value, otherText } or throws.
function validateAnswer(q, body) {
  const err = (m) => Object.assign(new Error(m), { status: 400 });
  const { value } = body || {};
  const otherText = typeof body.otherText === 'string' ? body.otherText.trim().slice(0, 200) : undefined;
  const allowed = new Set((q.options || []).map(o => o.value));
  if (q.type === 'single') {
    if (typeof value !== 'string' || !allowed.has(value)) throw err('Choose one of the options');
    if (value === 'other' && !otherText) throw err('Please specify your answer');
    return { value, otherText: value === 'other' ? otherText : undefined };
  }
  if (q.type === 'multi') {
    if (!Array.isArray(value) || !value.length) throw err('Select at least one option');
    if (new Set(value).size !== value.length || value.some(v => !allowed.has(v))) throw err('Invalid option selected');
    if (q.max && value.length > q.max) throw err(`Select up to ${q.max} options`);
    if (value.includes('other') && !otherText) throw err('Please specify your answer');
    return { value, otherText: value.includes('other') ? otherText : undefined };
  }
  if (q.type === 'scale') {
    if (!Number.isInteger(value) || value < 1 || value > 5) throw err('Choose a rating from 1 to 5');
    return { value };
  }
  if (q.type === 'text') {
    if (typeof value !== 'string' || !value.trim()) throw err('Please write an answer');
    if (value.trim().length > (q.max || 500)) throw err(`Keep it under ${q.max || 500} characters`);
    return { value: value.trim() };
  }
  throw err('Unsupported question');
}

module.exports = { STAGES, STAGE_KEYS, REFLECT_QUESTIONS, SHARING, validateAnswer };
