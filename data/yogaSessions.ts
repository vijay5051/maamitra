import type { Audience } from './audience';

export interface YogaPose {
  id: string;
  emoji: string;
  name: string;
  instruction: string;
  breathCue: string;
  durationSeconds: number;
}

export interface YogaSession {
  id: string;
  name: string;
  description: string;
  duration: number;
  level: string;
  poseCount: number;
  emoji: string;
  contraindications: string[];
  poses: YogaPose[];
  /** Who this session is written for. Untagged = everyone. */
  audience?: Audience;
}

export const YOGA_SESSIONS: YogaSession[] = [
  {
    id: 'y01',
    name: 'Morning Stretch & Breathe',
    description:
      'A gentle morning sequence to wake up your body, release overnight tension, and set a calm tone for the day. Perfect for new mothers who want to begin a gentle movement practice without overexerting a recovering body.',
    duration: 15,
    level: 'Beginner',
    poseCount: 5,
    emoji: '🌅',
    audience: 'all',
    contraindications: ['Severe back pain', 'Hypertension'],
    poses: [
      {
        id: 'y01-p01',
        emoji: '🐄',
        name: 'Cat-Cow Stretch',
        instruction:
          'Come to all fours with your wrists directly below your shoulders and knees below your hips. On an inhale, drop your belly toward the floor, lift your tailbone and chin gently upward into Cow Pose. On an exhale, round your spine toward the ceiling, tuck your chin to your chest and tailbone under into Cat Pose. Move slowly and fluidly between the two shapes, feeling the length along your spine with each breath.',
        breathCue: 'Inhale into Cow, exhale into Cat. Let your breath lead the movement.',
        durationSeconds: 60,
      },
      {
        id: 'y01-p02',
        emoji: '🙏',
        name: 'Seated Forward Bend',
        instruction:
          'Sit on your mat with both legs extended in front of you. On an inhale, lengthen your spine tall. On the exhale, hinge forward from your hips (not your waist), keeping your back as straight as possible. Reach your hands toward your shins, ankles, or feet — wherever feels comfortable without strain. Let your head drop only if your lower back feels comfortable. Hold gently without forcing the stretch.',
        breathCue: 'Inhale to lengthen; exhale to fold a little deeper. Never force — let gravity do the work.',
        durationSeconds: 45,
      },
      {
        id: 'y01-p03',
        emoji: '🧒',
        name: "Child's Pose",
        instruction:
          "Kneel on your mat and touch your big toes together. Sit back on your heels and separate your knees about hip-width apart. Exhale and lay your torso forward between your thighs, extending your arms in front of you with palms flat on the floor. Rest your forehead on the mat or a folded blanket. Allow your hips to sink toward your heels and breathe deeply into your back. This is a sanctuary pose — stay as long as you need.",
        breathCue: 'Breathe deeply into your back body. Feel your ribcage expand with each inhale and soften with each exhale.',
        durationSeconds: 60,
      },
      {
        id: 'y01-p04',
        emoji: '🦋',
        name: 'Butterfly Pose',
        instruction:
          'Sit upright on your mat. Bend both knees and bring the soles of your feet together, letting your knees fall out to the sides. Hold your feet or ankles with both hands. Sit tall on your sitting bones and gently flutter your knees up and down like butterfly wings for a few breaths, then let them rest. You can fold forward gently from the hips to deepen the inner thigh stretch. This pose is wonderful for releasing hip tension from feeding positions and baby-carrying.',
        breathCue: 'Inhale to sit tall; exhale to gently soften your inner thighs downward. No forcing — just noticing.',
        durationSeconds: 45,
      },
      {
        id: 'y01-p05',
        emoji: '💀',
        name: 'Corpse Pose',
        instruction:
          "Lie flat on your back with your legs extended and slightly apart, arms resting alongside your body with palms facing up. Close your eyes. Let your feet fall open naturally. Release any tension in your face, jaw, shoulders, and hands. Allow the floor to fully support your weight. This is complete, intentional rest — not sleep, but conscious relaxation. Let thoughts arise and pass without engaging with them, returning your attention gently to the sensation of your breath.",
        breathCue: 'Simply breathe naturally and observe. No controlling — just being.',
        durationSeconds: 120,
      },
    ],
  },
  {
    id: 'y02',
    name: 'Postpartum Core Recovery',
    description:
      'A carefully designed sequence to safely rebuild deep core and pelvic floor strength after delivery. These exercises avoid the abdominal strain of traditional core work and focus on reconnecting with the deep stabilising muscles that support your spine and pelvis.',
    duration: 20,
    level: 'Gentle',
    poseCount: 6,
    emoji: '💪',
    audience: 'mother',
    contraindications: ['Diastasis recti', 'C-section recovery', 'Uterine prolapse'],
    poses: [
      {
        id: 'y02-p01',
        emoji: '🌬️',
        name: 'Pelvic Floor Breathing',
        instruction:
          'Lie on your back with knees bent and feet flat on the floor, hip-width apart. Place one hand on your belly and one on your chest. Inhale slowly and deeply, allowing your belly to rise and your pelvic floor to soften and relax completely. As you exhale, gently draw up through your pelvic floor as if stopping the flow of urine, and draw your belly button softly toward your spine. Hold the gentle contraction for 3-5 seconds, then fully release on the next inhale. This exercise reconnects you with your core without any strain.',
        breathCue: 'Inhale to fully release and expand; exhale to gently lift and draw in. Never hold your breath.',
        durationSeconds: 60,
      },
      {
        id: 'y02-p02',
        emoji: '🦵',
        name: 'Heel Slides',
        instruction:
          'Lie on your back with both knees bent and feet flat on the floor. On an exhale, gently engage your pelvic floor and draw your belly in slightly. Keeping your lower back neutral (a small natural curve — not pressed flat), slowly slide one heel along the floor until your leg is nearly straight. Inhale to hold, then exhale as you slide the heel back to the starting position. Alternate sides. If your lower back lifts off the floor during the movement, the exercise is too challenging — reduce the range of movement.',
        breathCue: 'Exhale to engage and extend; inhale to hold; exhale to return. Slow and controlled.',
        durationSeconds: 45,
      },
      {
        id: 'y02-p03',
        emoji: '🪲',
        name: 'Dead Bug (Modified)',
        instruction:
          "Lie on your back with knees bent at 90 degrees and arms reaching toward the ceiling (tabletop position for arms and legs). Engage your pelvic floor and keep your lower back gently pressed toward the floor. On an exhale, slowly lower one arm behind your head toward the floor while simultaneously extending the opposite leg. Lower only as far as you can control without your lower back arching. Inhale at the bottom, then exhale to return both limbs to the start. Alternate sides. This exercise builds deep core stability without flexing the spine.",
        breathCue: 'Exhale as you extend; inhale at the end range; exhale as you return. Never rush.',
        durationSeconds: 60,
      },
      {
        id: 'y02-p04',
        emoji: '🌉',
        name: 'Bridge Pose',
        instruction:
          'Lie on your back with knees bent, feet flat on the floor hip-width apart, and arms alongside your body. On an exhale, engage your pelvic floor and gently press through your feet to lift your hips upward, creating a diagonal line from shoulders to knees. Squeeze your glutes gently at the top. Hold for 5 breaths, then slowly lower your spine back to the floor one vertebra at a time. This strengthens the glutes and posterior chain while engaging the deep core without loading the abdominal wall.',
        breathCue: 'Exhale to lift; breathe normally while holding; exhale to lower slowly.',
        durationSeconds: 45,
      },
      {
        id: 'y02-p05',
        emoji: '🦀',
        name: 'Clamshell',
        instruction:
          'Lie on your side with your hips stacked, knees bent at about 45 degrees, and feet together. Rest your head on your lower arm. Without rolling your hips backward, slowly rotate your top knee upward toward the ceiling, opening like a clamshell. Keep your feet together throughout. Go only as high as you can without your pelvis tilting back. Slowly lower the knee back down. This targets the gluteus medius, which supports the hips and pelvis during walking and is often weakened during pregnancy.',
        breathCue: 'Exhale as you open; inhale as you close. Slow and deliberate.',
        durationSeconds: 45,
      },
      {
        id: 'y02-p06',
        emoji: '🌀',
        name: 'Gentle Seated Twist',
        instruction:
          'Sit comfortably cross-legged or in a chair. On an inhale, lengthen your spine upward. On the exhale, gently rotate your torso to the right, placing your right hand behind you for support and your left hand on your right knee. Keep both sitting bones grounded. Look gently over your right shoulder if comfortable. Breathe into the twist for 3-5 breaths, then inhale to return to centre and repeat on the left side. Keep the rotation gentle — this is not a deep twist. Excellent for releasing tension in the thoracic spine from nursing and carrying.',
        breathCue: 'Inhale to lengthen before each twist; exhale to deepen slightly and then breathe naturally.',
        durationSeconds: 30,
      },
    ],
  },
  {
    id: 'y03',
    name: 'Baby & Me Bonding Yoga',
    description:
      'A joyful, interactive yoga session designed for mother and baby together. These poses strengthen your body while engaging your baby through touch, eye contact, and gentle movement — building the secure attachment that underlies healthy development.',
    duration: 25,
    level: 'All Levels',
    poseCount: 6,
    emoji: '👶',
    audience: 'all',
    contraindications: [],
    poses: [
      {
        id: 'y03-p01',
        emoji: '🕉️',
        name: 'Seated Om with Baby',
        instruction:
          'Sit comfortably cross-legged on your mat. Place your baby on your lap facing you, supporting their body with both hands. Close your eyes or soften your gaze. Take a deep breath together and on the exhale, hum a long, resonant "Om" or simply a low humming sound. Feel the vibration in your chest and watch how your baby responds to the sound and sensation. Repeat 3-5 times. This simple ritual signals to both you and your baby that a calm, loving practice is beginning.',
        breathCue: 'Breathe in slowly together; hum or chant "Om" on a long, full exhale.',
        durationSeconds: 60,
      },
      {
        id: 'y03-p02',
        emoji: '🚲',
        name: 'Baby Bicycle Legs',
        instruction:
          'Lie on your back with your knees bent. Place your baby on your thighs facing you, supporting their back with your thighs and holding their hands. Slowly pedal your legs in a cycling motion, which gently moves your baby and makes it a fun, interactive experience. The gentle movement and your smiling face provide visual and vestibular stimulation for your baby while you get a light core and hip flexor workout. Sing a simple song or narrate what you are doing as you pedal.',
        breathCue: 'Breathe naturally and rhythmically. Talk or sing to your baby — your voice is the best rhythm.',
        durationSeconds: 45,
      },
      {
        id: 'y03-p03',
        emoji: '🐻',
        name: 'Mama Bear Plank',
        instruction:
          "Place your baby on the mat in front of you on their back. Come into a modified plank on your knees or a full plank on your toes, with your face directly above your baby's face at their level. Hold the plank while making eye contact, smiling, and talking softly to your baby. They will love looking up at your face. Hold for 10-30 seconds depending on your strength. Lower to your knees to rest between sets. This builds upper body and core strength while creating a beautiful moment of connection.",
        breathCue: 'Breathe steadily and resist the urge to hold your breath. Talk to your baby — it keeps your breath flowing naturally.',
        durationSeconds: 30,
      },
      {
        id: 'y03-p04',
        emoji: '🐍',
        name: 'Baby Cobra',
        instruction:
          'Place your baby on the mat on their tummy, facing away from you, for their tummy time. Come to lie on your tummy behind or beside them. Place your palms on the floor below your shoulders and on an inhale, gently press up into a low cobra, lifting just your chest. Hold at a height where you can look at your baby and encourage them with your voice, smiles, and eye contact. This simultaneously supports your baby through supervised tummy time while gently strengthening your own back extensors and opening your chest.',
        breathCue: 'Inhale to rise into cobra; breathe naturally while holding and engaging with your baby.',
        durationSeconds: 30,
      },
      {
        id: 'y03-p05',
        emoji: '🤗',
        name: 'Rolling Hug',
        instruction:
          "Sit cross-legged or with legs extended. Hold your baby securely against your chest. Gently rock from side to side in a slow rolling motion, singing softly or humming. You can add a gentle forward and backward rock as well. Feel free to close your eyes and simply enjoy the closeness. This is as much about connection and oxytocin as it is about movement. There's no wrong way to do this — follow your baby's cues and your own instinct.",
        breathCue: 'Breathe slowly and deeply. With each exhale, soften and relax more fully into the embrace.',
        durationSeconds: 60,
      },
      {
        id: 'y03-p06',
        emoji: '✨',
        name: 'Savasana Together',
        instruction:
          'Lie down on your mat on your back. Place your baby on your chest or beside you on the mat (supervised). Rest your hands gently on your baby if they are on your chest. Close your eyes. Allow your body to completely surrender to the floor. Focus on the warmth of your baby, the sound of their breathing, and the rhythm of your own heartbeat. Let any thoughts about tasks or worries drift by without following them. Stay here for as long as your baby allows — even 5 minutes of this conscious rest is deeply restorative.',
        breathCue: 'Breathe naturally and gently. There is nowhere else you need to be right now.',
        durationSeconds: 120,
      },
    ],
  },
  {
    id: 'y04',
    name: 'Stress Relief & Calm',
    description:
      'A nurturing sequence specifically designed to lower cortisol levels, calm an overactivated nervous system, and provide genuine mental relief for a stressed or anxious mother. These poses combine gentle movement with breathwork and meditation.',
    duration: 20,
    level: 'Beginner',
    poseCount: 6,
    emoji: '🧘',
    audience: 'all',
    contraindications: ['Severe back pain'],
    poses: [
      {
        id: 'y04-p01',
        emoji: '🌬️',
        name: '4-7-8 Breathing',
        instruction:
          'Sit comfortably or lie down. Place one hand on your belly and one on your chest. Close your eyes. Inhale slowly and quietly through your nose for a count of 4. Hold your breath gently for a count of 7. Exhale completely through your mouth, making a gentle whoosh sound, for a count of 8. This is one breath cycle. Repeat 4-8 cycles. The extended exhale activates the parasympathetic nervous system (your rest-and-digest system), rapidly reducing anxiety and stress. This technique can be used any time — during night feeds, before difficult conversations, or in moments of overwhelm.',
        breathCue: 'In for 4, hold for 7, out for 8. The long exhale is the magic. Let it be audible.',
        durationSeconds: 60,
      },
      {
        id: 'y04-p02',
        emoji: '🌊',
        name: 'Standing Forward Fold',
        instruction:
          "Stand with feet hip-width apart. On an inhale, lengthen your spine tall. On the exhale, soften your knees generously and fold forward from your hips, letting your head, neck, and arms hang heavy toward the floor. There is no target — you might touch your shins, your ankles, or the floor. It does not matter. Simply let gravity do the work and allow your upper body to hang with complete surrender. Shake your head slowly to release neck tension. Bend your knees as much as needed. Stay for 5-8 breaths.",
        breathCue: 'With each exhale, let go a little more. Imagine releasing the weight of the day from your shoulders.',
        durationSeconds: 45,
      },
      {
        id: 'y04-p03',
        emoji: '🧍',
        name: 'Wide-Legged Forward Bend',
        instruction:
          'Stand with feet about 1 metre apart and toes pointing slightly inward. Place your hands on your hips. Inhale to lengthen your spine, then exhale to fold forward, placing your hands or fingertips on the floor (or on a block or chair if needed). Let your head hang freely and breathe into the space between your shoulder blades. This pose provides a deep stretch for the inner thighs and hamstrings while the inversion effect (head below heart) promotes calm and increased blood flow to the brain. Hold for 5-8 breaths.',
        breathCue: 'Breathe wide and full into your side ribs. Feel the width of your back expand with each inhale.',
        durationSeconds: 45,
      },
      {
        id: 'y04-p04',
        emoji: '🏔️',
        name: 'Legs Up the Wall',
        instruction:
          'Sit sideways very close to a wall. As you lie back onto the floor, swing your legs up the wall so your body forms an L-shape. Your sitting bones may or may not touch the wall — adjust to whatever is comfortable. Place your arms out to the sides with palms facing up, or rest your hands on your belly. Close your eyes. This deeply restorative inversion reduces swelling in the legs and feet, calms the nervous system, and relieves fatigue. It is one of the most powerful restorative poses available. Stay for 5-15 minutes.',
        breathCue: 'Simply breathe naturally. Allow each exhale to soften you a little more into the floor.',
        durationSeconds: 120,
      },
      {
        id: 'y04-p05',
        emoji: '🌸',
        name: 'Seated Meditation',
        instruction:
          'Sit comfortably on a folded blanket or cushion with your legs crossed. Lengthen your spine gently upright. Rest your hands on your knees with palms facing up (open and receptive) or down (grounded and calm). Close your eyes. Begin to observe your natural breath without changing it — simply notice the inhale and the exhale, the brief pause between them, the sensation of air moving in and out. When thoughts arise (and they will), simply notice them without judgment and return your attention gently to your breath. This is not about stopping thoughts; it is about not being dragged away by them.',
        breathCue: 'Observe your breath as it is. Each return of attention to the breath is a moment of mindfulness — every single one.',
        durationSeconds: 60,
      },
      {
        id: 'y04-p06',
        emoji: '🌙',
        name: 'Yoga Nidra',
        instruction:
          "Lie down on your back in full Savasana — legs extended and slightly apart, arms alongside your body with palms facing up. Close your eyes and take three slow, deep breaths. Set an intention (sankalpa): a short positive statement like 'I am calm and capable' or 'I am enough.' Then systematically relax each part of your body, starting from your toes and moving upward: feet, ankles, calves, knees, thighs, hips, belly, chest, hands, arms, shoulders, neck, face, and scalp. Each body part: bring your awareness to it, notice any sensation, then consciously release any tension. Stay in this state of deep, conscious relaxation for at least 10 minutes. You may drift in and out of sleep — this is fine.",
        breathCue: 'Breathe naturally. There is nothing to do and nowhere to go. This is complete rest.',
        durationSeconds: 120,
      },
    ],
  },
  {
    id: 'y05',
    name: 'Sleep Better Tonight',
    description:
      'A soothing, restorative evening sequence designed to transition your nervous system from the busyness of the day into a state of calm readiness for sleep. These poses are gentle enough to do in your bedroom, in comfortable clothes, just before you sleep.',
    duration: 15,
    level: 'Restorative',
    poseCount: 5,
    emoji: '🌙',
    audience: 'all',
    contraindications: ['Hypertension'],
    poses: [
      {
        id: 'y05-p01',
        emoji: '🏔️',
        name: 'Legs Up the Wall',
        instruction:
          'Prepare your bed or mat near a wall. Sit sideways close to the wall, then lie back and swing your legs up so they rest against the wall. Adjust as needed so you are comfortable — your hips can be close to or a little away from the wall. Let your arms rest open at your sides with palms facing up. Close your eyes and take slow, deep breaths. The gentle inversion drains tired, swollen legs, lowers blood pressure, and sends a signal to your body that the day is done and it is safe to rest. Stay for 5-10 minutes.',
        breathCue: 'Long, slow, sighing exhales. Let the floor hold your weight completely.',
        durationSeconds: 120,
      },
      {
        id: 'y05-p02',
        emoji: '🌉',
        name: 'Supported Bridge',
        instruction:
          'Lie on your back with knees bent and feet flat on the floor. Lift your hips and slide a folded blanket, firm pillow, or yoga block under your sacrum (the flat bone at the base of your spine). Let your hips rest fully supported on the prop. Release all muscular effort — your hips should not be working. Arms rest alongside your body or you can place hands on your belly. Close your eyes. This supported inversion is deeply restorative for the lower back and reproductive organs and gently opens the chest, counteracting the hunched-forward posture of nursing and baby-holding.',
        breathCue: 'Breathe softly into your chest and belly. Let the prop do all the work — you are here to receive, not to work.',
        durationSeconds: 90,
      },
      {
        id: 'y05-p03',
        emoji: '😄',
        name: 'Happy Baby Pose',
        instruction:
          "Lie on your back and draw both knees into your chest. Take hold of the outer edges of your feet (or your ankles or shins, whatever is accessible) with your hands. Open your knees wider than your torso and draw them down toward your armpits. Flex your feet and press them gently up into your hands as you draw them down — creating a gentle resistance. Rock side to side like a happy baby to massage the lower back. This pose releases the inner groins, sacrum, and lower back — areas that carry enormous tension in new mothers. Your baby will likely find this hilarious if they see you.",
        breathCue: 'Breathe long and easy. The rocking motion can follow the rhythm of your breath.',
        durationSeconds: 60,
      },
      {
        id: 'y05-p04',
        emoji: '🌀',
        name: 'Supine Spinal Twist',
        instruction:
          "Lie on your back with your legs extended. Draw your right knee into your chest, then let it cross over to the left side of your body, keeping your right shoulder on the floor. Extend your right arm out to the right at shoulder height, palm facing down. Turn your gaze gently to the right. Hold for 5-8 breaths, breathing into your right shoulder and outer hip. Then inhale to bring the knee back to centre, and repeat on the left side. This pose wrings out tension from the spinal muscles, aids digestion, and releases the thoracic spine — all common areas of tightness for new mothers.",
        breathCue: 'Inhale to create length; exhale to allow a little more release into the twist. Never force.',
        durationSeconds: 60,
      },
      {
        id: 'y05-p05',
        emoji: '🌙',
        name: 'Yoga Nidra',
        instruction:
          "Lie in full Savasana — legs extended, arms slightly away from your body with palms up, eyes closed. Soften your face, unclench your jaw, and release your tongue from the roof of your mouth. Begin to scan your body slowly from the toes upward: bring your awareness to each body part in turn, notice any sensation without judgment, and consciously relax that area before moving on. When you reach the top of your head, let your awareness expand outward to encompass your whole body resting quietly in the dark. Breathe gently and naturally. Let each thought drift past like a cloud without engagement. Tonight's sleep begins right here, right now. Allow yourself to drift.",
        breathCue: 'No controlling. Simply breathe, observe, and let go. Sleep will come when it is ready.',
        durationSeconds: 120,
      },
    ],
  },
  {
    id: 'y06',
    name: "Dad's Strength & Stability",
    description:
      'A grounding sequence targeted at the muscle groups dads tax most during the newborn phase: upper back tension from carrying, tight hip flexors from sitting and driving, and a weakened core from long hours hunched over a feeding bottle or playing on the floor. Builds strength without requiring you to leave the bedroom.',
    duration: 20,
    level: 'Beginner',
    poseCount: 6,
    emoji: '💪',
    audience: 'father',
    contraindications: ['Severe back pain', 'Herniated disc'],
    poses: [
      {
        id: 'y06-p01',
        emoji: '🐱',
        name: 'Cat-Cow Flow',
        instruction:
          'Come to all fours with wrists under shoulders and knees under hips. Inhale and drop your belly, lift tailbone and gaze (Cow). Exhale and round your spine, tuck chin and tailbone (Cat). Move slowly and deliberately, feeling each vertebra move. This warms up the spine after hours of carrying baby and sitting at a desk.',
        breathCue: 'Inhale to open into Cow; exhale to round into Cat. Let breath lead.',
        durationSeconds: 60,
      },
      {
        id: 'y06-p02',
        emoji: '🏔️',
        name: 'Downward Dog',
        instruction:
          'From all fours, tuck your toes and lift your hips up and back into an inverted V. Press your palms firmly into the mat, lengthen your spine, and let your heels sink toward the floor (they may not reach — this is normal). Bend your knees if your hamstrings are tight. Hold for 5-8 breaths, then lower to your knees. This stretches the entire posterior chain — calves, hamstrings, back — that gets tight from holding and bouncing a baby.',
        breathCue: 'Inhale to lengthen; exhale to press hips up and back.',
        durationSeconds: 45,
      },
      {
        id: 'y06-p03',
        emoji: '⚔️',
        name: 'Warrior II',
        instruction:
          'Step your feet wide apart (about a leg-length). Turn your right foot out 90 degrees and your left foot in slightly. Bend your right knee until it is directly over your right ankle — thigh parallel to the floor if possible. Extend your arms straight out at shoulder height, gazing over your right fingertips. Hold for 5 breaths, then switch sides. Builds leg strength for carrying your baby up stairs, hip mobility, and shoulder endurance.',
        breathCue: 'Breathe steadily and deeply. Let the inhale expand your chest; let the exhale ground you through the feet.',
        durationSeconds: 60,
      },
      {
        id: 'y06-p04',
        emoji: '🦅',
        name: 'Eagle Arms',
        instruction:
          'Sit or stand tall. Extend both arms forward. Cross your right arm over your left at the elbows. Bend both elbows and wrap the forearms so the palms meet (or backs of hands meet if that is as far as you go). Lift the elbows to shoulder height. Breathe into the space between your shoulder blades for 5 breaths — this is where tension from carrying babies concentrates. Switch arm cross and repeat.',
        breathCue: 'Breathe into your upper back. Exhale to release the tension you are holding there.',
        durationSeconds: 45,
      },
      {
        id: 'y06-p05',
        emoji: '🌉',
        name: 'Glute Bridge',
        instruction:
          'Lie on your back with knees bent, feet flat on the floor hip-width apart. On an exhale, press through your heels and lift your hips, creating a line from shoulders to knees. Squeeze your glutes firmly at the top — do not just lift with your lower back. Hold for 3 breaths, then lower slowly. Repeat 8-10 times. Reverses the damage of hours of sitting and rebuilds the glutes, which dads tend to ignore.',
        breathCue: 'Exhale to lift; breathe normally while holding; inhale to lower slowly.',
        durationSeconds: 60,
      },
      {
        id: 'y06-p06',
        emoji: '🪲',
        name: 'Dead Bug',
        instruction:
          'Lie on your back with knees bent at 90 degrees and arms reaching toward the ceiling (tabletop position). Press your lower back into the floor. On an exhale, extend your right arm behind your head and your left leg out parallel to the floor. Keep the lower back glued to the mat. Inhale to return to centre. Switch sides. This builds deep core stability — the single best way to protect your lower back from years of hauling children around.',
        breathCue: 'Exhale as you extend; inhale to return. Slow and controlled.',
        durationSeconds: 60,
      },
    ],
  },
  {
    id: 'y07',
    name: 'Tired Dad Reset',
    description:
      "A restorative evening sequence for exhausted new dads. These poses decompress the spine, release neck and shoulder tension built up from long days and broken nights, and calm a stressed nervous system. Do it in pajamas. No warm-up needed. Ten minutes will change your night.",
    duration: 15,
    level: 'Restorative',
    poseCount: 5,
    emoji: '🌙',
    audience: 'father',
    contraindications: ['Hypertension'],
    poses: [
      {
        id: 'y07-p01',
        emoji: '🏔️',
        name: 'Legs Up the Wall',
        instruction:
          'Sit sideways next to a wall. Lie back and swing your legs up so they rest against the wall. Your body forms an L. Rest your arms at your sides, palms up. Close your eyes and simply breathe. This pose reverses the blood pooling in your legs from a long day on your feet, drops your heart rate, and tells your nervous system the day is done. Stay for 5 minutes minimum.',
        breathCue: 'Long, slow exhales. Let each out-breath be audible if it wants to be.',
        durationSeconds: 120,
      },
      {
        id: 'y07-p02',
        emoji: '🧒',
        name: "Child's Pose",
        instruction:
          'Kneel on the floor with big toes together and knees about hip-width apart. Sit back on your heels and fold your torso forward between your thighs. Extend your arms forward or rest them alongside your body. Let your forehead rest on the floor or a cushion. This pose releases the lower back, opens the hips, and calms the mind. Stay for 2-3 minutes.',
        breathCue: 'Breathe into the back of your ribcage. Feel the breath widen your back with each inhale.',
        durationSeconds: 90,
      },
      {
        id: 'y07-p03',
        emoji: '🧎',
        name: 'Thread the Needle',
        instruction:
          'Start on all fours. Slide your right arm under your left arm, lowering your right shoulder and the right side of your head to the floor. Keep your hips stacked over your knees. Feel the stretch deep in the right shoulder blade and upper back — exactly where tension pools from holding baby. Hold for 5-8 breaths, then switch sides. This is the single best stretch for carrier-tension.',
        breathCue: 'Exhale deeper into the stretch. Breathe into the tight spot, not around it.',
        durationSeconds: 60,
      },
      {
        id: 'y07-p04',
        emoji: '🌀',
        name: 'Supine Spinal Twist',
        instruction:
          'Lie on your back with legs extended. Draw your right knee into your chest, then cross it over to the left side of your body, keeping the right shoulder on the floor. Extend your right arm out to the right at shoulder height. Turn your gaze gently right. Hold for 5-8 breaths. The twist releases the entire spine after a day of asymmetric carrying. Switch sides.',
        breathCue: 'Inhale to lengthen the spine; exhale to soften more deeply into the twist. Never force.',
        durationSeconds: 60,
      },
      {
        id: 'y07-p05',
        emoji: '💀',
        name: 'Savasana',
        instruction:
          'Lie flat on your back with legs extended slightly apart and arms resting alongside your body with palms facing up. Close your eyes. Let your feet fall open. Soften your face, unclench your jaw, let your tongue drop from the roof of your mouth. This is the most important pose — the one most dads skip. Five minutes of conscious rest here gives you more recovery than twenty minutes of half-attention elsewhere. Stay until you feel fully settled.',
        breathCue: 'Simply breathe. There is nothing to fix, nothing to do. You have earned this.',
        durationSeconds: 120,
      },
    ],
  },
];
