import type { Audience } from './audience';

export interface Milestone {
  id: string;
  ageMonths: number;
  ageLabel: string;
  emoji: string;
  title: string;
  description: string;
  category: string;
  /** Parent-role audience. Most milestones are universal — tag father/
   *  mother only for bonding / feeding milestones that read differently. */
  audience?: Audience;
}

export const MILESTONES: Milestone[] = [
  {
    id: 'm01',
    ageMonths: 1,
    ageLabel: '1 Month',
    emoji: '👀',
    title: 'Lifts Head Briefly',
    description:
      'Your baby begins to lift their head for a few seconds during tummy time, strengthening their neck muscles. They can focus on faces about 20–30 cm away and track slow-moving objects.',
    category: 'Vision & Movement',
  },
  {
    id: 'm02',
    ageMonths: 2,
    ageLabel: '2 Months',
    emoji: '😊',
    title: 'Social Smile',
    description:
      'Your baby flashes their first real smile in response to your face or voice — not just a reflex. This magical social smile marks the beginning of intentional communication and emotional bonding.',
    category: 'Social',
  },
  {
    id: 'm03',
    ageMonths: 3,
    ageLabel: '3 Months',
    emoji: '💪',
    title: 'Holds Head Steady',
    description:
      'With growing neck and upper body strength, your baby can now hold their head steady and upright when supported in a sitting position. They may also start to push up on their arms during tummy time.',
    category: 'Motor',
  },
  {
    id: 'm04',
    ageMonths: 4,
    ageLabel: '4 Months',
    emoji: '😄',
    title: 'Laughs Aloud',
    description:
      'Joyful belly laughs emerge as your baby discovers the delight of play and interaction. Tickling, silly sounds, and peek-a-boo games are especially likely to trigger these wonderful bursts of laughter.',
    category: 'Social',
  },
  {
    id: 'm05',
    ageMonths: 6,
    ageLabel: '6 Months',
    emoji: '🪑',
    title: 'Sits with Support',
    description:
      'Your baby can now sit upright when propped by a cushion or your hands, with much better head control. They may begin to reach for and grasp objects with both hands while in this seated position.',
    category: 'Motor',
  },
  {
    id: 'm06',
    ageMonths: 8,
    ageLabel: '8 Months',
    emoji: '🐛',
    title: 'Crawls',
    description:
      'Your baby starts moving independently, whether on all fours, commando-style on their tummy, or rolling across the floor. This is a major motor milestone that requires strength, coordination, and planning.',
    category: 'Motor',
  },
  {
    id: 'm07',
    ageMonths: 9,
    ageLabel: '9 Months',
    emoji: '👶',
    title: 'Says Mama / Dada',
    description:
      'Your baby begins producing consonant-vowel combinations like "mama" and "dada", though they may not yet associate the words with the right person. This babbling is a crucial stepping stone to meaningful speech.',
    category: 'Language',
  },
  {
    id: 'm08',
    ageMonths: 12,
    ageLabel: '12 Months',
    emoji: '🧍',
    title: 'Stands Alone',
    description:
      'Your baby pulls up to standing using furniture and may briefly let go to stand unaided. Many babies take their first wobbly independent steps around this milestone, which is a huge achievement in motor development.',
    category: 'Motor',
  },
  {
    id: 'm09',
    ageMonths: 15,
    ageLabel: '15 Months',
    emoji: '🗣️',
    title: 'Says 3–5 Words',
    description:
      'Your toddler uses a small but growing vocabulary of meaningful words beyond "mama" and "dada". They understand far more than they can say and communicate eagerly through pointing, gesturing, and vocalising.',
    category: 'Language',
  },
  {
    id: 'm10',
    ageMonths: 18,
    ageLabel: '18 Months',
    emoji: '🚶',
    title: 'Walks Steadily',
    description:
      'Your toddler walks confidently without support, with a more upright posture and fewer tumbles. They may start to run (though still a bit unsteady) and love to climb on low furniture and stairs with assistance.',
    category: 'Motor',
  },
  {
    id: 'm11',
    ageMonths: 24,
    ageLabel: '24 Months',
    emoji: '💬',
    title: '2-Word Phrases',
    description:
      'Your toddler combines two words together, such as "more milk", "daddy come", or "big dog". Their vocabulary typically exceeds 50 words and new words appear almost every day during this language explosion phase.',
    category: 'Language',
  },
  {
    id: 'm12',
    ageMonths: 36,
    ageLabel: '36 Months',
    emoji: '🏃',
    title: 'Runs and Jumps',
    description:
      'Your child runs with confidence, jumps with both feet, kicks a ball, and climbs with ease. Gross motor skills are well-developed, allowing them to participate in active play, dancing, and outdoor activities.',
    category: 'Motor',
  },
  {
    id: 'm13',
    ageMonths: 42,
    ageLabel: '42 Months',
    emoji: '✂️',
    title: 'Uses Scissors',
    description:
      'Your child can hold and use child-safe scissors to cut along a line. Fine motor control is improving rapidly — they can draw simple shapes, copy letters, and dress themselves with minimal help.',
    category: 'Fine Motor',
  },
  {
    id: 'm14',
    ageMonths: 48,
    ageLabel: '4 Years',
    emoji: '🖌️',
    title: 'Draws a Person',
    description:
      'Your child draws a recognisable figure with a head, body, arms, and legs. They can tell detailed stories, understand the difference between real and make-believe, and follow 3-step instructions with ease.',
    category: 'Cognitive',
  },
  {
    id: 'm15',
    ageMonths: 54,
    ageLabel: '4.5 Years',
    emoji: '🔤',
    title: 'Recognises Letters',
    description:
      'Your child recognises most letters of the alphabet, writes their own name, and may begin sounding out simple words. Vocabulary exceeds 1,500 words and they love asking "why" and "how" questions.',
    category: 'Language',
  },
  {
    id: 'm16',
    ageMonths: 60,
    ageLabel: '5 Years',
    emoji: '⭐',
    title: 'School Readiness',
    description:
      'Your child can count to 10, recognise basic shapes and colours, follow multi-step instructions, and take turns in games. They show strong social skills, dress independently, and are ready to thrive in a structured school environment.',
    category: 'Cognitive',
  },
  {
    id: 'm17',
    ageMonths: 66,
    ageLabel: '5.5 Years',
    emoji: '📖',
    title: 'Begins Reading',
    description:
      'Your child starts reading simple words and short sentences. They understand story structure, can retell a story in sequence, and show a love for books. Writing skills improve — they can copy sentences and begin writing independently.',
    category: 'Language',
  },
  {
    id: 'm18',
    ageMonths: 72,
    ageLabel: '6 Years',
    emoji: '🧠',
    title: 'Logical Thinking',
    description:
      'Your child understands cause and effect, can solve simple problems independently, and begins to grasp concepts like time (yesterday, today, tomorrow). Friendships deepen and they show empathy and conflict-resolution skills.',
    category: 'Cognitive',
  },
];
