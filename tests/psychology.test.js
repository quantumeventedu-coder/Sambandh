const { analyze, computeMetrics } = require('../src/services/psychology');

const base = new Date(2026, 0, 1, 9, 0, 0).getTime();
const at = min => new Date(base + min * 60000);
const filler = (n, extra = '') => Array(n).fill('word').join(' ') + ' ' + extra;

function build(spec) { return spec; }

describe('psychology engine (spec Part 2) — attachment styles', () => {
  test('detects Anxious (double-texting + reassurance)', () => {
    const msgs = []; let t = 0;
    for (let i = 0; i < 6; i++) {
      msgs.push({ fromMe: false, text: 'ok', createdAt: at(t) }); t += 5;
      msgs.push({ fromMe: true, text: filler(10, 'are you mad at me?'), createdAt: at(t) }); t += 2;
      msgs.push({ fromMe: true, text: filler(8, "did i say something wrong? i'm sorry"), createdAt: at(t) }); t += 1;
      msgs.push({ fromMe: true, text: filler(6, 'is everything okay?'), createdAt: at(t) }); t += 30;
    }
    expect(analyze(msgs).attachment.style).toBe('Anxious (Preoccupied)');
  });

  test('detects Avoidant (slow, short, I-heavy, deflecting)', () => {
    const msgs = []; let t = 0;
    for (let i = 0; i < 10; i++) {
      msgs.push({ fromMe: false, text: 'how are you feeling about us?', createdAt: at(t) }); t += 360;
      msgs.push({ fromMe: true, text: 'i am fine. i did my work. anyway lol.', createdAt: at(t) }); t += 60;
    }
    expect(analyze(msgs).attachment.style).toBe('Avoidant (Dismissive)');
  });

  test('detects Secure (balanced, consistent, moderate length)', () => {
    const msgs = []; let t = 0;
    for (let i = 0; i < 10; i++) {
      msgs.push({ fromMe: false, text: filler(50, 'how was your day?'), createdAt: at(t) }); t += 30;
      msgs.push({ fromMe: true, text: filler(60, 'it was good, how about yours?'), createdAt: at(t) }); t += 30;
    }
    expect(analyze(msgs).attachment.style).toBe('Secure');
  });

  test('too few messages → Unknown', () => {
    expect(analyze([{ fromMe: true, text: 'hi', createdAt: at(0) }]).attachment.style).toBe('Unknown');
  });
});

describe('psychology engine — love languages', () => {
  const convo = (userText) => {
    const msgs = []; let t = 0;
    for (let i = 0; i < 10; i++) {
      msgs.push({ fromMe: false, text: 'hi', createdAt: at(t) }); t += 20;
      msgs.push({ fromMe: true, text: userText, createdAt: at(t) }); t += 20;
    }
    return msgs;
  };
  test('compliments → Words of Affirmation', () => {
    expect(analyze(convo('you are amazing and beautiful, i am proud of you, thank you so much')).loveLanguage.primary).toBe('Words of Affirmation');
  });
  test('sensory language → Physical Touch', () => {
    expect(analyze(convo('i want to hug you and hold you close, cuddle next to you')).loveLanguage.primary).toBe('Physical Touch');
  });
  test('offering help → Acts of Service', () => {
    expect(analyze(convo('do you want me to help? let me handle it, i can help you fix that')).loveLanguage.primary).toBe('Acts of Service');
  });
});

describe('psychology engine — Big Five signals', () => {
  test('computeMetrics returns a numeric metric set', () => {
    const m = computeMetrics(build([
      { fromMe: false, text: 'hi', createdAt: at(0) },
      { fromMe: true, text: filler(60), createdAt: at(20) }
    ]));
    expect(typeof m.avgWords).toBe('number');
    expect(m).toHaveProperty('vocabRichness');
    expect(m).toHaveProperty('iToWeRatio');
  });
});
