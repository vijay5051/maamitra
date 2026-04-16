/**
 * MaaMitra Demo Seeding Script
 *
 * Creates 10 demo user profiles in Firestore and simulates interactions:
 * - User profiles + public profiles
 * - Community posts from each user
 * - Reactions across users
 * - Comments from different users
 * - Follow relationships
 * - Notifications
 *
 * Usage: node scripts/seed-demo-users.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, setDoc, addDoc,
  serverTimestamp, increment, getDoc, updateDoc, writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
} from 'firebase/auth';

// ─── Firebase Config ─────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: 'AIzaSyDIpjUY-xIu5BIvKfuWylHlBJcQHkhbhW4',
  authDomain: 'maa-mitra-7kird8.firebaseapp.com',
  projectId: 'maa-mitra-7kird8',
  storageBucket: 'maa-mitra-7kird8.firebasestorage.app',
  messagingSenderId: '709650827583',
  appId: '1:709650827583:web:48d2e2739a37413a2b2b8a',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ─── 10 Demo Users ───────────────────────────────────────────────────────────

const DEMO_USERS = [
  {
    email: 'priya.sharma@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Priya Sharma',
    parentGender: 'mother',
    bio: 'First-time mom navigating the beautiful chaos of motherhood. Love sharing tips about breastfeeding and newborn care.',
    expertise: ['Breastfeeding', 'Baby Care', 'Nutrition'],
    state: 'Maharashtra',
    diet: 'vegetarian',
    familyType: 'nuclear',
    stage: 'newborn',
    kids: [{ name: 'Aarav', dob: '2025-11-15', gender: 'boy', stage: 'newborn', isExpecting: false }],
  },
  {
    email: 'ananya.krishnan@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Ananya Krishnan',
    parentGender: 'mother',
    bio: 'Pregnant with my second! Experienced mom who loves helping first-timers.',
    expertise: ['Pregnancy', 'Baby Sleep', 'Child Development'],
    state: 'Karnataka',
    diet: 'non-vegetarian',
    familyType: 'joint',
    stage: 'pregnant',
    kids: [
      { name: 'Diya', dob: '2023-06-20', gender: 'girl', stage: 'newborn', isExpecting: false },
      { name: 'Baby #2', dob: '2026-08-01', gender: 'surprise', stage: 'pregnant', isExpecting: true },
    ],
  },
  {
    email: 'deepika.reddy@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Deepika Reddy',
    parentGender: 'mother',
    bio: 'Mom of twins! Double the love, double the sleepless nights. Yoga enthusiast.',
    expertise: ['Yoga & Wellness', 'Mental Health', 'Baby Sleep'],
    state: 'Telangana',
    diet: 'eggetarian',
    familyType: 'nuclear',
    stage: 'newborn',
    kids: [
      { name: 'Arjun', dob: '2025-03-10', gender: 'boy', stage: 'newborn', isExpecting: false },
      { name: 'Aria', dob: '2025-03-10', gender: 'girl', stage: 'newborn', isExpecting: false },
    ],
  },
  {
    email: 'meena.tiwari@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Meena Tiwari',
    parentGender: 'mother',
    bio: 'Pediatrician and mom. Happy to answer vaccine and health questions!',
    expertise: ['Vaccination', 'Child Development', 'Nutrition'],
    state: 'Uttar Pradesh',
    diet: 'vegetarian',
    familyType: 'in-laws',
    stage: 'newborn',
    kids: [{ name: 'Ishaan', dob: '2024-09-05', gender: 'boy', stage: 'newborn', isExpecting: false }],
  },
  {
    email: 'sunita.patel@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Sunita Patel',
    parentGender: 'mother',
    bio: 'Single mom warrior. My daughter is my world. Advocate for postpartum mental health.',
    expertise: ['Mental Health', 'Postpartum Recovery', 'Baby Care'],
    state: 'Gujarat',
    diet: 'vegetarian',
    familyType: 'single-parent',
    stage: 'newborn',
    kids: [{ name: 'Kavya', dob: '2025-07-22', gender: 'girl', stage: 'newborn', isExpecting: false }],
  },
  {
    email: 'ritu.gupta@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Ritu Gupta',
    parentGender: 'mother',
    bio: 'Planning our first baby! Gathering all the wisdom I can from this amazing community.',
    expertise: [],
    state: 'Delhi',
    diet: 'non-vegetarian',
    familyType: 'nuclear',
    stage: 'planning',
    kids: [],
  },
  {
    email: 'kavitha.nair@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Kavitha Nair',
    parentGender: 'mother',
    bio: 'Ayurveda enthusiast raising my toddler the traditional way. Love sharing home remedies!',
    expertise: ['Nutrition', 'Baby Care', 'Yoga & Wellness'],
    state: 'Kerala',
    diet: 'vegetarian',
    familyType: 'joint',
    stage: 'newborn',
    kids: [{ name: 'Aditi', dob: '2024-04-12', gender: 'girl', stage: 'newborn', isExpecting: false }],
  },
  {
    email: 'raj.malhotra@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Raj Malhotra',
    parentGender: 'father',
    bio: 'Hands-on dad trying to be the best father I can be. Night feed champion!',
    expertise: ['Baby Sleep', 'Baby Care'],
    state: 'Punjab',
    diet: 'non-vegetarian',
    familyType: 'nuclear',
    stage: 'newborn',
    kids: [{ name: 'Veer', dob: '2025-12-01', gender: 'boy', stage: 'newborn', isExpecting: false }],
  },
  {
    email: 'neha.das@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Neha Das',
    parentGender: 'mother',
    bio: 'Working mom balancing career and a newborn. Remote work tips welcome!',
    expertise: ['Mental Health', 'Postpartum Recovery'],
    state: 'West Bengal',
    diet: 'non-vegetarian',
    familyType: 'nuclear',
    stage: 'newborn',
    kids: [{ name: 'Rohan', dob: '2025-10-08', gender: 'boy', stage: 'newborn', isExpecting: false }],
  },
  {
    email: 'fatima.sheikh@demo.maamitra.app',
    password: 'Demo@123!',
    name: 'Fatima Sheikh',
    parentGender: 'mother',
    bio: 'Mother of three! From pregnancy to toddlerhood, been through it all. Ask me anything!',
    expertise: ['Breastfeeding', 'Child Development', 'Nutrition', 'Baby Sleep'],
    state: 'Rajasthan',
    diet: 'non-vegetarian',
    familyType: 'joint',
    stage: 'newborn',
    kids: [
      { name: 'Zara', dob: '2021-02-14', gender: 'girl', stage: 'newborn', isExpecting: false },
      { name: 'Ayaan', dob: '2023-11-30', gender: 'boy', stage: 'newborn', isExpecting: false },
      { name: 'Inaya', dob: '2025-08-18', gender: 'girl', stage: 'newborn', isExpecting: false },
    ],
  },
];

// ─── Community Posts ─────────────────────────────────────────────────────────

const DEMO_POSTS = [
  { userIdx: 0, topic: 'Newborn', text: 'Finally figured out the perfect latch after 3 weeks of struggling! The laid-back nursing position works best for us. Don\'t give up mamas, it gets so much easier! 🤱 Also, lanolin cream is a lifesaver.' },
  { userIdx: 1, topic: 'Pregnancy', text: 'Second trimester energy is REAL! Spent the whole weekend organizing the nursery. Any color suggestions? We\'re going with a neutral theme since it\'s a surprise 🎁' },
  { userIdx: 2, topic: 'Mental Health', text: 'Twin mom confession: I cried in the bathroom for 20 minutes today because both babies were crying simultaneously and I felt like I was failing. Then my husband walked in and said "you\'re the strongest person I know." Needed that. 💜' },
  { userIdx: 3, topic: 'Nutrition', text: 'PSA for new moms: Ragi porridge is an AMAZING first food. Rich in calcium, iron, and easy to digest. My son Ishaan loved it from day one. Here\'s my recipe: 2 tbsp ragi flour + 1 cup water, cook on low heat, add a pinch of jaggery. Start after 6 months!' },
  { userIdx: 4, topic: 'Mental Health', text: 'To the single moms in this community - you are doing an incredible job. Some days are harder than others, but look at your baby\'s smile and know that YOU did that. We are warriors. 💪🌟' },
  { userIdx: 5, topic: 'Pregnancy', text: 'Just got my first positive test! 🥺 I\'m overwhelmed with joy and also terrified. What were the first things you did when you found out? Any must-have books for first-time moms?' },
  { userIdx: 6, topic: 'Nutrition', text: 'Sharing my Ayurvedic tip for colic: Mix a tiny pinch of hing (asafoetida) with warm water and gently apply around baby\'s navel in a clockwise direction. Worked wonders for Aditi! But always consult your pediatrician first. 🌿' },
  { userIdx: 7, topic: 'Newborn', text: 'Dad here 👋 Just survived my first solo night with baby Veer while wife was at her friend\'s. Diaper change at 3am? Check. Bottle warming? Check. Singing lullabies off-key? DOUBLE CHECK. We dads can do this! 😤💪' },
  { userIdx: 8, topic: 'Mental Health', text: 'Working from home with a 6-month-old is... an experience. Just had an important Zoom call and Rohan decided it was the perfect time to discover his vocal cords 😂 Thankfully my team was very understanding. Any WFH mom tips?' },
  { userIdx: 9, topic: 'Milestones', text: 'Inaya (8 months) just pulled herself up to standing for the first time today! Her older siblings were cheering so loudly 🥹 Third time around and these milestones still make me tear up. Cherish every moment, mamas!' },
  { userIdx: 0, topic: 'Products', text: 'Honest review: tried 5 different baby carriers and the one that works best for Indian weather is the fabric wrap style. Less sweating, more comfortable for both of us. Which carrier do you swear by?' },
  { userIdx: 3, topic: 'Newborn', text: 'Vaccination reminder: BCG and OPV should be given at birth, and Hepatitis B within 24 hours. Many parents miss the Hep B timing. Set reminders! Your pediatrician should have the IAP schedule. Happy to answer any vaccine questions 💉' },
  { userIdx: 2, topic: 'Newborn', text: 'Twin life hack #47: When one twin starts crying at night, immediately start gentle rocking/patting the other one BEFORE they wake up. Prevention > cure when it comes to twin meltdowns at 2am 😅' },
  { userIdx: 1, topic: 'Nutrition', text: 'Pregnancy cravings update: I literally cannot stop eating chaat. Pani puri, sev puri, bhel — you name it. My MIL says it means the baby likes spicy food 😂 Any other moms craving street food?' },
  { userIdx: 4, topic: 'Products', text: 'Best budget-friendly baby products I\'ve found: 1) Himalaya baby cream (₹75) 2) Johnson\'s cotton buds 3) Local brand muslin cloths from the market. You don\'t need fancy imported stuff! 💰' },
  { userIdx: 6, topic: 'Milestones', text: 'Aditi (2 years) said "I love you Amma" for the first time today and I literally fell apart 😭😭😭 All the sleepless nights, all the struggles — THIS is why we do it. 💕' },
  { userIdx: 8, topic: 'Newborn', text: 'Can we normalize that it\'s okay if breastfeeding doesn\'t work out? I tried everything for 3 months and ultimately switched to formula. Rohan is thriving, happy, and healthy. Fed is best. Period. 🍼' },
  { userIdx: 9, topic: 'Nutrition', text: 'Meal prep Sunday! Made a week\'s worth of khichdi, dal, and vegetable purees for all three kids. Batch cooking is the ONLY way I survive weekdays. Any other batch cooking moms here? Drop your favorite recipes! 🍲' },
  { userIdx: 7, topic: 'Mental Health', text: 'As a dad, I want to say: postpartum depression affects fathers too. I didn\'t recognize it at first — just felt disconnected and overwhelmed. Talking to my wife and a counselor helped immensely. Dads, it\'s okay to not be okay. 🙏' },
  { userIdx: 5, topic: 'Pregnancy', text: 'Morning sickness is NO JOKE. I\'ve tried ginger tea, crackers, lemon water... nothing works. Currently surviving on nimbu paani and prayers 🤢 When does this end??' },
];

// ─── Helper functions ────────────────────────────────────────────────────────

function randomSubset(arr, min, max) {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomDate(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000);
}

function calculateAgeInMonths(dob) {
  const birth = new Date(dob);
  const today = new Date();
  const years = today.getFullYear() - birth.getFullYear();
  const months = today.getMonth() - birth.getMonth();
  const days = today.getDate() - birth.getDate();
  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths -= 1;
  return Math.max(0, totalMonths);
}

function calculateAgeInWeeks(dob) {
  const birth = new Date(dob);
  const today = new Date();
  const diffMs = today.getTime() - birth.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
}

// ─── Main seed function ──────────────────────────────────────────────────────

async function seedDemoUsers() {
  console.log('🌱 Starting MaaMitra demo seeding...\n');

  const userUids = [];

  // Step 1: Create Firebase Auth accounts + Firestore profiles
  console.log('📝 Step 1: Creating 10 demo accounts...');
  for (const user of DEMO_USERS) {
    let uid;
    try {
      // Try to create new account
      const cred = await createUserWithEmailAndPassword(auth, user.email, user.password);
      uid = cred.user.uid;
      console.log(`  ✅ Created: ${user.name} (${user.email}) → ${uid}`);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        // Account exists, sign in to get UID
        try {
          const cred = await signInWithEmailAndPassword(auth, user.email, user.password);
          uid = cred.user.uid;
          console.log(`  ♻️  Exists: ${user.name} (${user.email}) → ${uid}`);
        } catch (signInErr) {
          console.log(`  ❌ Failed to sign in as ${user.email}: ${signInErr.message}`);
          userUids.push(null);
          continue;
        }
      } else {
        console.log(`  ❌ Failed to create ${user.email}: ${err.message}`);
        userUids.push(null);
        continue;
      }
    }
    userUids.push(uid);

    // Build kids array with computed fields
    const kids = user.kids.map((k, i) => ({
      id: `kid-${uid}-${i}`,
      name: k.name,
      dob: new Date(k.dob).toISOString(),
      gender: k.gender,
      stage: k.stage,
      isExpecting: k.isExpecting,
      ageInMonths: k.isExpecting ? 0 : calculateAgeInMonths(k.dob),
      ageInWeeks: k.isExpecting ? 0 : calculateAgeInWeeks(k.dob),
      relation: user.parentGender === 'father' ? 'father' : 'mother',
    }));

    const roleLabel = user.parentGender === 'father' ? 'Dad' : 'Maa';
    const badge = `${roleLabel} · ${user.state}`;

    // Save user profile
    await setDoc(doc(db, 'users', uid), {
      name: user.name,
      motherName: user.name,
      email: user.email,
      createdAt: new Date().toISOString(),
      profile: {
        stage: user.stage,
        keyDate: user.kids[0]?.dob || '',
        state: user.state,
        diet: user.diet,
        familyType: user.familyType,
      },
      kids,
      completedVaccines: {},
      onboardingComplete: true,
      parentGender: user.parentGender,
      bio: user.bio,
      expertise: user.expertise,
      photoUrl: '',
      visibilitySettings: {
        showKids: true,
        showState: true,
        showExpertise: true,
        showBio: true,
        showPostCount: true,
      },
      healthTracking: {},
      moodHistory: [],
      healthConditions: [],
      allergies: [],
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Save public profile
    await setDoc(doc(db, 'publicProfiles', uid), {
      uid,
      name: user.name,
      photoUrl: '',
      bio: user.bio,
      expertise: user.expertise,
      state: user.state,
      parentGender: user.parentGender,
      badge,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  const validUsers = DEMO_USERS.map((u, i) => ({ ...u, uid: userUids[i] })).filter(u => u.uid);
  console.log(`\n  Total accounts ready: ${validUsers.length}\n`);

  if (validUsers.length < 2) {
    console.log('❌ Not enough accounts created. Aborting.');
    process.exit(1);
  }

  // Step 2: Create community posts
  console.log('📝 Step 2: Creating community posts...');
  const postIds = [];

  for (let i = 0; i < DEMO_POSTS.length; i++) {
    const postData = DEMO_POSTS[i];
    const user = validUsers[postData.userIdx];
    if (!user) continue;

    const roleLabel = user.parentGender === 'father' ? 'Dad' : 'Maa';
    const badge = `${roleLabel} · ${user.state}`;

    const ref = await addDoc(collection(db, 'communityPosts'), {
      authorUid: user.uid,
      authorName: user.name,
      authorInitial: user.name.charAt(0),
      badge,
      topic: postData.topic,
      text: postData.text,
      reactions: {},
      reactionsByUser: {},
      commentCount: 0,
      approved: true,
      createdAt: Timestamp.fromDate(randomDate(i * 0.5 + Math.random() * 2)),
    });

    postIds.push({ id: ref.id, authorIdx: postData.userIdx, authorUid: user.uid });
    console.log(`  📄 Post by ${user.name}: "${postData.text.slice(0, 50)}..."`);

    // Increment post count
    await updateDoc(doc(db, 'publicProfiles', user.uid), { postsCount: increment(1) });
  }

  console.log(`\n  Total posts created: ${postIds.length}\n`);

  // Step 3: Add reactions across users
  console.log('📝 Step 3: Adding reactions...');
  const EMOJIS = ['❤️', '🤱', '😊', '💪', '🙏', '💜'];
  let reactionCount = 0;

  for (const post of postIds) {
    // 3-7 random users react to each post
    const reactors = randomSubset(
      validUsers.filter(u => u.uid !== post.authorUid),
      3, Math.min(7, validUsers.length - 1)
    );

    const reactions = {};
    const reactionsByUser = {};

    for (const reactor of reactors) {
      const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      reactionsByUser[reactor.uid] = [emoji];
      reactionCount++;
    }

    await updateDoc(doc(db, 'communityPosts', post.id), { reactions, reactionsByUser });
  }
  console.log(`  ❤️ Added ${reactionCount} reactions\n`);

  // Step 4: Add comments
  console.log('📝 Step 4: Adding comments...');
  const DEMO_COMMENTS = [
    'This is so helpful, thank you for sharing!',
    'I went through the exact same thing. Hang in there mama! 💪',
    'Can you share more details about this?',
    'My baby loved this too! Great recommendation.',
    'Saving this for later. Such good advice!',
    'You are doing amazing! Don\'t let anyone tell you otherwise.',
    'We need more posts like this in this community 🙏',
    'Just tried this and it worked! Thank you!',
    'My pediatrician said the same thing. Great to see it confirmed here.',
    'This made my day! Thank you for the positivity 💜',
    'As a first-time mom, I really needed to hear this today.',
    'Totally agree! We all need more support like this.',
    'Following for updates! Please post more.',
    'My MIL told me something similar. Ancient wisdom works!',
    'This is the content I joined this community for 🥰',
  ];

  let commentCount = 0;
  for (const post of postIds) {
    // 1-4 comments per post
    const numComments = 1 + Math.floor(Math.random() * 4);
    const commenters = randomSubset(
      validUsers.filter(u => u.uid !== post.authorUid),
      numComments, numComments
    );

    for (const commenter of commenters) {
      const text = DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)];

      await addDoc(collection(db, 'communityPosts', post.id, 'comments'), {
        authorUid: commenter.uid,
        authorName: commenter.name,
        authorInitial: commenter.name.charAt(0),
        text,
        createdAt: Timestamp.fromDate(randomDate(Math.random() * 3)),
      });
      commentCount++;
    }

    // Update comment count on post
    await updateDoc(doc(db, 'communityPosts', post.id), { commentCount: numComments });
  }
  console.log(`  💬 Added ${commentCount} comments\n`);

  // Step 5: Create follow relationships
  console.log('📝 Step 5: Creating follow relationships...');
  let followCount = 0;

  // Create a web of follows: each user follows 3-5 random others
  for (const user of validUsers) {
    const toFollow = randomSubset(
      validUsers.filter(u => u.uid !== user.uid),
      3, Math.min(5, validUsers.length - 1)
    );

    for (const target of toFollow) {
      const followDocId = `${user.uid}_${target.uid}`;

      // Check if already exists
      const existing = await getDoc(doc(db, 'follows', followDocId));
      if (existing.exists()) continue;

      await setDoc(doc(db, 'follows', followDocId), {
        fromUid: user.uid,
        toUid: target.uid,
        fromName: user.name,
        toName: target.name,
        fromPhotoUrl: '',
        toPhotoUrl: '',
        createdAt: serverTimestamp(),
      });
      followCount++;
    }
  }
  console.log(`  👥 Created ${followCount} follow relationships\n`);

  // Step 6: Update follower/following counts
  console.log('📝 Step 6: Updating follower/following counts...');
  for (const user of validUsers) {
    let followersCount = 0;
    let followingCount = 0;

    for (const other of validUsers) {
      if (other.uid === user.uid) continue;
      // Check if other follows user
      const followerDoc = await getDoc(doc(db, 'follows', `${other.uid}_${user.uid}`));
      if (followerDoc.exists()) followersCount++;
      // Check if user follows other
      const followingDoc = await getDoc(doc(db, 'follows', `${user.uid}_${other.uid}`));
      if (followingDoc.exists()) followingCount++;
    }

    await updateDoc(doc(db, 'publicProfiles', user.uid), {
      followersCount,
      followingCount,
    });
    console.log(`  ${user.name}: ${followersCount} followers, ${followingCount} following`);
  }

  // Step 7: Create some notifications
  console.log('\n📝 Step 7: Creating sample notifications...');
  let notifCount = 0;

  for (const post of postIds.slice(0, 8)) {
    const author = validUsers[post.authorIdx];
    if (!author) continue;

    // Reaction notifications
    const reactor = validUsers.find(u => u.uid !== author.uid);
    if (reactor) {
      await addDoc(collection(db, 'notifications', author.uid, 'items'), {
        type: 'reaction',
        fromUid: reactor.uid,
        fromName: reactor.name,
        postId: post.id,
        postText: DEMO_POSTS[postIds.indexOf(post)]?.text?.slice(0, 60) || '',
        emoji: '❤️',
        read: false,
        createdAt: Timestamp.fromDate(randomDate(Math.random() * 2)),
      });
      notifCount++;
    }

    // Comment notifications
    const commenter = validUsers.find(u => u.uid !== author.uid && u.uid !== reactor?.uid);
    if (commenter) {
      await addDoc(collection(db, 'notifications', author.uid, 'items'), {
        type: 'comment',
        fromUid: commenter.uid,
        fromName: commenter.name,
        postId: post.id,
        postText: DEMO_POSTS[postIds.indexOf(post)]?.text?.slice(0, 60) || '',
        read: false,
        createdAt: Timestamp.fromDate(randomDate(Math.random() * 2)),
      });
      notifCount++;
    }
  }

  // Follow accepted notifications
  for (let i = 0; i < Math.min(5, validUsers.length); i++) {
    const user = validUsers[i];
    const follower = validUsers[(i + 1) % validUsers.length];
    await addDoc(collection(db, 'notifications', user.uid, 'items'), {
      type: 'follow_accepted',
      fromUid: follower.uid,
      fromName: follower.name,
      read: Math.random() > 0.5,
      createdAt: Timestamp.fromDate(randomDate(Math.random() * 5)),
    });
    notifCount++;
  }

  // Pending follow requests (a couple)
  for (let i = 0; i < 3 && i < validUsers.length - 1; i++) {
    const from = validUsers[validUsers.length - 1 - i];
    const to = validUsers[i];
    await addDoc(collection(db, 'followRequests'), {
      fromUid: from.uid,
      toUid: to.uid,
      fromName: from.name,
      fromPhotoUrl: '',
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'notifications', to.uid, 'items'), {
      type: 'follow_request',
      fromUid: from.uid,
      fromName: from.name,
      read: false,
      createdAt: serverTimestamp(),
    });
    notifCount++;
  }

  console.log(`  🔔 Created ${notifCount} notifications\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('🎉 Demo seeding complete!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  👤 ${validUsers.length} users created`);
  console.log(`  📄 ${postIds.length} community posts`);
  console.log(`  ❤️ ${reactionCount} reactions`);
  console.log(`  💬 ${commentCount} comments`);
  console.log(`  👥 ${followCount} follow relationships`);
  console.log(`  🔔 ${notifCount} notifications`);
  console.log('\n📋 Demo login credentials:');
  for (const user of DEMO_USERS) {
    console.log(`  ${user.name}: ${user.email} / ${user.password}`);
  }
  console.log('═══════════════════════════════════════════════════\n');
}

// Run
seedDemoUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
