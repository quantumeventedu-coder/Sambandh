// seed-demo.js — demo users for local development.
// Runs automatically when SEED_DEMO=true and the users collection is empty,
// so the in-memory dev database always has profiles to browse.

const User = require('./models/User');
const KarmaBook = require('./models/KarmaBook');
const Reputation = require('./models/Reputation');
const Chat = require('./models/Chat');
const Claim = require('./models/Claim');
const Like = require('./models/Like');

function demoUser(phone, gender, firstName, age, city, state, intent, extras = {}) {
  const year = new Date().getFullYear() - age;
  return {
    phone, phoneVerified: true,
    createdAt: new Date(Date.now() - 90 * 86400000),
    lastActiveAt: new Date(),
    profile: {
      firstName, gender, age, dob: `${year}-05-14`, city, state, country: 'IN',
      languages: ['english', 'hindi'],
      bio: extras.bio || '',
      photos: []
    },
    intent,
    claims: { profession: { title: extras.title || 'Engineer', company: extras.company || 'TechCo', verified: true } },
    astrology: {
      birthDate: `${year}-05-14`, birthTime: '08:30',
      birthPlace: { city }, computedAt: new Date()
    },
    verification: {
      level: 'fully_verified', idVerified: true, idType: 'aadhaar', idVerifiedAt: new Date(),
      selfieVerified: true, professionVerified: true, trustScore: 80
    },
    membership: { joinFeePaid: true, tier: 'base', tierExpiresAt: new Date(Date.now() + 3650 * 86400000), paidAt: new Date() },
    preferences: {
      interestedInGenders: gender === 'male' ? ['female'] : ['male'],
      showProfessionToOthers: true, showAstrologyToOthers: true,
      anonymousModeEnabled: !!extras.anonymous
    },
    status: { active: true, suspended: false, banned: false }
  };
}

async function seedDemo() {
  const count = await User.countDocuments();
  if (count > 0) return;

  console.log('[SEED] Creating demo users...');

  const priya = await User.create(demoUser('+919000000001', 'female', 'Priya', 26, 'Guwahati', 'Assam', ['dating'], {
    title: 'Product Designer', company: 'Zomato',
    bio: 'Product designer who treks on weekends. Strong opinions about filter coffee and mountain trails.'
  }));
  const meera = await User.create(demoUser('+919000000002', 'female', 'Meera', 28, 'Guwahati', 'Assam', ['marriage'], {
    title: 'Doctor (MBBS)', company: 'GMCH',
    bio: 'Doctor. Ray films on Sunday, rounds on Monday. Looking for something real.'
  }));
  const rohit = await User.create(demoUser('+919000000003', 'male', 'Rohit', 29, 'Mumbai', 'Maharashtra', ['dating', 'casual'], {
    title: 'Marketing Lead', company: 'StartupX',
    bio: 'Work hard, travel harder. Ask me about my Ladakh trip.'
  }));
  const arjun = await User.create(demoUser('+919000000004', 'male', 'Arjun', 27, 'Guwahati', 'Assam', ['dating'], {
    title: 'Software Engineer', company: 'Infosys',
    bio: 'Coffee, code, cricket. Hampta Pass survivor. Honest to a fault — the Karma Book can confirm.'
  }));
  const ananya = await User.create(demoUser('+919000000005', 'female', 'Ananya', 24, 'Bengaluru', 'Karnataka', ['casual', 'friendship'], {
    title: 'Content Creator', company: 'Independent', anonymous: true,
    bio: 'Here anonymously until you earn the reveal. Witty replies only.'
  }));

  // Clean reputations for most
  await Reputation.create({
    userId: priya._id, basedOnChats: 6, basedOnMessages: 240,
    scores: { respect: 9.0, responsive: 8.4, depth: 8.7, humor: 8.9, directness: 8.2 },
    grades: { conversation: 'A-', boundaries: 'A', honesty: 'A-', warmth: 'A-' },
    tagsPositive: [{ tag: 'thoughtful', count: 5 }, { tag: 'witty', count: 4 }, { tag: 'reliable', count: 2 }],
    tagsNegative: [], trustScore: 82
  });
  await Reputation.create({
    userId: arjun._id, basedOnChats: 3, basedOnMessages: 120,
    scores: { respect: 9.0, responsive: 8.4, depth: 8.7, humor: 7.8, directness: 9.2 },
    grades: { conversation: 'A-', boundaries: 'A', honesty: 'A', warmth: 'B+' },
    tagsPositive: [{ tag: 'thoughtful', count: 3 }, { tag: 'patient', count: 2 }, { tag: 'curious', count: 2 }],
    tagsNegative: [], trustScore: 78
  });
  await Reputation.create({
    userId: rohit._id, basedOnChats: 9, basedOnMessages: 460,
    scores: { respect: 7.4, responsive: 8.8, depth: 5.9, humor: 8.4, directness: 5.2 },
    grades: { conversation: 'B', boundaries: 'B', honesty: 'C', warmth: 'B+' },
    tagsPositive: [{ tag: 'funny', count: 5 }, { tag: 'energetic', count: 3 }],
    tagsNegative: [{ tag: 'evasive', count: 3 }, { tag: 'slow replies', count: 2 }],
    trustScore: 55
  });

  // Karma books: everyone clean except Rohit (the cautionary tale from the spec)
  await KarmaBook.create({ userId: priya._id, score: 94 });
  await KarmaBook.create({ userId: meera._id, score: 97 });
  await KarmaBook.create({ userId: arjun._id, score: 92 });
  await KarmaBook.create({ userId: ananya._id, score: 91 });

  // Rohit: told 3 different people they were exclusive within 30 days
  const rohitChats = [];
  for (const other of [priya, meera, ananya]) {
    const chat = await Chat.create({
      participants: [rohit._id, other._id],
      createdAt: new Date(Date.now() - 25 * 86400000),
      lastMessageAt: new Date(Date.now() - 2 * 86400000),
      messageCount: 12, intent: 'dating', status: 'active',
      anonymity: { isAnonymous: false, userA_revealed: false, userB_revealed: false }
    });
    rohitChats.push(chat);
  }
  const exclusivityLines = [
    "you're the only one I feel this way about",
    'only chatting with you, promise',
    'no one else makes me feel this way'
  ];
  for (let i = 0; i < 3; i++) {
    await Claim.create({
      userId: rohit._id, chatId: rohitChats[i]._id, type: 'exclusivity',
      statement: exclusivityLines[i],
      normalized: 'Claims to be talking exclusively to this person',
      strength: 'strong',
      createdAt: new Date(Date.now() - (8 + i * 7) * 86400000),
      contradicted: true
    });
    await Claim.create({
      userId: rohit._id, chatId: rohitChats[i]._id, type: 'emotional',
      statement: "you're special, I mean it",
      normalized: 'Strong emotional declaration',
      strength: 'strong',
      createdAt: new Date(Date.now() - (6 + i * 7) * 86400000)
    });
  }
  await KarmaBook.create({
    userId: rohit._id, score: 86, timesNotified: 1,
    contradictions: [{
      severity: 'high',
      reason: 'Claimed exclusivity to 3 different people within the same 30 days',
      type: 'exclusivity', recordedAt: new Date(Date.now() - 6 * 86400000)
    }]
  });

  // Pending likes so mutual matching can be demoed right away
  await Like.create({ from: priya._id, to: arjun._id });   // log in as Arjun, like Priya → match
  await Like.create({ from: ananya._id, to: rohit._id });

  console.log('[SEED] Demo users ready: Priya, Meera, Rohit, Arjun, Ananya');
  console.log('[SEED] Priya already likes Arjun — like her back as Arjun for an instant match.');
  console.log('[SEED] Log in with any NEW phone number to create your own account.');
}

module.exports = { seedDemo };
