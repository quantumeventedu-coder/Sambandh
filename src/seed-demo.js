// seed-demo.js — a diverse, realistic demo community for a clean database.
// Runs automatically when SEED_DEMO=true and the users collection is empty.
// Every profile gets a generated gradient+initials avatar (SVG data-URI) so the
// feed always looks populated — no empty cards, no external images.

const User = require('./models/User');
const KarmaBook = require('./models/KarmaBook');
const Reputation = require('./models/Reputation');
const Chat = require('./models/Chat');
const Claim = require('./models/Claim');
const Like = require('./models/Like');

// Deterministic gradient avatar as an inline SVG data-URI (no upload, no CDN).
const PALETTES = [
  ['#F3C14B', '#D4537E'], ['#8E6BA8', '#D4537E'], ['#3fbf72', '#0e7a55'],
  ['#E8846B', '#99304F'], ['#5B8DEF', '#7A45C9'], ['#F0A500', '#C1440E'],
  ['#38B2AC', '#2C5282'], ['#D4537E', '#6B1F3A'], ['#7BB662', '#2F6B3A']
];
function avatarFor(name) {
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [c1, c2] = PALETTES[h % PALETTES.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
    `<rect width='400' height='500' fill='url(#g)'/>` +
    `<text x='200' y='300' font-size='170' font-family='Georgia,serif' font-weight='700' ` +
    `fill='rgba(255,255,255,0.9)' text-anchor='middle'>${initials}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function demoUser(phone, gender, firstName, age, city, state, intent, extras = {}) {
  const year = new Date().getFullYear() - age;
  return {
    phone, phoneVerified: true,
    createdAt: new Date(Date.now() - (30 + (age % 60)) * 86400000),
    lastActiveAt: new Date(Date.now() - (extras.activeHoursAgo ?? 3) * 3600000),
    profile: {
      firstName, gender, age, dob: `${year}-05-14`, city, state, country: 'IN',
      languages: extras.languages || ['english', 'hindi'],
      bio: extras.bio || '',
      // Precise coords so distances between demo users are real, not all-identical.
      location: extras.loc ? { lat: extras.loc[0], lng: extras.loc[1], updatedAt: new Date() } : undefined,
      photos: extras.anonymous ? [] : [{ url: avatarFor(firstName), isPrimary: true, uploadedAt: new Date() }]
    },
    intent,
    claims: { profession: { title: extras.title || 'Professional', company: extras.company || '', verified: !!extras.professionVerified } },
    astrology: { birthDate: `${year}-05-14`, birthTime: '08:30', birthPlace: { city }, computedAt: new Date() },
    verification: {
      level: extras.level || 'photo_verified',
      idVerified: !!extras.idVerified, idType: extras.idVerified ? 'aadhaar' : undefined, idVerifiedAt: extras.idVerified ? new Date() : undefined,
      selfieVerified: true,   // everyone in discover is photo-verified (the real gate)
      professionVerified: !!extras.professionVerified,
      trustScore: extras.trust ?? 60
    },
    membership: { joinFeePaid: true, tier: 'base', tierExpiresAt: new Date(Date.now() + 3650 * 86400000), paidAt: new Date() },
    preferences: {
      interestedInGenders: extras.interestedIn || (gender === 'male' ? ['female'] : ['male']),
      showProfessionToOthers: true, showAstrologyToOthers: true,
      anonymousModeEnabled: !!extras.anonymous
    },
    status: { active: true, suspended: false, banned: false }
  };
}

// City → [lat, lng] for real distances.
const CITY = {
  Mumbai: [19.076, 72.8777, 'Maharashtra'], Delhi: [28.7041, 77.1025, 'Delhi'],
  Bengaluru: [12.9716, 77.5946, 'Karnataka'], Pune: [18.5204, 73.8567, 'Maharashtra'],
  Hyderabad: [17.385, 78.4867, 'Telangana'], Chennai: [13.0827, 80.2707, 'Tamil Nadu'],
  Kolkata: [22.5726, 88.3639, 'West Bengal'], Guwahati: [26.1445, 91.7362, 'Assam'],
  Jaipur: [26.9124, 75.7873, 'Rajasthan'], Ahmedabad: [23.0225, 72.5714, 'Gujarat']
};

const PEOPLE = [
  ['female', 'Priya', 26, 'Bengaluru', ['dating'], { title: 'Product Designer', company: 'Zomato', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 88, bio: 'Product designer who treks on weekends. Strong opinions about filter coffee and mountain trails.' }],
  ['female', 'Meera', 28, 'Guwahati', ['marriage'], { title: 'Doctor (MBBS)', company: 'GMCH', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 90, bio: 'Doctor. Ray films on Sunday, rounds on Monday. Looking for something real.' }],
  ['male', 'Arjun', 27, 'Guwahati', ['dating'], { title: 'Software Engineer', company: 'Infosys', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 82, bio: 'Coffee, code, cricket. Hampta Pass survivor. Honest to a fault — the Karma Book can confirm.' }],
  ['male', 'Rohit', 29, 'Mumbai', ['dating', 'casual'], { title: 'Marketing Lead', company: 'StartupX', trust: 55, activeHoursAgo: 1, bio: 'Work hard, travel harder. Ask me about my Ladakh trip.' }],
  ['female', 'Ananya', 24, 'Bengaluru', ['casual', 'friendship'], { title: 'Content Creator', company: 'Independent', anonymous: true, trust: 60, bio: 'Here anonymously until you earn the reveal. Witty replies only.' }],
  ['female', 'Kavya', 25, 'Hyderabad', ['dating'], { title: 'Data Scientist', company: 'Microsoft', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 85, bio: 'ML by day, Carnatic music by night. I will beat you at chess.' }],
  ['male', 'Vikram', 31, 'Delhi', ['marriage'], { title: 'Chartered Accountant', company: 'Self-practice', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 84, bio: 'CA, home cook, dog dad. Believe in slow conversations and long walks.' }],
  ['female', 'Sara', 27, 'Mumbai', ['dating', 'friendship'], { title: 'Architect', company: 'Studio Lotus', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 83, bio: 'I design homes and overthink playlists. Show me your favourite bookshop.' }],
  ['male', 'Aditya', 28, 'Pune', ['dating'], { title: 'Product Manager', company: 'Swiggy', idVerified: true, level: 'id_verified', trust: 76, bio: 'Ex-athlete, current PM. Sunday long runs, weekday standups.' }],
  ['female', 'Isha', 23, 'Jaipur', ['friendship', 'dating'], { title: 'Illustrator', company: 'Freelance', trust: 64, languages: ['english', 'hindi'], bio: 'Illustrator + amateur baker. I communicate in memes and mithai.' }],
  ['male', 'Karthik', 30, 'Chennai', ['marriage'], { title: 'Lawyer', company: 'Madras HC', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 87, bio: 'Litigator who cooks a mean Chettinad. Value directness and dark humour.' }],
  ['female', 'Riya', 26, 'Kolkata', ['dating'], { title: 'Journalist', company: 'The Telegraph', idVerified: true, level: 'id_verified', trust: 78, bio: 'Reporter. Ask better questions and I am yours. Adda over coffee?' }],
  ['male', 'Neel', 29, 'Ahmedabad', ['dating', 'casual'], { title: 'Founder', company: 'D2C brand', idVerified: true, level: 'id_verified', trust: 72, activeHoursAgo: 6, bio: 'Building something. Between flights. Will out-plan you on a trip.' }],
  ['female', 'Tara', 32, 'Delhi', ['marriage'], { title: 'Professor', company: 'DU', professionVerified: true, idVerified: true, level: 'fully_verified', trust: 89, bio: 'Teach literature, collect fountain pens, argue kindly.' }]
];

async function seedDemo() {
  const count = await User.countDocuments();
  if (count > 0) return;

  console.log('[SEED] Creating a diverse demo community...');

  const created = {};
  for (const [gender, name, age, city, intent, extras] of PEOPLE) {
    const [lat, lng, state] = CITY[city];
    const phone = '+9190000' + String(1000 + Object.keys(created).length).slice(-5);
    created[name] = await User.create(demoUser(phone, gender, name, age, city, state, intent, { ...extras, loc: [lat, lng] }));
  }

  // Reputations + karma — mostly excellent, a couple textured, Rohit the cautionary tale.
  const rep = (u, s, pos, neg, trust) => Reputation.create({
    userId: u._id, basedOnChats: 4 + (trust % 7), basedOnMessages: 120 + trust * 3,
    scores: s, tagsPositive: pos.map(t => ({ tag: t, count: 3 })), tagsNegative: neg.map(t => ({ tag: t, count: 2 })), trustScore: trust
  });
  await rep(created.Priya, { respect: 9.0, responsive: 8.4, depth: 8.7, humor: 8.9, directness: 8.2 }, ['thoughtful', 'witty'], [], 88);
  await rep(created.Arjun, { respect: 9.0, responsive: 8.4, depth: 8.7, humor: 7.8, directness: 9.2 }, ['thoughtful', 'patient'], [], 82);
  await rep(created.Rohit, { respect: 7.4, responsive: 8.8, depth: 5.9, humor: 8.4, directness: 5.2 }, ['funny', 'energetic'], ['evasive', 'slow replies'], 55);
  await rep(created.Kavya, { respect: 9.1, responsive: 8.0, depth: 9.0, humor: 8.0, directness: 8.8 }, ['sharp', 'curious'], [], 85);

  const karma = { Priya: 94, Meera: 97, Arjun: 92, Ananya: 91, Kavya: 95, Vikram: 93, Sara: 90, Aditya: 84, Isha: 88, Karthik: 96, Riya: 86, Neel: 74, Tara: 98 };
  for (const [name, score] of Object.entries(karma)) {
    if (name === 'Rohit') continue;
    await KarmaBook.create({ userId: created[name]._id, score });
  }

  // Rohit: told 3 different people they were exclusive within 30 days (spec cautionary tale).
  const rohitChats = [];
  for (const other of [created.Priya, created.Meera, created.Ananya]) {
    rohitChats.push(await Chat.create({
      participants: [created.Rohit._id, other._id],
      createdAt: new Date(Date.now() - 25 * 86400000), lastMessageAt: new Date(Date.now() - 2 * 86400000),
      messageCount: 12, intent: 'dating', status: 'active',
      anonymity: { isAnonymous: false, userA_revealed: false, userB_revealed: false }
    }));
  }
  const lines = ["you're the only one I feel this way about", 'only chatting with you, promise', 'no one else makes me feel this way'];
  for (let i = 0; i < 3; i++) {
    await Claim.create({ userId: created.Rohit._id, chatId: rohitChats[i]._id, type: 'exclusivity', statement: lines[i], normalized: 'Claims to be talking exclusively to this person', strength: 'strong', createdAt: new Date(Date.now() - (8 + i * 7) * 86400000), contradicted: true });
  }
  await KarmaBook.create({
    userId: created.Rohit._id, score: 86, timesNotified: 1,
    contradictions: [{ severity: 'high', reason: 'Claimed exclusivity to 3 different people within the same 30 days', type: 'exclusivity', recordedAt: new Date(Date.now() - 6 * 86400000) }]
  });

  // A pending like so mutual matching can be demoed instantly.
  await Like.create({ from: created.Priya._id, to: created.Arjun._id });

  console.log(`[SEED] ${Object.keys(created).length} demo profiles ready across ${new Set(PEOPLE.map(p => p[3])).size} cities, each with a generated avatar.`);
}

module.exports = { seedDemo, avatarFor };
