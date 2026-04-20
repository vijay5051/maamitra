import type { Audience } from './audience';

export interface Article {
  id: string;
  title: string;
  preview: string;
  body: string;
  topic: string;
  readTime: string;
  ageMin: number;
  ageMax: number;
  emoji: string;
  tag: string;
  url?: string;     // External resource link
  imageUrl?: string; // Cover image (dynamic articles from admin)
  /** Who this article is written for. Untagged = everyone. See
   *  data/audience.ts for how filtering is applied. */
  audience?: Audience;
}

export const ARTICLES: Article[] = [
  {
    id: 'a01',
    title: 'Starting Solid Foods the Right Way',
    preview:
      "Introducing solids is an exciting milestone, but the timing and approach matter a great deal for your baby's health. Most Indian paediatricians recommend beginning at 6 months with soft, mashed home-cooked foods like daliya, khichdi, and mashed banana. Starting with one ingredient at a time lets you identify any food sensitivities early.",
    body: `Starting solid foods is one of the most exciting milestones in your baby's first year. The World Health Organization and Indian Academy of Pediatrics (IAP) recommend exclusive breastfeeding for the first 6 months, after which complementary foods should be introduced while continuing to breastfeed.

Signs Your Baby Is Ready:
- Sits up with minimal support and holds their head steady
- Shows interest in food — watches you eat and reaches for your plate
- Has lost the tongue-thrust reflex (no longer pushes food out of their mouth automatically)
- Weighs at least twice their birth weight

The Best First Foods for Indian Babies: Traditional Indian foods are excellent first foods. Begin with single-ingredient purees and gradually increase texture and variety. Dal water or moong dal khichdi is easy to digest and high in protein and iron. Rice porridge (kanji) is gentle on the tummy with a familiar taste. Mashed banana is naturally sweet and rich in potassium and energy. Mashed sweet potato is packed with Vitamin A and fibre. Ragi porridge is high in calcium and iron, and is a traditional weaning food across South India.

How to Introduce New Foods: Follow the 3-day wait rule — introduce one new food and wait three days before introducing another. This helps you identify allergies or intolerances. Begin with 1-2 teaspoons and gradually increase to a few tablespoons over days and weeks.

Foods to Avoid Before 1 Year: Honey (risk of infant botulism), cow's milk as a main drink (though dairy products like curd are fine), salt and sugar (kidneys are not mature enough), whole nuts (choking hazard), and highly spiced or heavily salted foods.

Remember, at this stage, food is for exploration and learning — breast milk or formula remains the primary source of nutrition until 12 months.`,
    topic: 'Feeding',
    readTime: '5 min',
    ageMin: 4,
    ageMax: 8,
    emoji: '🥣',
    tag: 'Weaning',
    url: 'https://iapindia.org/pdf/Complementary-Feeding-guidelines.pdf',
    audience: 'all',
  },
  {
    id: 'a02',
    title: "Understanding Your Newborn's Sleep Cycles",
    preview:
      "Newborns sleep up to 16-18 hours a day, yet new parents often feel perpetually exhausted — and there's a good reason for that. Unlike adult sleep, a newborn's sleep cycle is much shorter (around 45-50 minutes) and they spend more time in active, light REM sleep. Understanding these patterns can help you set realistic expectations and find moments to rest.",
    body: `Sleep deprivation is one of the biggest challenges of new parenthood, and understanding why newborns sleep the way they do can make a world of difference to your sanity and wellbeing.

How Newborn Sleep Differs from Adult Sleep: Adult sleep cycles last approximately 90 minutes, with long stretches of deep sleep. Newborn sleep cycles are much shorter — around 45-50 minutes — and a much larger proportion is spent in active REM (Rapid Eye Movement) sleep. This light, active sleep is thought to be important for brain development.

During REM sleep, your baby may twitch, grimace, make small sounds, and appear to be waking. Many parents rush to pick up their baby at this point, but waiting 30-60 seconds often reveals that the baby has settled themselves back to sleep.

Sleep Needs by Age: Newborns 0-1 month need 15-18 hours per day. At 1-2 months, 14-17 hours. At 3-4 months, 13-15 hours. At 4-6 months, 12-14 hours.

Why Newborns Wake So Frequently: Newborns have tiny tummies that empty quickly — breastfed babies typically feed every 2-3 hours, formula-fed babies every 3-4 hours. They also haven't yet developed circadian rhythms (the internal body clock that regulates day and night). This typically begins to develop around 3-4 months of age.

Safe Sleep Practices (IAP and WHO Recommendations): Always place baby on their back to sleep (reduces SIDS risk by up to 50%). Use a firm, flat mattress with a fitted sheet — no pillows, quilts, or bumpers. Keep the sleep area at a comfortable room temperature (around 24-26 degrees C). Room-sharing (but not bed-sharing) is recommended for at least the first 6 months.

Helping Your Baby Sleep Better: Expose baby to natural light during the day to help establish day-night rhythms. Keep nights quiet, dark, and calm during feeds and nappy changes. Watch for sleepy cues (yawning, eye-rubbing, staring into the distance) and respond promptly. Develop a short, consistent bedtime routine from around 6-8 weeks.

A Word for Exhausted Mamas: Sleep deprivation is real and hard. Please accept help when offered, sleep when your baby sleeps, and know that this phase, while intense, is temporary. Most babies begin sleeping longer stretches by 3-4 months as their nervous system matures.`,
    topic: 'Sleep',
    readTime: '4 min',
    ageMin: 0,
    ageMax: 3,
    emoji: '😴',
    tag: 'Newborn',
    url: 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/default.aspx',
    audience: 'all',
  },
  {
    id: 'a03',
    title: 'Breastfeeding Tips for Indian Mothers',
    preview:
      "Breastfeeding is deeply valued in Indian culture, yet many mothers struggle silently with latch issues, low milk supply concerns, and conflicting advice from well-meaning family members. Breast milk is perfectly designed for your baby — it changes in composition through every feed and adapts to your baby's needs as they grow. With the right support and information, most mothers can breastfeed successfully.",
    body: `Breastfeeding is one of the most natural and beneficial things you can do for your baby, but natural does not always mean easy. Many Indian mothers face unique challenges — from pressure to give the baby water or honey before the first feed, to unsolicited advice about milk insufficiency.

The First Feed — Colostrum Is Liquid Gold: The thick, yellowish colostrum that your breasts produce in the first 3-5 days is extraordinarily precious. It is packed with antibodies, growth factors, and immune cells that protect your newborn from infections. Every drop counts — do not replace or supplement it with anything unless medically advised. Try to initiate breastfeeding within the first hour of birth (known as early initiation), which significantly improves breastfeeding success rates and helps the uterus contract.

Getting the Latch Right: A correct latch is the single most important factor in comfortable, effective breastfeeding. Baby's mouth should be wide open, covering not just the nipple but most of the areola. Baby's chin should touch your breast and their nose should be free or just touching. You should hear rhythmic swallowing, not clicking or smacking sounds. Breastfeeding should not be painful — if it hurts, gently break the latch with your finger and try again.

How Often to Feed: Breastfeed on demand — this means 8-12 times in 24 hours for newborns. Feeding frequently signals your body to make more milk. The more you feed, the more milk you produce. Don't watch the clock; watch your baby.

Signs Baby Is Getting Enough Milk: 6 or more wet nappies per day after Day 5, regaining birth weight by 10-14 days, regular weight gain (typically 150-200g per week in the first 3 months), baby seems satisfied after feeds, and audible swallowing during feeds.

Traditional Indian galactagogues (milk-boosting foods) with reasonable evidence include methi (fenugreek), jeera (cumin) in warm water, satavari, and warm nourishing foods like dals and khichdi with ghee.

The WHO and IAP both recommend exclusive breastfeeding for 6 months, and continued breastfeeding with complementary foods until at least 2 years or beyond.`,
    topic: 'Feeding',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 6,
    emoji: '🤱',
    tag: 'Breastfeeding',
    url: 'https://www.who.int/health-topics/breastfeeding',
    audience: 'mother',
  },
  {
    id: 'a04',
    title: "Baby's First Year: Month-by-Month Development",
    preview:
      "The first 12 months of your baby's life are filled with breathtaking changes — from a helpless newborn who can barely hold their head up, to a curious toddler taking their first steps and saying their first words. This month-by-month guide helps Indian parents know what to watch for, celebrate, and when to seek advice.",
    body: `Your baby's first year is an extraordinary journey of discovery. Here is what to generally expect each month, keeping in mind that every baby develops at their own pace.

Month 1: Your newborn spends most of the time sleeping and feeding. Key abilities include turning their head from side to side when lying on their tummy, responding to your voice, and having a strong grasp reflex. Vision is blurry beyond 20-30 cm.

Month 2: Social smiling appears — perhaps the most rewarding milestone yet. Baby begins to coo and make vowel sounds. Can track a moving face and starts to open and close hands with more intention.

Month 3: Head control is much improved. Baby pushes up on their arms during tummy time. Babbling increases. Begins to recognise primary caregivers and shows preference.

Month 4: Laughs aloud — a truly magical moment. Reaches for and bats at dangling toys. Can bear weight on legs briefly when held standing. Rolls from tummy to back.

Month 5: Sits with support for longer periods. Reaches with both arms. Transfers objects from one hand to the other. Recognises their own name. May begin to show stranger awareness.

Month 6: Many babies begin sitting independently. Solid foods are typically introduced this month. Babbles with consonant sounds like "ba" and "da". May begin to crawl or show signs of crawling.

Month 7-8: Crawls. Pulls to standing using furniture. Pincer grasp begins to develop. "Mama" and "dada" babbling becomes more purposeful. Object permanence develops.

Month 9-10: Cruises along furniture. Waves bye-bye. Plays peek-a-boo. Responds to simple instructions. May develop separation anxiety.

Month 12: First birthday! Baby likely walks or is close to walking. Says 2-5 words. Points to request objects. May begin feeding themselves finger foods independently.

IAP Red Flags to Discuss with Your Paediatrician: Not smiling by 3 months, not babbling by 9 months, not pointing or waving by 12 months, not walking by 18 months, or any loss of previously acquired skills at any age.`,
    topic: 'Development',
    readTime: '8 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '👶',
    tag: 'Development',
    url: 'https://www.cdc.gov/ncbddd/actearly/milestones/index.html',
    audience: 'all',
  },
  {
    id: 'a05',
    title: 'Postpartum Recovery: What to Expect',
    preview:
      "The weeks after delivery are often called the fourth trimester — a time of profound physical and emotional adjustment for the new mother. Indian culture has long recognised the importance of this period through the tradition of the 40-day confinement. Modern medicine confirms what our grandmothers knew: the postpartum period demands dedicated rest, nourishment, and support.",
    body: `Bringing a new life into the world is one of the most transformative events a woman's body will ever experience. Whether you delivered vaginally or by caesarean section, your body will go through significant changes in the weeks and months after birth.

The First 24 Hours After Delivery: After a vaginal birth, you may experience perineal soreness or stitches, afterpains as the uterus contracts back to its pre-pregnancy size, lochia (vaginal discharge starting as heavy bright red bleeding and transitioning over 4-6 weeks), and shivering or sweating from hormonal fluctuations.

After a C-section, you will also experience incision pain managed with prescribed pain relief, gas pain that is common after abdominal surgery (walking helps), and a longer hospital stay of typically 3-5 days.

Nourishing Foods for Postpartum Recovery: Ayurvedic postpartum traditions recommend warm, easily digestible, nourishing foods. Panjiri and gondh laddoos are rich in nutrients and traditionally given to new mothers in North India. Methi dal helps with milk production and is warming. Moringa (drumstick leaves) sabzi is an exceptional source of calcium and iron. Ghee is anti-inflammatory and supports tissue healing. Warm soups and khichdi are easy to digest and hydrating.

Physical Recovery Timeline: The uterus returns to normal size by 6 weeks. Lochia stops at 4-6 weeks. Perineal stitches dissolve in 2-4 weeks. C-section incision heals externally in 6-8 weeks.

Warning Signs to Report Immediately: Heavy bleeding, foul-smelling vaginal discharge, fever above 38 degrees C, severe headache or visual changes, chest pain, difficulty breathing, or any redness or discharge from a C-section incision.

The 40-Day Tradition: Many Indian communities observe a 40-day period of rest where the new mother is given special care, food, oil massages, and protection from excessive responsibilities. Modern science supports this wisdom — lean on your family during this time without guilt.`,
    topic: 'Postpartum',
    readTime: '7 min',
    ageMin: 0,
    ageMax: 3,
    emoji: '🌸',
    tag: 'Postpartum',
    url: 'https://www.nhp.gov.in/disease/gynaecology-and-obstetrics/post-partum-recovery',
    audience: 'mother',
  },
  {
    id: 'a06',
    title: 'IAP Vaccination Schedule Explained',
    preview:
      "Vaccinations are one of the most powerful tools we have to protect children from serious, potentially life-threatening diseases. The Indian Academy of Pediatrics (IAP) updates its vaccination schedule annually based on the latest evidence. Understanding which vaccines your baby needs, when, and why can help you stay on track and feel confident in your decisions.",
    body: `Vaccines have saved more lives than almost any other medical intervention in history. For Indian families, following the IAP 2024 vaccination schedule ensures your child is protected against 15 or more serious diseases.

At Birth: BCG (single intradermal injection in the left upper arm) protects against serious forms of tuberculosis. OPV0 (two drops in the mouth) is the first dose in the polio eradication effort. Hep B (first dose) prevents liver disease and liver cancer.

At 6 Weeks: OPV1 + Pentavalent Dose 1 + Rotavirus Dose 1 + PCV Dose 1. Pentavalent covers Diphtheria, Pertussis, Tetanus, Hepatitis B, and Hib. Rotavirus vaccine protects against the leading cause of severe diarrhoea in young children. PCV protects against pneumonia, meningitis, and ear infections.

At 10 Weeks and 14 Weeks: The same combination is repeated as Doses 2 and 3. At 14 weeks, IPV (Injectable Polio Vaccine) is added for enhanced protection.

At 9 Months: Vitamin A first dose (1,00,000 IU) is critical for eye health and immunity. MR Dose 1 protects against measles (which can cause blindness and death) and rubella. JE Dose 1 is especially important in endemic states like UP, Bihar, Assam, Tamil Nadu, and Kerala.

At 15-18 Months: Varicella (Chickenpox) Dose 1, MR2 + JE2 (Boosters), OPV Booster + Pentavalent Booster + PCV Booster, and Vitamin A Dose 2.

At 4-6 Years: Td/DPT Booster for Tetanus, Diphtheria, and Pertussis.

Common Concerns: Mild fever and fussiness after vaccination is a normal immune response and can be managed with paracetamol as prescribed. Multiple vaccines given simultaneously is safe and effective. Claims linking vaccines to autism originate from a fraudulent and retracted study — decades of research involving millions of children have found no link.

Keep a dedicated vaccination record book and bring it to every paediatric visit.`,
    topic: 'Vaccination',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 60,
    emoji: '💉',
    tag: 'Vaccines',
    url: 'https://iapindia.org/vaccination-for-children/',
    audience: 'all',
  },
  {
    id: 'a07',
    title: 'Iron-Rich Foods for Breastfeeding Mothers',
    preview:
      "Anaemia is one of the most common nutritional deficiencies among Indian women, and breastfeeding increases the demand for iron even further. The good news is that India has a rich culinary tradition full of iron-rich ingredients — many of which have been used by new mothers for generations. Knowing which foods to prioritise can make a significant difference to your energy levels and milk quality.",
    body: `Iron deficiency anaemia affects nearly 50% of pregnant and postpartum Indian women, making iron nutrition one of the most important aspects of maternal health. Breastfeeding mothers need approximately 9-10 mg of iron per day.

Top Iron-Rich Plant-Based Foods for Indian Mothers: Sesame seeds (til) contain 14.5 mg per 100g. Dried fenugreek leaves (kasuri methi) contain 13.1 mg. Jaggery (gur) contains 11 mg. Horsegram (kulith) contains 6.7 mg. Rajma (kidney beans, cooked) contains 6.4 mg. Black-eyed peas (lobia) contain 5.1 mg. Moringa leaves are exceptional at 28 mg per 100g.

Animal-Based Iron (Haem Iron — better absorbed): Chicken liver contains 9 mg per 100g. Mutton (lean) contains 4 mg. Fish (sardines) contains 2.9 mg. Eggs contain 1.8 mg.

Traditional Iron-Boosting Foods: Gondh laddoos made with edible gum, whole wheat flour, jaggery, and ghee are traditionally eaten by new mothers in North India. Ragi (finger millet) contains 3.9 mg iron per 100g — make ragi dosa, mudde, or porridge. Sattu (roasted gram flour) is versatile and iron-rich. Panjiri, the traditional North Indian postpartum food made with whole wheat flour, ghee, nuts, seeds, and sugar, is excellent.

How to Maximise Iron Absorption: Pair iron-rich foods with Vitamin C — squeeze lemon over your dal, eat amla with meals, have tomatoes with spinach. Vitamin C can increase non-haem iron absorption by 3-6 times. Avoid tea and coffee for at least 1 hour before or after iron-rich meals. Cook in a cast iron kadhai, which adds a small but meaningful amount of dietary iron, especially to acidic dishes like tomato-based curries.

Under the Anemia Mukt Bharat programme, free Iron and Folic Acid (IFA) tablets are available at PHCs and Anganwadi centres. Don't skip these — food alone may not be sufficient to replenish iron stores depleted by pregnancy and delivery.

Signs of Iron Deficiency Anaemia: Persistent fatigue, pale skin, shortness of breath on mild exertion, frequent headaches, cold hands and feet, and pica (craving non-food items like chalk or mud). Your haemoglobin target should be above 11 g/dL.`,
    topic: 'Nutrition',
    readTime: '4 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🥗',
    tag: 'Nutrition',
    url: 'https://www.myupchar.com/en/diet-fitness/iron-rich-foods',
    audience: 'mother',
  },
  {
    id: 'a08',
    title: 'Managing Postpartum Anxiety',
    preview:
      "While postpartum depression is increasingly recognised in India, postpartum anxiety is equally common and often goes unidentified. The relentless worry about your baby's breathing, feeding, development, and safety — sometimes accompanied by a racing heart and sleep disturbances even when the baby is sleeping — can be both exhausting and frightening. You are not alone, and help is available.",
    body: `Postpartum anxiety (PPA) affects approximately 15-20% of new mothers — making it slightly more common than postpartum depression. Yet it is far less talked about, especially in Indian communities where there can be significant stigma around mental health.

What Is Postpartum Anxiety? Postpartum anxiety is a clinical anxiety disorder that begins during or after pregnancy. It is driven by significant hormonal shifts (particularly the dramatic drop in progesterone after delivery), sleep deprivation, the enormous responsibility of a new life, and in many cases, a personal or family history of anxiety.

It is NOT the same as normal new-parent worry. Almost all new parents worry — that is healthy and protective. PPA is when the worry becomes persistent, uncontrollable, disproportionate, and interferes with your ability to function and enjoy your baby.

Signs of Postpartum Anxiety: Constant, intrusive worrying that won't switch off; feeling that something terrible is about to happen to your baby; inability to sleep even when the baby is sleeping; muscle tension, jaw clenching, headaches; racing heart and chest tightness; irritability and feeling on edge; and intrusive thoughts (unwanted disturbing mental images — these are a symptom, NOT a desire).

Postpartum Anxiety in Indian Families: Indian mothers often face specific stressors including unsolicited contradictory advice from family members, pressure to breastfeed successfully, judgment about every parenting choice, cultural pressure to appear happy and capable, and financial stress.

What You Can Do Right Now: Tell someone you trust how you are feeling. Use the 5-4-3-2-1 grounding technique (name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste). Breathe: inhale for 4 counts, hold for 4, exhale for 6. Repeat 5 times.

Resources in India: iCall (Tata Institute of Social Sciences): 9152987821. Vandrevala Foundation: 1860-2662-345 (24/7). Fortis Mental Health Helpline: 8376804102.

Asking for help is not weakness. It is wisdom, and it is love.`,
    topic: 'Mental Health',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 6,
    emoji: '🧠',
    tag: 'Mental Health',
    url: 'https://nimhans.ac.in/mental-health-education/',
    audience: 'mother',
  },
  {
    id: 'a09',
    title: 'Gentle Yoga Poses for New Moms',
    preview:
      "Postpartum yoga is not about getting your pre-pregnancy body back — it is about reconnecting with your body, releasing tension, and building strength gently from the inside out. These poses are designed for the new mother, whether you delivered vaginally or by C-section, and can be begun as early as 6-8 weeks postpartum with medical clearance.",
    body: `Your body has just accomplished something extraordinary. The last thing it needs is aggressive exercise. What it does need is gentle movement, breath awareness, and gradual strengthening — all of which postpartum yoga provides beautifully.

Before You Begin: Get clearance from your doctor or midwife (typically at the 6-week postnatal check for vaginal delivery; 8-12 weeks for C-section). If you have diastasis recti (abdominal separation), avoid sit-ups, crunches, and intense core work — work with a women's health physiotherapist first.

Pelvic Floor Breathing: Lie on your back with knees bent. Inhale deeply into your belly, allowing it to rise. As you exhale, gently draw up through your pelvic floor (as if stopping urine flow) and draw your belly button toward your spine. Inhale and fully release. This reconnects you with your core and pelvic floor without strain.

Cat-Cow Stretch: Come to all fours with wrists under shoulders and knees under hips. On an inhale, drop your belly toward the floor and lift your head and tailbone (Cow). On an exhale, round your spine toward the ceiling and tuck your chin and tailbone (Cat). Repeat 8-10 times. Wonderful for spinal mobility and back tension from feeding and baby-carrying.

Child's Pose: Kneel on the floor, touch your big toes together, and sit back on your heels. Fold forward and extend your arms on the floor. Breathe deeply into your back for 60-90 seconds. One of the most restorative poses for a tired mother.

Bridge Pose (Modified): Lie on your back with knees bent, feet hip-width apart. On an exhale, engage your pelvic floor and slowly lift your hips, pressing through your feet. Hold for 5 breaths, then lower slowly. Strengthens the glutes and gently activates the deep core.

Legs Up the Wall: Sit sideways against a wall, then swing your legs up the wall as you lie back. Stay for 5-10 minutes. This pose reduces swelling in the feet and legs, calms the nervous system, and is deeply restorative.

Doing a simple 20-minute routine 3-4 times per week can make a profound difference to your energy, mood, and physical recovery. Remember — consistency and gentleness are far more valuable than intensity.`,
    topic: 'Yoga',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🧘',
    tag: 'Yoga',
    url: 'https://www.artofliving.org/in-en/yoga/yoga-for-women/yoga-after-delivery',
    audience: 'mother',
  },
  {
    id: 'a10',
    title: 'When to Introduce Water to Your Baby',
    preview:
      "One of the most common questions Indian mothers face — often from well-meaning family members — is when to start giving their baby water. The answer often surprises people: before 6 months, babies exclusively breastfed or formula-fed need no water at all. Giving water too early can cause more harm than good, including reducing milk intake and causing dangerous electrolyte imbalances.",
    body: `"Give the baby a little water — it's so hot today!" is advice that almost every Indian new mother hears within the first weeks. While it comes from a place of love, giving water too early can actually be harmful. Here is what the science says.

Before 6 Months — No Water Needed: Both the WHO and IAP are clear: babies under 6 months who are exclusively breastfed or formula-fed do not need any additional water, even in very hot weather.

Why? Breast milk is approximately 88% water — it provides full hydration even on hot days. Formula prepared correctly also provides complete hydration. A newborn's kidneys are immature and cannot handle excess water. Giving water fills the baby's tiny stomach without providing calories or nutrients, leading them to feed less. This can reduce breast milk supply (less demand means less production). In rare cases, excessive water intake in infants can cause hyponatremia (dangerously low sodium), which can cause seizures.

When Can You Start Giving Water? Around 6 months, when you begin introducing solid foods. Small sips of water (30-60 ml per day) can be offered in an open cup alongside meals. This helps develop cup-drinking skills, prevent constipation as solid foods are introduced, and help swallow solid foods.

How Much Water Does a Baby or Toddler Need? From birth to 6 months: zero ml (from breast milk or formula). At 6-12 months: approximately 120-180 ml per day from water and food. At 1-3 years: approximately 1,000-1,200 ml per day from all sources.

Signs of Adequate Hydration: 6 or more wet nappies per day, light yellow or clear urine, moist mouth and good skin turgor, and baby is alert and active.

A Word on Gripe Water and Honey Water: Traditional remedies like gripe water, honey water, or diluted cow's milk should not be given to babies under 12 months. Honey can contain Clostridium botulinum spores, which cause infant botulism. Stick to breast milk, formula, and from 6 months onward, plain water.`,
    topic: 'Feeding',
    readTime: '3 min',
    ageMin: 4,
    ageMax: 12,
    emoji: '💧',
    tag: 'Hydration',
    url: 'https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding',
    audience: 'all',
  },
  {
    id: 'a11',
    title: "Sleep Training: An Indian Family's Guide",
    preview:
      "Sleep training is one of the most hotly debated topics in parenting — and in Indian families, it can feel especially complicated. Multi-generational households, co-sleeping traditions, and differing philosophies between grandparents and new parents can make it difficult to find an approach that works. This guide presents the evidence on different sleep training methods and helps you find one that aligns with your family's values.",
    body: `Before we dive in, let's be clear: there is no single right way to manage infant sleep. What matters most is a consistent approach that works for your family and keeps your baby safe.

Is Sleep Training Necessary? No. Many children naturally transition to longer sleep stretches without any formal sleep training. Some families choose never to sleep train. The goal of sleep training is simply to help babies who struggle with independent sleep learn to fall asleep without excessive parental assistance.

When Can You Begin Sleep Training? Most paediatric sleep experts recommend starting no earlier than 4-6 months, when the baby is feeding well and gaining weight, there are no underlying medical conditions causing sleep disruption, and the baby has some capacity for self-soothing.

Common Sleep Training Methods:

Extinction (Cry It Out): Baby is placed in their cot drowsy but awake, and parents do not intervene until morning. Evidence consistently shows this is safe and effective and does not cause emotional or psychological harm. However, it can be very difficult for parents to implement and is culturally unfamiliar in most Indian families.

Ferber Method (Graduated Extinction): Baby is placed in cot awake; parents check in at increasing intervals (3 min, 5 min, 10 min) to briefly reassure the baby without picking them up. Typically takes 3-7 nights. A middle ground that many parents find manageable.

No Cry Sleep Solution: Parent gradually withdraws from the sleep process. Takes the longest but involves no crying. Appealing to Indian families who co-sleep and want a very gradual transition.

Sleep Training in Co-Sleeping or Joint Family Settings: Start with a floor mattress next to your bed before moving to a separate room. Use the No Cry or Chair method to maintain closeness while building independence. Discuss the plan with all caregivers in the home — inconsistency across adults will make sleep training harder.

Research Findings: Multiple large studies have found no evidence of increased stress hormones, attachment difficulties, or behavioural problems in children whose parents used extinction or graduated extinction methods. Short-term crying is not harmful.

Above all: be patient, be consistent, and be kind to yourself. Sleep deprivation is genuinely hard.`,
    topic: 'Sleep',
    readTime: '7 min',
    ageMin: 4,
    ageMax: 18,
    emoji: '🌙',
    tag: 'Sleep Training',
    url: 'https://www.healthychildren.org/English/healthy-living/sleep/Pages/Sleep-Training.aspx',
    audience: 'all',
  },
  {
    id: 'a12',
    title: 'Baby Massage: Benefits and Techniques',
    preview:
      "Baby massage is one of India's most beautiful and time-tested traditions. Grandmothers across the country have long known what science is now confirming: regular, gentle massage supports your baby's weight gain, sleep quality, immune function, and emotional security. It also deepens the bond between mother and baby in a way that few other activities can match.",
    body: `Baby massage has been practiced in India for centuries under the supervision of dais and grandmothers who passed down the knowledge through generations. Now, modern research supports what Indian tradition has long known — infant massage provides significant physiological and psychological benefits for both baby and mother.

Benefits for Baby: Massaged preterm babies gain weight significantly faster. Massage increases serotonin and melatonin, improving sleep quality. Abdominal massage helps relieve gas, colic, and constipation. Tactile stimulation supports brain development. Lower stress hormone levels are found in massaged infants. Massage is also effective at reducing the distress of vaccination injections.

Benefits for Mother: Reduces postpartum depression symptoms significantly. Increases oxytocin (bonding hormone). Builds maternal confidence in handling and understanding her baby.

The Right Oil for Indian Baby Massage: Sesame oil (til ka tel) is the most widely used — warming, nourishing, antifungal, and ideal for cooler months. Coconut oil is light, cooling, and antibacterial — excellent in South India and for summer months. Mustard oil is warming and excellent for cold winters in North India; check for skin sensitivity first. Almond oil is gentle, hypoallergenic, and rich in Vitamin E — excellent for delicate newborn skin.

When to Massage: The ideal time is 30-45 minutes after a feed, when baby is alert and content. Daily massage is recommended; 10-20 minutes is sufficient. Morning massage before bath is a wonderful routine, particularly in colder months. Avoid massage when baby is unwell, has skin infections, or has received vaccinations on the same day.

Step-by-Step Technique: Start with the legs (wrap your hand around the thigh and with gentle downward strokes, massage from thigh to foot). Move to the tummy (clockwise circles around the navel and the "I Love You" stroke). Then the chest and arms (open book stroke from centre outward). Finish with the back (stroke from neck to bottom) and face (gentle circles on the scalp, stroking outward from the forehead centre).

Baby massage is a language of love that requires no translation.`,
    topic: 'Baby Care',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🤲',
    tag: 'Baby Care',
    url: 'https://parentune.com/parent-article/baby-massage/1',
    audience: 'all',
  },
  {
    id: 'a13',
    title: 'Toddler Nutrition: Healthy Indian Meals',
    preview:
      "Feeding a toddler can feel like a battle some days — they may refuse foods they loved last week, insist on the same meal repeatedly, or throw an elaborate meal on the floor. This is completely normal toddler behaviour. The good news is that India's incredibly diverse cuisine is naturally well-suited to toddler nutrition, with the right adjustments for texture, salt, and spice levels.",
    body: `Toddlerhood (12-36 months) is a time of dramatically slower growth compared to the first year — and a child's appetite naturally reflects this. A toddler's stomach is approximately the size of their fist, so they need small, frequent meals packed with nutrients.

The Indian Toddler Plate: A well-balanced Indian toddler meal should include whole grains (roti, brown rice, daliya, ragi, bajra, jowar), legumes and lentils (dal makhani, moong dal, rajma, chana), dairy (dahi, paneer, milk, cheese), a variety of colourful vegetables (palak, gajar, lauki, tamatar, shimla mirch), fruits (banana, papaya, chikoo, mango, apple, guava), and healthy fats (ghee, sesame, coconut, nuts and seeds ground for under-3s).

Adapting Indian Food for Toddlers: Use minimal salt as toddler kidneys are still maturing — cook toddler portions separately or add salt only to adult portions. Mild spices like jeera, haldi, and hing are generally fine, but avoid very hot chillies and whole pepper for under-2s. At 12 months, food should be mashed but with some lumps. By 18 months, small soft pieces. By 24 months, most family foods with minor modifications. Ghee is a wonderful addition — 1/2 to 1 tsp per meal adds calories, fat-soluble vitamins, and flavour.

The Toddler Feeding Rules That Actually Work: Based on Ellyn Satter's Division of Responsibility — parents decide what is served, when, and where; child decides whether to eat and how much. This prevents power struggles and pressure feeding.

Handling Picky Eating: Neophobia (fear of new foods) peaks at around 18-24 months and is completely normal. Keep offering rejected foods without pressure — sometimes 15-20 exposures are needed before acceptance. Eat the food yourself enthusiastically, as toddlers learn by watching. Avoid bribing or rewarding with food.

Iron: Still Critical at This Age: Iron deficiency anaemia is common in Indian toddlers. Limit cow's milk to 350-400 ml per day and prioritise iron-rich foods like dal, ragi, green leafy vegetables, eggs, and meat.

Feeding a toddler is a long game. Keep mealtimes calm, positive, and pressure-free.`,
    topic: 'Nutrition',
    readTime: '6 min',
    ageMin: 12,
    ageMax: 36,
    emoji: '🍛',
    tag: 'Toddler',
    url: 'https://www.myupchar.com/en/tips/diet-chart-for-1-year-old-baby',
    audience: 'all',
  },
  {
    id: 'a14',
    title: 'Recognising Developmental Red Flags',
    preview:
      "Every child develops at their own pace, and developmental timelines are wide ranges, not precise schedules. However, certain signs — known as 'red flags' — warrant prompt evaluation by a paediatrician or developmental specialist. Early identification of developmental delays dramatically improves outcomes, because the infant and toddler brain is at its most plastic and responsive to intervention.",
    body: `Early intervention changes lives. Studies consistently show that children who receive developmental support early — before the age of 3, when the brain is most adaptable — have significantly better outcomes in language, cognition, motor skills, and social functioning.

Absolute Red Flags (Refer Immediately at Any Age): Any loss of language, social, or motor skills at any age is a serious red flag that requires urgent evaluation. Also: no response to their name by 12 months, and no eye contact or pointing by 12 months.

By 2 Months: Does not respond to loud sounds; does not watch objects moving in their field of vision; does not smile at people; cannot hold head up briefly during tummy time.

By 4 Months: Does not make sounds or coo; does not bring objects to their mouth; does not reach for or grasp objects.

By 6 Months: Does not laugh or squeal; shows no affection toward caregivers; cannot sit with some support; does not reach for objects nearby.

By 9 Months: Does not babble with consonant-vowel combinations; does not play peek-a-boo or pat-a-cake; does not pass objects between hands.

By 12 Months: No gestures — not waving, pointing, or shaking head; no babbling with varied consonant-vowel combinations; cannot stand even with support; shows no interest in other children or people.

By 18 Months: Does not walk independently; does not say at least 6 meaningful words; does not point to show interest in things; does not imitate actions or words.

By 24 Months: Does not use 2-word phrases; does not follow simple 2-step instructions; does not engage in simple pretend play.

By 36 Months: Cannot be understood by strangers at least 50% of the time; does not use 3-word sentences; does not play with other children.

Red Flags Specific to Autism Spectrum Disorder: Limited or absent eye contact beyond 3 months, no reciprocal smiling, not responding to name by 12 months, unusual sensory responses, and repetitive movements (hand-flapping, spinning, rocking).

What to Do If You Notice a Red Flag: Document your observations with specific dates (videos on your phone are very helpful). Contact your paediatrician and describe specific behaviours. Request a developmental assessment. Under the RBSK programme, free screening and referral for developmental delays is available through all government schools and Anganwadi centres. Trust your instinct as a parent — it is frequently correct.`,
    topic: 'Development',
    readTime: '5 min',
    ageMin: 6,
    ageMax: 36,
    emoji: '🔍',
    tag: 'Development',
    url: 'https://www.cdc.gov/ncbddd/actearly/concerned.html',
    audience: 'all',
  },
  {
    id: 'a15',
    title: 'Self-Care for the Overwhelmed Mother',
    preview:
      "You cannot pour from an empty cup — and yet, most Indian mothers are expected to pour ceaselessly for everyone around them while their own needs are quietly set aside. Self-care is not selfishness. It is the most important maintenance you can perform, because the whole family's wellbeing depends, more than almost anything else, on yours.",
    body: `If you are reading this with a sleeping baby on your chest, dark circles under your eyes, and a cup of cold tea beside you — this article is for you.

Motherhood in India often comes with an invisible weight beyond the baby: household expectations, family dynamics, judgement about every parenting choice, the pressure to appear happy and capable, and the near-complete erasure of your pre-motherhood identity. This is real, it is hard, and you deserve support.

Why Self-Care Is Not Selfish: When you are depleted — physically exhausted, emotionally wrung out, chronically understimulated or overstimulated — you cannot be your best self for your child. Chronic stress affects milk supply, your ability to respond sensitively to your baby's cues, your mental health, and your relationship with your partner. Taking care of yourself is not separate from taking care of your baby. It is part of the same continuum.

The 5-Minute Self-Care Menu (When You Have Almost No Time): Sit in a warm shower alone without rushing. Drink one cup of tea while it is still hot, sitting down. Step outside and feel sunlight on your face for 5 minutes. Write 3 sentences in a journal — anything at all. Do 5 deep belly breaths. Apply oil to your scalp and massage for 5 minutes.

The 20-Minute Self-Care Menu (Negotiate This Weekly): A nap, alone, uninterrupted. A short walk outside without the pram. A phone call with a friend who truly hears you. A gentle yoga session. Reading something for pleasure.

Reclaiming Your Identity: Identify one small thing that was yours before the baby — a hobby, a skill, a creative outlet — and protect even 15 minutes per week for it. Maintain at least one friendship that is not primarily about parenting.

Asking for Help Without Guilt: Indian mothers often feel that asking for help signals failure. In reality, human children evolved to be raised by multiple caregivers, not one sleep-deprived mother alone. You do not need to justify needing rest.

The Difference Between Coping and Thriving: If you find yourself permanently in survival mode — never finding joy, never feeling like yourself — please reach out to your doctor (postpartum depression and anxiety are medical conditions), a counsellor, your partner, or a mothers' support group.

You are more than a mother. You are a person who became a mother. Both things can be true at once. Take care of her.`,
    topic: 'Mental Health',
    readTime: '4 min',
    ageMin: 0,
    ageMax: 60,
    emoji: '💗',
    tag: 'Self-Care',
    url: 'https://www.nimhans.ac.in/mental-health-education/self-care/',
    audience: 'mother',
  },

  // ─── Pregnancy articles ───────────────────────────────────────────────────────

  {
    id: 'a16',
    title: 'First Trimester: What to Expect Week by Week',
    preview: 'The first 12 weeks of pregnancy bring rapid changes — from the first missed period to hearing your baby\'s heartbeat. This guide walks you through what\'s happening inside your body each week and what you should be doing.',
    body: `Weeks 1-4: Conception & Implantation\nYour pregnancy officially begins at conception. By week 4, the embryo has implanted in the uterine lining. A home pregnancy test now shows positive.\n\nWeeks 5-8: Major Development\nYour baby's heart begins beating around week 6. Arms, legs, and facial features start forming. This is when morning sickness typically begins. Book your first antenatal appointment.\n\nWeeks 9-12: Organ Formation\nAll major organs are now forming. The risk of miscarriage drops significantly after week 10. Your first ultrasound (NT scan) is recommended between weeks 11-14.\n\nKey Actions This Trimester:\n- Start folic acid (400 mcg/day) if you haven't already\n- Avoid alcohol, smoking, and raw/undercooked foods\n- Inform your doctor of all medications you're taking\n- Schedule blood tests: blood group, Hb, TSH, blood sugar, urine culture`,
    topic: 'Pregnancy',
    readTime: '6 min',
    ageMin: -9,
    ageMax: -6,
    emoji: '🌱',
    tag: 'First Trimester',
    imageUrl: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7e0be54?w=800&h=400&fit=crop&q=80',
    url: 'https://www.nhp.gov.in/healthlyliving/pregnancy-week-by-week',
    audience: 'mother',
  },
  {
    id: 'a17',
    title: 'Prenatal Yoga: Safe Poses for Every Trimester',
    preview: 'Gentle yoga during pregnancy can reduce back pain, ease anxiety, improve sleep, and prepare your body for labour. Here\'s what\'s safe at each stage — with specific guidance for Indian women.',
    body: `Benefits of Prenatal Yoga:\nStudies show prenatal yoga reduces anxiety by up to 36%, improves sleep quality, reduces lower back pain (affecting 70% of pregnant women), and may shorten labour.\n\nFirst Trimester (0-12 weeks):\n- Avoid deep twists and inversions\n- Safe poses: Cat-cow, Child's pose (legs wide), Supported bridge\n- Focus on breathing: Ujjayi pranayama calms nausea\n\nSecond Trimester (13-27 weeks):\n- Add gentle standing poses: Warrior 1 & 2 (wide stance)\n- Side-lying Savasana replaces lying flat\n- Squats with support help open the pelvis\n\nThird Trimester (28-40 weeks):\n- Focus on hip-openers: Butterfly pose, Pigeon pose with bolster\n- Avoid all lying-on-back poses (compresses the vena cava)\n- Walking meditation and gentle stretching\n\nAlways inform your instructor you are pregnant. Stop immediately if you feel pain, dizziness, or shortness of breath.`,
    topic: 'Yoga',
    readTime: '5 min',
    ageMin: -9,
    ageMax: -1,
    emoji: '🧘',
    tag: 'Exercise',
    imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=400&fit=crop&q=80',
    url: 'https://healthline.com/health/pregnancy/yoga',
    audience: 'mother',
  },
  {
    id: 'a18',
    title: 'What to Eat During Pregnancy: An Indian Diet Guide',
    preview: 'Good nutrition during pregnancy doesn\'t require expensive supplements or exotic superfoods. India\'s traditional kitchen already has everything your growing baby needs — you just need to know what to eat more of.',
    body: `Key Nutrients & Indian Food Sources:\n\nFolic Acid: Critical in first trimester for neural tube development. Sources: Methi (fenugreek), spinach, moong dal, kidney beans, fortified atta.\n\nIron: Requirements double in pregnancy (27 mg/day). Sources: Rajma, chana, green leafy vegetables. Eat with Vitamin C (lemon, amla) to improve absorption. Avoid tea/coffee within 1 hour of iron-rich meals.\n\nCalcium: Essential for baby's bone development. Sources: Milk, curd, paneer, ragi, sesame seeds. If lactose intolerant, ragi is an excellent alternative.\n\nProtein: Requirements increase to 75-100g/day. Sources: Dal, legumes, eggs, paneer, soya, chicken (if non-vegetarian).\n\nDHA (Omega-3): Critical for brain development. Sources: Fatty fish (if eaten), flaxseeds, walnuts, mustard oil.\n\nFoods to Avoid During Pregnancy:\n- Raw/undercooked eggs and meat\n- Unpasteurised dairy\n- High-mercury fish (shark, swordfish, tuna in large amounts)\n- Papaya (raw/semi-ripe) — contains latex that can trigger contractions\n- Pineapple in large quantities (first trimester)\n- Excess vitamin A supplements`,
    topic: 'Nutrition',
    readTime: '7 min',
    ageMin: -9,
    ageMax: -1,
    emoji: '🥗',
    tag: 'Pregnancy Diet',
    imageUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/pdf/maternal-nutrition.pdf',
    audience: 'mother',
  },
  {
    id: 'a19',
    title: 'Managing Morning Sickness: What Actually Works',
    preview: 'Up to 80% of pregnant women experience nausea and vomiting — and despite the name, it can strike at any time of day. Here are evidence-based strategies that actually help, including Indian home remedies with scientific backing.',
    body: `Why It Happens:\nMorning sickness is caused by rapidly rising hCG and oestrogen levels. It typically peaks around weeks 8-10 and resolves for most women by week 14. About 1-3% develop Hyperemesis Gravidarum (HG) — severe, persistent vomiting requiring medical treatment.\n\nProven Strategies:\n\nGinger: Multiple studies confirm ginger reduces nausea severity. Try ginger tea, ginger candy, or ginger in your cooking. Fresh ginger water is a traditional Indian remedy that works.\n\nSmall, Frequent Meals: An empty stomach worsens nausea. Eat every 2 hours — crackers, plain khakhra, or dry toast keep something in your stomach.\n\nVitamin B6: 25mg three times daily has been shown in studies to reduce nausea. Discuss with your doctor before supplementing.\n\nAccupressure P6 Point: Applying pressure to the P6 point on your wrist (three finger-widths from your wrist crease, between the two central tendons) has evidence for reducing nausea — you can buy travel sickness bands.\n\nCold Foods: Warm food smells trigger nausea more than cold foods. Try cold curd rice, cold idli, or room-temperature snacks.\n\nWhen to See a Doctor:\nSeek medical attention if you cannot keep any fluids down for 24 hours, if you are losing weight, or if you see blood in your vomit.`,
    topic: 'Pregnancy',
    readTime: '5 min',
    ageMin: -9,
    ageMax: -6,
    emoji: '🫚',
    tag: 'Nausea Relief',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=400&fit=crop&q=80',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4818021/',
    audience: 'mother',
  },
  {
    id: 'a20',
    title: 'Third Trimester: Preparing for Labour & Delivery',
    preview: 'The final weeks of pregnancy bring a mix of excitement and anxiety. This guide covers what to expect physically, how to prepare your hospital bag, and signs of labour to watch for.',
    body: `Physical Changes in the Third Trimester:\n- Braxton Hicks contractions (practice contractions — irregular, mild)\n- Increased pelvic pressure as baby engages ("dropping")\n- Shortness of breath as the uterus presses up on your diaphragm\n- Swollen ankles and feet — elevate feet and reduce salt\n- Frequent urination as baby presses on bladder\n- Sleep difficulty — try a pregnancy pillow (left side is best for circulation)\n\nYour Hospital Bag Checklist:\nFor you: Loose hospital-approved gown, extra underwear (4-5), maternity pads, toiletries, phone charger, healthy snacks, copy of birth plan.\nFor baby: Onesies (2-3), baby cap, mittens, socks, a soft blanket, infant car seat.\n\nSigns of Labour:\n- Regular contractions that are getting closer together and stronger\n- Water breaking (clear fluid from vagina)\n- Bloody show (blood-tinged mucus discharge — mucus plug loss)\n\nWhen to Go to Hospital:\nFollow the 5-1-1 rule: contractions every 5 minutes, lasting 1 minute each, for 1 hour. But go immediately if your water breaks, if you notice decreased fetal movement, or if you have heavy bleeding.`,
    topic: 'Pregnancy',
    readTime: '6 min',
    ageMin: -3,
    ageMax: -1,
    emoji: '🏥',
    tag: 'Labour Prep',
    imageUrl: 'https://images.unsplash.com/photo-1490013616936-7190dde14f80?w=800&h=400&fit=crop&q=80',
    url: 'https://www.who.int/news-room/fact-sheets/detail/maternal-mortality',
    audience: 'mother',
  },

  // ─── Newborn care ─────────────────────────────────────────────────────────────

  {
    id: 'a21',
    title: 'Skin-to-Skin Contact: The Science of Kangaroo Care',
    preview: 'Placing your newborn on your bare chest immediately after birth is one of the most powerful things you can do. The research on skin-to-skin contact — also called Kangaroo Care — is remarkable.',
    body: `What Is Skin-to-Skin Care?\nKangaroo Care (KMC) involves holding your baby — wearing only a nappy — directly against your bare chest. It can begin immediately after birth (or as soon as medically safe) and continue for as long as you both wish.\n\nProven Benefits:\n- Stabilises baby's heart rate, breathing, and temperature\n- Doubles breastfeeding rates at 4 weeks\n- Reduces cortisol (stress hormone) in both baby and mother\n- Promotes attachment and bonding\n- Shown to reduce pain during procedures (like heel prick tests)\n- Preterm babies in KMC gain weight faster and leave hospital sooner\n\nHow to Practice It:\n- Choose a comfortable reclining chair or hospital bed\n- Remove your shirt and bra; place baby on your chest with their ear over your heart\n- Cover baby's back with a blanket\n- Both of you can remain this way for 1-3 hours or more\n- Fathers can also do skin-to-skin — it has the same benefits\n\nFor Preterm Babies:\nThe WHO now recommends immediate KMC for premature babies as standard care. If your baby is in the NICU, ask staff about kangaroo care sessions.`,
    topic: 'Baby Care',
    readTime: '4 min',
    ageMin: 0,
    ageMax: 3,
    emoji: '🤱',
    tag: 'Newborn',
    imageUrl: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=800&h=400&fit=crop&q=80',
    url: 'https://www.who.int/news-room/fact-sheets/detail/kangaroo-mother-care',
    audience: 'all',
  },
  {
    id: 'a22',
    title: "Bathing Your Newborn: A Step-by-Step Guide",
    preview: "Bathing a slippery, crying newborn can feel terrifying the first few times. Here's a clear, step-by-step guide — including traditional Indian practices like oil massage — to make bath time calm and enjoyable.",
    body: `When to Start Baths:\nThe WHO recommends delaying the first bath for at least 24 hours (ideally 48-72 hours) after birth. This preserves the vernix caseosa — the white waxy coating that protects newborn skin and regulates temperature.\n\nHow Often:\nNewborns don't need a full bath more than 2-3 times a week. Daily top-and-tail cleaning (face, neck folds, nappy area) is sufficient in between.\n\nStep-by-Step Bath Guide:\n1. Gather everything before undressing baby: warm water (test with elbow — should feel comfortably warm, not hot), soft towel, clean nappy, fresh clothes, cotton swabs.\n2. Keep the room warm (at least 24°C).\n3. Use a baby bath or a clean wash basin. Support baby's head and neck firmly throughout.\n4. Clean face first with a soft cloth and plain water.\n5. Wash hair gently last (hair dries fastest, so do it last to avoid chilling).\n6. Dry thoroughly in all skin folds — neck, armpits, groin.\n\nOil Massage:\nThe Indian tradition of daily oil massage (maalish) before bathing has evidence behind it. A warm oil massage improves weight gain in preterm babies, promotes deep sleep, and strengthens the mother-baby bond. Use coconut oil, sesame oil, or almond oil. Warm slightly before use.`,
    topic: 'Baby Care',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 3,
    emoji: '🛁',
    tag: 'Newborn Care',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/newborn-care/',
    audience: 'all',
  },
  {
    id: 'a23',
    title: "Decoding Your Baby's Cries",
    preview: "Every cry means something different — hunger, tiredness, overstimulation, pain, or simply needing closeness. Learning to distinguish these cries is one of the most valuable skills of early parenthood.",
    body: `The Five Main Cries:\n\n1. Hunger cry: Rhythmic, repetitive, low-pitched. Baby may turn head side to side and suck on hands. Feed soon — hunger escalates quickly in newborns.\n\n2. Tired cry: Whining, on-and-off fussing. Often accompanied by eye-rubbing, yawning, or looking away from stimulation. Respond with dark, quiet environment and gentle rocking.\n\n3. Overstimulated cry: Fussy, arching back, turning head away. Common after busy social gatherings or when too many people are handling the baby. Move to a quiet, dimly lit room.\n\n4. Pain cry: Sudden, sharp, intense — often a single high-pitched scream followed by silence, then another cry. Check for a hair tourniquet (hair wound tightly around a finger or toe), nappy rash, or signs of colic.\n\n5. Colicky cry: High-pitched, inconsolable, happening at the same time each day (usually evening). Baby may draw legs up to tummy. Typically resolves by 3-4 months.\n\nWhat to Do First: Check the basics in order — is baby hungry, cold, hot, does the nappy need changing, is something pinching their skin? Then try gentle movement, skin-to-skin, or white noise. You cannot spoil a newborn by responding to their cries — responding builds trust and security.`,
    topic: 'Baby Care',
    readTime: '4 min',
    ageMin: 0,
    ageMax: 4,
    emoji: '😢',
    tag: 'Newborn',
    imageUrl: 'https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?w=800&h=400&fit=crop&q=80',
    url: 'https://www.healthline.com/health/parenting/baby-crying',
    audience: 'all',
  },
  {
    id: 'a24',
    title: 'Umbilical Cord Care: Do\'s and Don\'ts',
    preview: 'The umbilical cord stump typically falls off between 7-21 days after birth. Proper care prevents infection — and knowing what is normal vs. concerning gives you peace of mind.',
    body: `Normal Appearance: The stump starts as yellowish-green and gradually turns yellow, then brown, then black as it dries. A small amount of blood when it falls off is normal.\n\nDo's:\n- Keep the stump clean and dry\n- Fold the front of the nappy below the stump to allow air circulation\n- Clean the base with a cotton bud dampened with normal saline (or plain water) if there is discharge\n- Allow the stump to fall off naturally — do not pull or twist it\n\nDon'ts:\n- Do NOT apply mustard oil, coconut oil, turmeric paste, or cow dung to the stump (traditional practices — all increase infection risk)\n- Do NOT submerge baby in water (sponge baths only until the stump falls off)\n- Do NOT cover with a bandage\n- Do NOT try to remove the stump yourself, even if it appears to be hanging by a thread\n\nSigns of Infection (see doctor immediately):\n- Redness spreading to the surrounding skin\n- Yellow or foul-smelling pus (not just watery discharge)\n- Baby has fever (temperature above 38°C in a newborn is always an emergency)\n- Baby appears unwell — not feeding, lethargic`,
    topic: 'Baby Care',
    readTime: '3 min',
    ageMin: 0,
    ageMax: 1,
    emoji: '🏥',
    tag: 'Newborn Safety',
    imageUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/newborn-care/',
    audience: 'all',
  },

  // ─── Breastfeeding & feeding ──────────────────────────────────────────────────

  {
    id: 'a25',
    title: 'Breastfeeding Positions: Finding What Works for You',
    preview: 'There is no single "correct" way to breastfeed — the right position is the one that is comfortable for you and effective for your baby. Here are four proven positions with tips for getting a good latch.',
    body: `Why Position Matters: A correct position ensures a deep latch, which prevents nipple pain, ensures baby gets enough milk, and protects your supply. Poor positioning is the most common cause of breastfeeding difficulties.\n\n4 Key Positions:\n\n1. Cradle Hold: Baby's head rests in the crook of your arm, facing your breast. Best for: Older babies (1+ months) with good head control.\n\n2. Cross-Cradle Hold: Support baby's head with the opposite hand from the feeding breast. Offers more control over head position. Best for: Newborns, babies learning to latch.\n\n3. Football Hold: Baby's body is tucked under your arm, facing upward. Your hand supports their head. Best for: After C-section (no pressure on abdomen), large breasts, twins, premature babies.\n\n4. Side-Lying: Lie on your side, baby facing you. Best for: Nighttime feeds, post-surgery recovery, painful nipples.\n\nSigns of a Good Latch:\n- Baby's mouth covers a large portion of areola (not just the nipple)\n- Baby's lips are flanged outward (not tucked in)\n- You hear rhythmic swallowing\n- No nipple pain (some initial discomfort is normal, persistent pain is not)\n- Baby's chin touches your breast`,
    topic: 'Feeding',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🤱',
    tag: 'Breastfeeding',
    imageUrl: 'https://images.unsplash.com/photo-1531983412531-1f49a365ffed?w=800&h=400&fit=crop&q=80',
    url: 'https://www.who.int/health-topics/breastfeeding',
    audience: 'mother',
  },
  {
    id: 'a26',
    title: 'Increasing Your Milk Supply: Evidence vs. Myths',
    preview: 'Almost every breastfeeding mother worries about milk supply at some point. Here\'s what the science says actually works — and what popular Indian remedies have evidence behind them.',
    body: `How Supply Really Works: Milk production is driven by demand. The more frequently and thoroughly your baby removes milk, the more milk your body makes. Most "low supply" concerns are actually perceived low supply — your body is producing enough, but you don't feel full or see big volumes when pumping.\n\nWhat Actually Increases Supply:\n1. Feed more often — aim for 8-12 times in 24 hours\n2. Ensure full breast drainage — switch sides and finish each breast thoroughly\n3. Skin-to-skin contact increases prolactin (the milk-making hormone)\n4. Adequate hydration and calorie intake (you need ~500 extra calories while breastfeeding)\n5. Rest — stress and exhaustion reduce milk supply\n\nIndian Galactagogues with Evidence:\n- Fenugreek (methi): Probably the best-studied galactagogue. 2-3 cups of methi tea per day or methi ladoos are traditional and have some evidence.\n- Jeera (cumin) water: Traditional and widely used; limited but positive evidence.\n- Satavari (Asparagus racemosus): An Ayurvedic herb with some clinical evidence for improving supply.\n\nMyths Without Evidence:\n- Drinking more milk does not increase milk supply\n- Breast size has nothing to do with supply\n- Formula top-ups reduce supply (formula reduces demand = reduces supply)`,
    topic: 'Feeding',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🍼',
    tag: 'Breastfeeding',
    imageUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&h=400&fit=crop&q=80',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2553152/',
    audience: 'mother',
  },
  {
    id: 'a27',
    title: 'Formula Feeding: A Complete Guide for Indian Mothers',
    preview: 'Whether you choose formula by necessity or by choice, it is possible to give your baby excellent nutrition. Here\'s everything you need to know about formula selection, preparation, and feeding safely.',
    body: `Choosing a Formula: For healthy term babies, any WHO Codex-compliant Stage 1 infant formula is appropriate. No formula is proven superior for healthy babies — expensive doesn't necessarily mean better. Common options available in India: Similac, Nan Pro, Aptamil, Dexolac, Enfamil.\n\nPreparing Formula Safely:\n1. Wash hands thoroughly with soap\n2. Use water that has been boiled to 70°C (not fully cooled — this kills bacteria)\n3. Measure formula exactly — do not add extra powder\n4. Cool rapidly under cool running water before feeding\n5. Use immediately — discard any leftover in the bottle\n6. Never store made-up formula for more than 2 hours at room temperature\n\nFeeding Signs:\nFeed on demand — formula-fed babies typically feed every 3-4 hours. Look for hunger cues (rooting, sucking on hands) rather than watching the clock. Do not force baby to finish a bottle.\n\nSterilising Equipment: Sterilise bottles, teats, and rings until baby is 12 months old. Options: boiling for 10 minutes, steam steriliser, or microwave steriliser. Air-dry on a clean rack — do not towel dry (transfers bacteria).\n\nFlexible Feeding: Some mothers combine breastfeeding and formula (mixed feeding). This is completely valid — any breastmilk is beneficial.`,
    topic: 'Feeding',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🍼',
    tag: 'Formula',
    imageUrl: 'https://images.unsplash.com/photo-1503449077543-a8bb7eb1d823?w=800&h=400&fit=crop&q=80',
    url: 'https://www.who.int/publications/i/item/9789240018938',
    audience: 'mother',
  },

  // ─── Baby development ─────────────────────────────────────────────────────────

  {
    id: 'a28',
    title: 'Tummy Time: Why It Matters and How to Do It',
    preview: 'Tummy time is one of the most important activities for your baby\'s physical development — and many parents skip it because babies initially protest. Here\'s how to start gently and make it enjoyable.',
    body: `Why Tummy Time Is Essential:\nSince the "Back to Sleep" campaign in the 1990s (which successfully reduced SIDS rates), babies spend less time on their tummies. This means tummy time must be a conscious, daily practice. It:\n- Strengthens neck, shoulder, arm, and trunk muscles\n- Prevents flat head syndrome (positional plagiocephaly)\n- Is essential groundwork for rolling, sitting, and crawling\n- Develops visual and vestibular systems\n\nWhen to Start:\nBegin from Day 1 — even in the first week. Do 2-3 sessions of 3-5 minutes daily. By 3-4 months, aim for 20-30 minutes total across the day.\n\nHow to Make It Easier:\n- Tummy time on your chest (skin-to-skin): This is the gentlest introduction\n- Roll a muslin cloth and place it under baby's chest and shoulders for support\n- Get down to eye level with your baby — your face is the best incentive\n- Use a tummy time mat with mirrors and high-contrast patterns\n- Do it after a nappy change, not immediately after feeding\n\nMilestones to Watch:\n- 1 month: Lifts head briefly (1-2 seconds)\n- 2 months: Lifts head 45°, holds for a few seconds\n- 4 months: Lifts head and chest 90°, props on forearms\n- 6 months: Props on outstretched arms, may rock`,
    topic: 'Development',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 6,
    emoji: '👶',
    tag: 'Motor Skills',
    imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=400&fit=crop&q=80',
    url: 'https://healthline.com/health/parenting/tummy-time',
    audience: 'all',
  },
  {
    id: 'a29',
    title: "Talking to Your Baby: Building Language from Birth",
    preview: "Every time you talk, sing, or read to your baby — even before they can respond — you are building the neural pathways for language. The first three years are a critical window.",
    body: `The Critical Window: Language development begins in the womb (babies can recognise their mother's voice at birth) and is most rapid in the first three years. Research shows that children who heard more words in infancy had larger vocabularies, stronger reading skills, and higher academic achievement.\n\nWhat Babies Hear and Learn:\n- Newborns: Respond preferentially to their mother's voice and familiar languages\n- 2-3 months: Begin cooing and making vowel sounds\n- 6-8 months: Babbling begins (ba, da, ma)\n- 10-12 months: First words emerge\n- 18-24 months: Vocabulary explosion (50+ words, two-word phrases)\n\nHow to Talk to Your Baby:\n1. Narrate your day: "Now we're washing your hands. The water is warm, isn't it?"\n2. Use Parentese (motherese): Exaggerated intonation, slower speech, higher pitch — babies prefer and learn from it\n3. Respond to their vocalisations — have a "conversation" even with a cooing baby\n4. Read aloud — picture books from birth; point to objects and name them\n5. Sing songs in your mother tongue — multilingual exposure is an advantage, not a confusion\n\nIn India: Talking to babies in your native language first is developmentally ideal. Bilingualism is a cognitive advantage.`,
    topic: 'Development',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 24,
    emoji: '💬',
    tag: 'Language',
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=400&fit=crop&q=80',
    url: 'https://www.unicef.org/parenting/child-development/early-childhood-development',
    audience: 'all',
  },
  {
    id: 'a30',
    title: 'Sensory Play: Activities for Each Stage',
    preview: 'Babies learn through their senses — touch, taste, smell, sight, sound, and movement. Sensory play builds neural connections faster than any flashcard. Here are simple, affordable ideas using things at home.',
    body: `Why Sensory Play Matters:\nEvery new sensory experience creates new neural pathways in your baby's developing brain. Research shows sensory-rich environments lead to more curious, adaptable, and emotionally regulated children.\n\nActivities by Age:\n\n0-3 Months:\n- Black & white patterns: Print high-contrast images (stripes, checkerboard). Newborn vision is limited to high-contrast shapes.\n- Gentle massage: Different textures (soft cloth, ribbed flannel)\n- Mobiles with slow movement (ceiling or crib)\n- Music: Classical, folk, instruments\n\n3-6 Months:\n- Crinkle toys, squeaky toys, rattles\n- Mirror play: Babies this age love faces, including their own\n- Water play during bath — splash, pour cups of water\n- Texture exploration: Velvet, sandpaper, mesh — supervised\n\n6-12 Months:\n- Heuristic play: Give a basket of household objects (wooden spoon, measuring cups, metal bowl, fabric scraps)\n- Finger foods: The texture of soft foods is sensory play + feeding combined\n- Sand, mud, grass: Outdoor textures are invaluable\n- Peek-a-boo: Teaches object permanence\n\n12-24 Months:\n- Playdough (home-made atta-dough with food colouring)\n- Water table or large tub with toys\n- Painting with fingers or vegetables (safe non-toxic paint)`,
    topic: 'Development',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 24,
    emoji: '🎨',
    tag: 'Play & Learning',
    imageUrl: 'https://images.unsplash.com/photo-1540479859555-17af45c78602?w=800&h=400&fit=crop&q=80',
    url: 'https://www.unicef.org/parenting/child-development',
    audience: 'all',
  },
  {
    id: 'a31',
    title: 'Baby Massage: A Guide to Traditional Malish',
    preview: 'Baby massage — or malish — is one of the oldest traditions in Indian parenting. Modern science has now confirmed what generations of Indian mothers knew: regular massage has profound benefits for your baby.',
    body: `Evidence-Based Benefits:\n- Studies show massage reduces colic, improves sleep duration, and promotes weight gain — especially in preterm babies\n- Increases the release of oxytocin (bonding hormone) in both baby and parent\n- Reduces cortisol (stress hormone)\n- Improves proprioception (body awareness) and motor development\n\nChoosing the Right Oil:\nFor term babies: Coconut oil is the most studied — it is anti-fungal, anti-bacterial, and well-absorbed. Sesame oil (til oil) is traditional in South India and has excellent warming properties. Mustard oil: Popular in North India, but evidence shows it can damage the skin barrier in newborns — use with caution or avoid before 1 month.\n\nThe Malish Technique:\n1. Choose a warm, draught-free room\n2. Warm the oil by rubbing between your palms\n3. Start with legs: Long strokes from thigh to foot\n4. Move to arms: From shoulder to fingers\n5. Abdomen: Gentle circular strokes clockwise (follows direction of digestion)\n6. Back: Long strokes from neck to buttocks\n7. Never massage the face, fontanelle (soft spot), or umbilical cord stump\n\nTiming: Before a bath, at least 30 minutes after feeding. Daily for the first year.`,
    topic: 'Baby Care',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '💆',
    tag: 'Massage',
    imageUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&h=400&fit=crop&q=80',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10742357/',
    audience: 'all',
  },

  // ─── Postpartum mother ────────────────────────────────────────────────────────

  {
    id: 'a32',
    title: 'Postpartum Recovery: Your Body After Birth',
    preview: 'Labour and delivery leave your body significantly changed. Understanding what is normal in the weeks after birth — and what needs medical attention — helps you recover confidently.',
    body: `Week 1 After Birth:\n- Lochia (postpartum bleeding): Heavy and red at first, tapering over 4-6 weeks. If soaking a pad in under an hour, or passing large clots, contact your doctor.\n- Uterine contractions: Especially during breastfeeding. Normal and actually speed healing.\n- Perineal soreness (if vaginal birth): Ice packs, sitz baths, and Epsom salts help.\n- C-section care: Wound must remain dry. Avoid lifting anything heavier than your baby for 6 weeks.\n\nWeeks 2-6:\n- Fatigue is the biggest challenge — sleep deprivation at this scale is genuinely difficult.\n- Night sweats are common as your body releases excess fluid from pregnancy.\n- Hair loss: Postpartum hair loss peaks at 3-4 months (telogen effluvium) — normal, not a sign of deficiency.\n\nWhen to Seek Help Urgently:\n- Fever above 38°C\n- Foul-smelling vaginal discharge\n- Breast pain with redness (mastitis)\n- Signs of clot: calf pain or swelling (DVT risk is elevated postpartum)\n- Signs of postpartum preeclampsia: severe headache, vision changes, upper abdominal pain\n\nThe 6-Week Check:\nDo not skip your 6-week postnatal check. Beyond physical recovery, this is your opportunity to discuss contraception, mental health, and return to intimacy.`,
    topic: 'Postpartum',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 3,
    emoji: '💪',
    tag: 'Recovery',
    imageUrl: 'https://images.unsplash.com/photo-1578496780895-4b5f3a748253?w=800&h=400&fit=crop&q=80',
    url: 'https://www.who.int/publications/i/item/9789240045989',
    audience: 'mother',
  },
  {
    id: 'a33',
    title: 'Postpartum Depression: Recognising It and Getting Help',
    preview: 'The "baby blues" are common and temporary. But postpartum depression — which affects up to 1 in 5 Indian mothers — is different and requires support. Here\'s how to tell the difference and what to do.',
    body: `Baby Blues vs Postpartum Depression:\n\nBaby Blues (Up to 80% of mothers): Occur in first 2 weeks. Tearfulness, mood swings, anxiety, sleep difficulty. Caused by rapid hormonal changes after birth. Self-resolve within 2 weeks with rest and support. Normal and not a medical condition.\n\nPostpartum Depression (PPD) — 15-20% of mothers: Persists beyond 2 weeks or starts later (up to 12 months). Symptoms: Persistent sadness, inability to feel joy, detachment from baby or feelings of being a "bad mother", inability to sleep even when baby sleeps, anxiety, panic attacks, intrusive thoughts, difficulty concentrating.\n\nIn India: PPD is significantly underdiagnosed due to stigma, the expectation that new mothers should be joyful, and lack of awareness. Many women suffer in silence for months.\n\nWhat Helps:\n- Talking to your doctor (GP, obstetrician, or psychiatrist) — PPD is highly treatable\n- Therapy: CBT (Cognitive Behavioral Therapy) is effective\n- Medication: Antidepressants safe for breastfeeding are available\n- Social support: Share your feelings honestly with your partner, family, or a trusted friend\n- The iCall helpline (022 25521111) offers free mental health counselling\n\nIf you are having thoughts of harming yourself or your baby: This is a psychiatric emergency. Call iCall (022 25521111) or go to the nearest emergency department.`,
    topic: 'Mental Health',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '💙',
    tag: 'Postpartum Mental Health',
    imageUrl: 'https://images.unsplash.com/photo-1544367577-be28eca837f3?w=800&h=400&fit=crop&q=80',
    url: 'https://nimhans.ac.in/mental-health-education/',
    audience: 'mother',
  },
  {
    id: 'a34',
    title: 'Nutrition for New Mothers: What to Eat After Birth',
    preview: 'The months after birth are nutritionally demanding — especially if you are breastfeeding. Traditional Indian postpartum diets (like the Punjabi panjiri or South Indian kanji) are scientifically sound. Here\'s why.',
    body: `Key Nutritional Needs Postpartum:\n\nCalories: Breastfeeding requires an extra 400-500 calories per day. Do not restrict calories — this suppresses milk supply and slows recovery.\n\nIron: Significant iron is lost during delivery (especially heavy bleeds or C-section). Sources: Rajma, chana, leafy greens, liver (if non-vegetarian), iron-fortified cereals. Take with Vitamin C.\n\nCalcium: Your body prioritises calcium for breastmilk, drawing it from your bones if diet is inadequate. Continue taking 1000mg calcium daily. Sources: Milk, curd, paneer, ragi, sesame (til).\n\nProtein: Essential for healing and milk production. Aim for 80-100g per day. Sources: Dal, legumes, eggs, paneer, poultry.\n\nTurmeric: Anti-inflammatory. The tradition of haldi milk postpartum is genuinely beneficial for wound healing and immune function.\n\nWhy Traditional Indian Postpartum Foods Work:\n- Panjiri (North India): Made with atta, ghee, dry fruits, gond (edible gum). High in calories, iron, and healthy fats.\n- Jeera-ajwain-methi water: Aids digestion, reduces bloating, may support milk supply.\n- Daliya (broken wheat) porridge: Easily digestible complex carbohydrates for sustained energy.\n- Urad dal: High in protein and iron, traditionally given to breastfeeding mothers.\n\nStay well hydrated — drink water and warm fluids throughout the day, especially before and after feeds.`,
    topic: 'Nutrition',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 6,
    emoji: '🍲',
    tag: 'Postpartum Nutrition',
    imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/pdf/maternal-nutrition.pdf',
    audience: 'mother',
  },
  {
    id: 'a35',
    title: 'Pelvic Floor Recovery After Birth',
    preview: 'Your pelvic floor muscles support the bladder, uterus, and bowel. They go through enormous stress during pregnancy and birth. Strengthening them reduces leakage, prolapse, and improves sexual wellbeing.',
    body: `Why the Pelvic Floor Weakens:\nThe pelvic floor is a hammock of muscles at the base of the pelvis. During pregnancy, the weight of the uterus (which grows from 70g to 1kg+) stretches and strains these muscles. During vaginal delivery, they can be stretched up to 3x their normal length.\n\nSymptoms of Pelvic Floor Dysfunction:\n- Stress incontinence: Leaking urine when you cough, sneeze, laugh, or jump\n- Urgency incontinence: Sudden, urgent need to urinate\n- Pelvic organ prolapse: Feeling of heaviness or bulging in the vagina\n- Pain during intercourse\n\nThese are common but not normal — they are treatable.\n\nKegel Exercises:\n1. Identify the right muscles: Imagine you are stopping the flow of urine mid-stream (don't actually do this repeatedly — it's just for identification).\n2. Contract these muscles for 5-10 seconds\n3. Relax for the same duration\n4. Aim for 3 sets of 10 repetitions, 3 times daily\n5. Breathe normally throughout — don't hold your breath\n6. Can be done sitting, lying, or standing\n\nWhen to see a Pelvic Floor Physiotherapist:\nIf you have significant leakage, pain, or prolapse symptoms, see a pelvic floor physio. They can assess internal muscle function and give a tailored programme. This is available in major Indian cities and becoming increasingly accessible.`,
    topic: 'Postpartum',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 6,
    emoji: '💪',
    tag: 'Pelvic Floor',
    imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=400&fit=crop&q=80',
    url: 'https://www.physiofirst.org.uk/patients/pelvic-floor',
    audience: 'mother',
  },

  // ─── Sleep ────────────────────────────────────────────────────────────────────

  {
    id: 'a36',
    title: 'Sleep Training: A Clear Guide to the Main Methods',
    preview: 'Sleep training is one of the most debated topics in parenting. The truth: multiple methods work, the "best" depends on your family values, and no approach is right or wrong. Here\'s an honest comparison.',
    body: `When to Consider Sleep Training:\nMost experts suggest waiting until at least 4-6 months, when babies can physiologically sleep for longer stretches and are neurologically capable of self-soothing.\n\nPopular Methods:\n\n1. Cry It Out (Extinction) — Ferber, Weissbluth:\nPut baby in crib awake, leave the room, and don't return until a set time (or morning). Studies show this is effective and does not cause lasting psychological harm when done appropriately at the right age.\n\n2. Modified CIO (Ferber Method / Checking):\nPut baby down awake. Return at increasing intervals to briefly reassure (don't pick up): e.g., after 3 min, then 5 min, then 10 min. Studies show effective results in 3-7 days.\n\n3. Fading / Chair Method:\nSit beside crib until baby sleeps. Each night, move your chair further away. Gentler but slower.\n\n4. No-Cry Methods:\nOffer and then withdraw comfort: feed/rock until drowsy but not asleep, put down, pick up if crying, repeat. Very gradual — can take weeks.\n\n5. The Indian Reality:\nMany Indian families co-sleep and this is a valid choice. Safe co-sleeping (firm mattress, sober adults, no pillows around baby) is practiced across Asia. There is no cultural imperative to sleep-train if your family is sleeping well.\n\nKey Principle: Any method you implement consistently will be more effective than any method implemented inconsistently.`,
    topic: 'Sleep',
    readTime: '6 min',
    ageMin: 4,
    ageMax: 24,
    emoji: '😴',
    tag: 'Sleep Training',
    imageUrl: 'https://images.unsplash.com/photo-1541845157-a6d2d100c931?w=800&h=400&fit=crop&q=80',
    url: 'https://healthline.com/health/parenting/sleep-training-methods',
    audience: 'all',
  },
  {
    id: 'a37',
    title: 'Bedtime Routines That Actually Work',
    preview: 'A consistent bedtime routine is the single most evidence-backed strategy for improving baby and toddler sleep. Even a simple 20-minute routine reduces sleep onset time and nighttime waking.',
    body: `The Science of Routines:\nA 2009 study published in Sleep found that children whose parents introduced a consistent bedtime routine showed significant improvements in sleep quality within just 2 weeks. Routines cue the brain to begin producing melatonin (the sleep hormone).\n\nBuilding a Simple Routine:\nChoose 3-4 calming activities done in the same order every night. Total time: 20-30 minutes.\n\nSample Routine for Babies (0-12 months):\n1. Warm bath (10 min)\n2. Oil massage (5 min)\n3. Fresh nappy and pyjamas\n4. Feed (breast or bottle)\n5. Gentle song or lullaby\n6. Into crib/bed while drowsy but awake\n\nSample Routine for Toddlers (1-3 years):\n1. Bath\n2. Pyjamas\n3. Small snack (banana, milk, or warm daliya)\n4. Brush teeth\n5. One or two books\n6. Lights low, lullaby or soft music\n7. Into bed\n\nKey Tips:\n- Same time every night (within 15-20 minutes)\n- No screens for at least 1 hour before bed (blue light suppresses melatonin)\n- Keep the bedroom dark and slightly cool (22-24°C)\n- The routine should move to an increasingly calm environment\n- White noise (gentle, consistent sound) extends sleep for many babies`,
    topic: 'Sleep',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 36,
    emoji: '🌙',
    tag: 'Bedtime',
    imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&h=400&fit=crop&q=80',
    url: 'https://www.sleepfoundation.org/baby-sleep/bedtime-routine-for-babies',
    audience: 'all',
  },

  // ─── Toddler ──────────────────────────────────────────────────────────────────

  {
    id: 'a38',
    title: 'Toddler Tantrums: What\'s Normal and How to Respond',
    preview: 'Tantrums peak between ages 18 months and 3 years. They are not manipulation or naughtiness — they are a normal developmental response to overwhelming emotions in an immature brain. Here\'s how to handle them.',
    body: `Why Tantrums Happen:\nThe prefrontal cortex — responsible for emotional regulation, impulse control, and reasoning — is not fully developed until age 25. Toddlers feel emotions intensely but have almost no ability to regulate them. A tantrum is a neurological overload, not bad behaviour.\n\nCommon Triggers:\n- Hunger or tiredness (HALT: Hungry, Angry, Lonely, Tired)\n- Transitions: Leaving the park, ending screen time\n- Wanting independence but lacking skills\n- Overstimulation (crowded market, birthday party)\n\nIn the Moment:\n1. Stay calm yourself — your nervous system co-regulates with your child's\n2. Get down to their level\n3. Label the emotion: "You're angry because we have to leave the park. I understand."\n4. Don't reason or lecture during the tantrum — the logical brain is offline\n5. Offer a choice if safe: "Do you want to walk to the car or shall I carry you?"\n6. If safe, let them ride it out — a tantrum typically peaks and subsides in 5-15 minutes\n7. After the storm: reconnect with a hug. Then briefly discuss.\n\nWhat Not to Do:\n- Don't give in to the tantrum demand (reinforces the behaviour)\n- Don't shame or punish\n- Don't abandon them emotionally ("Stop crying or I'll leave")\n- Don't match their emotional intensity`,
    topic: 'Development',
    readTime: '5 min',
    ageMin: 15,
    ageMax: 48,
    emoji: '🌪️',
    tag: 'Toddler Behaviour',
    imageUrl: 'https://images.unsplash.com/photo-1533194420-2cf7e7c73bdc?w=800&h=400&fit=crop&q=80',
    url: 'https://www.zerotothree.org/resources/268-toddlers-and-challenging-behavior-why-they-do-it-and-how-to-respond',
    audience: 'all',
  },
  {
    id: 'a39',
    title: 'Introducing Allergenic Foods: When and How',
    preview: 'For years, parents were told to delay peanuts, eggs, and dairy. New research has completely reversed this guidance. Early introduction of allergenic foods actually reduces allergy risk.',
    body: `The LEAP Study (2015) Changed Everything:\nThe LEAP trial showed children at high risk of peanut allergy who were introduced to peanuts between 4-11 months had an 81% reduction in peanut allergy by age 5, compared to those who avoided peanuts.\n\nCurrent IAP & WHO Guidance: Introduce allergenic foods at 6 months, alongside other complementary foods. Do NOT delay introduction of common allergens.\n\nTop 9 Allergens to Introduce:\n1. Peanuts (smooth peanut butter diluted with breastmilk/water)\n2. Tree nuts\n3. Milk and dairy products (curd, paneer — avoid cow's milk as main drink before 1 year)\n4. Eggs (well-cooked initially)\n5. Wheat (roti, dal, daliya)\n6. Soy\n7. Fish (if non-vegetarian)\n8. Shellfish\n9. Sesame (til) — common in Indian kitchens\n\nHow to Introduce Safely:\n- Introduce one new food at a time, wait 3 days before the next\n- Give in the morning so you can watch for reactions during waking hours\n- Start with a small amount on a spoon\n- Signs of allergic reaction to watch for within 2 hours: hives, swelling (lip, face), vomiting, difficulty breathing — if these occur, seek emergency care immediately\n\nFor babies at high risk (severe eczema or existing egg allergy) — discuss the timing with your paediatrician before introducing peanuts.`,
    topic: 'Feeding',
    readTime: '5 min',
    ageMin: 4,
    ageMax: 18,
    emoji: '🥜',
    tag: 'Allergy Prevention',
    imageUrl: 'https://images.unsplash.com/photo-1567946187921-f85d75f17a65?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/pdf/Complementary-Feeding-guidelines.pdf',
    audience: 'all',
  },
  {
    id: 'a40',
    title: 'Screen Time for Under 2s: What the Research Says',
    preview: 'The WHO recommends zero screen time for children under 2 years. Here\'s the evidence behind this guideline and practical strategies for modern Indian households.',
    body: `What the Research Shows:\n- Children under 18 months cannot transfer learning from screens to real life (transfer deficit)\n- Passive screen viewing displaces high-quality parent-child interaction\n- Heavy screen use correlates with delayed language development, attention difficulties, and disrupted sleep\n- The blue light from screens suppresses melatonin production — even 30 minutes before bedtime affects sleep quality\n\nWHO Guidelines (2019):\n- Under 1 year: No screen time at all\n- 1-2 years: Video chatting with family only (this is different from passive viewing)\n- 2-5 years: Maximum 1 hour of high-quality content per day, co-viewed with a parent\n\nThe Indian Reality:\nIn many Indian households, the TV runs all day, and handing over a phone is a default calming strategy. Some screens are inevitable. The research message is more nuanced than "no screens ever":\n- The quality of content matters (educational, slow-paced is better than flashy)\n- Co-viewing with a parent who talks about what they're seeing greatly reduces the harm\n- The biggest risk is screens replacing parent-child interaction\n\nPractical Tips:\n- Designate screen-free zones (bedroom, meal times)\n- Create a calm routine that doesn't rely on screens for wind-down\n- Use screens together — talk about what you're watching\n- For genuine breaks, try audiobooks or music instead`,
    topic: 'Development',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 36,
    emoji: '📱',
    tag: 'Screen Time',
    imageUrl: 'https://images.unsplash.com/photo-1484627147104-f5197bcd6651?w=800&h=400&fit=crop&q=80',
    url: 'https://www.who.int/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more',
    audience: 'all',
  },
  {
    id: 'a41',
    title: 'Potty Training: A Gentle Step-by-Step Approach',
    preview: 'Most children are ready for potty training between 18-30 months. Readiness — not age — is the key indicator. A calm, positive approach works far better than pressure or a set timeline.',
    body: `Signs of Readiness:\n- Stays dry for at least 2 hours at a time\n- Shows awareness of being wet or dirty\n- Can follow simple instructions\n- Interested in the toilet or toilet training\n- Can pull pants up and down\n- Hiding when having a bowel movement\n\nIf your child isn't showing these signs, wait — potty training before readiness only prolongs the process and causes stress.\n\nStep-by-Step Approach:\n\nWeek 1: Introduce the concept\n- Buy a potty and let child explore it (use as a step, sit on fully clothed)\n- Read books about potty training together\n- Name the potty, make it a positive object\n\nWeek 2: Practice runs\n- Let child sit on the potty at predictable times: after waking, before bath, after meals\n- No pressure to produce — sitting for 2 minutes is success\n- Use specific praise: "Well done for sitting on the potty!"\n\nWeek 3: Full implementation\n- Switch to underwear (training pants or regular) during the day\n- Take to toilet every 1.5-2 hours\n- Expect accidents — respond calmly ("Let's clean up together")\n- Never punish accidents\n\nNights: Nighttime dryness comes 6-12 months after daytime training for most children. Don't rush — use absorbent pants at night.`,
    topic: 'Development',
    readTime: '6 min',
    ageMin: 18,
    ageMax: 48,
    emoji: '🚽',
    tag: 'Toddler',
    imageUrl: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&h=400&fit=crop&q=80',
    url: 'https://healthline.com/health/parenting/potty-training-tips',
    audience: 'all',
  },

  // ─── Health & safety ──────────────────────────────────────────────────────────

  {
    id: 'a42',
    title: 'Baby-Proofing Your Home: Room-by-Room Guide',
    preview: 'Accidents are the leading cause of injury in children under 5. Most home accidents are preventable. Here\'s a practical room-by-room guide for Indian homes, including hazards unique to our lifestyle.',
    body: `When to Start: Baby-proof by 4 months — before your baby rolls; certainly before 6 months when they start becoming mobile.\n\nKitchen:\n- Stove knob covers\n- Keep hot liquids well back from counter edges\n- Lock under-sink cabinets (cleaning products)\n- Oven door locks\n- Never hold baby while cooking on a gas flame\n\nLiving Room / Drawing Room:\n- Electrical socket covers on all exposed sockets\n- Secure heavy furniture (TV units, bookshelves) to walls — tip-over injuries kill children annually\n- Cover sharp furniture corners\n- Keep remote controls and batteries out of reach (button batteries are a swallowing emergency)\n- Rope/cord safety on blinds and curtains — strangulation hazard\n\nBedroom:\n- Crib or bed rails if co-sleeping\n- No pillows, quilts, or stuffed animals in baby's sleep space\n- Secure wardrobe\n\nBathroom:\n- Never leave water in buckets or tubs — a child can drown in 5cm of water\n- Temperature lock on geyser\n- Non-slip mats\n- Medicines stored in locked cabinet\n\nUniquelyIndian Hazards:\n- Mosquito coil and liquid vaporiser fumes — keep out of baby's room; use nets instead\n- Floor level cooking areas — gate off\n- Outdoor terrace railings — check spacing\n- Household help awareness — all caregivers need the same safety knowledge`,
    topic: 'Baby Care',
    readTime: '6 min',
    ageMin: 3,
    ageMax: 48,
    emoji: '🏠',
    tag: 'Safety',
    imageUrl: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=400&fit=crop&q=80',
    url: 'https://www.who.int/news-room/fact-sheets/detail/child-injuries',
    audience: 'all',
  },
  {
    id: 'a43',
    title: 'Fever in Babies: When to Worry, When to Wait',
    preview: 'A baby with fever triggers instant panic — but fever itself is not the enemy. It is the body\'s immune system doing exactly what it should. Here\'s when fever is normal, and when it requires urgent care.',
    body: `Normal Temperature & How to Measure:\nNormal body temperature: 36.5-37.5°C (rectal). The most accurate method in children is rectal thermometry; axillary (armpit) readings are typically 0.5°C lower. Avoid mercury thermometers.\n\nWhat Is Fever?\nA temperature above 38°C (rectal) or 37.5°C (axillary) is considered fever. Fever is a normal immune response and is helpful — it directly inhibits bacterial and viral reproduction.\n\nHigh-Risk Age: Under 3 Months\nFever in babies under 3 months is ALWAYS a medical emergency, regardless of the reading or how well the baby appears. The immune system is immature and infections can deteriorate rapidly. Go to the emergency department immediately.\n\nFebrile Seizures: 2-4% of children between 6 months and 6 years experience febrile seizures. They are frightening but rarely dangerous. Keep the child safe (on their side, away from hard surfaces), time the seizure, call emergency services if it lasts over 5 minutes.\n\nHome Management (3 months+, otherwise healthy):\n- Paracetamol (15mg/kg per dose) or Ibuprofen (over 6 months, 10mg/kg per dose) to improve comfort\n- Continue feeding — fever increases fluid requirements\n- Sponging with lukewarm water (not cold) can help if child is distressed\n- Do NOT swathe in extra layers to "sweat it out"\n- Do NOT give aspirin to children under 16\n\nSigns Requiring Urgent Attention:\n- Fever above 39°C in baby under 6 months\n- Fever lasting more than 3 days\n- Child is inconsolably crying, refuses to feed, is unusually limp, has a non-blanching rash (press a glass on it — if the colour remains, it is an emergency)`,
    topic: 'Vaccination',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 60,
    emoji: '🌡️',
    tag: 'Fever',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/pdf/ch-Fever.pdf',
    audience: 'all',
  },
  {
    id: 'a44',
    title: 'Teething: Timeline, Symptoms, and Relief',
    preview: 'Teething typically begins between 4-7 months. While some babies sail through it, others experience real discomfort. Here\'s what to expect and what actually helps — including which home remedies are safe.',
    body: `Tooth Eruption Timeline:\n- 6-10 months: Lower central incisors (bottom front teeth)\n- 8-12 months: Upper central incisors\n- 9-13 months: Upper lateral incisors\n- 10-16 months: Lower lateral incisors\n- 13-19 months: First molars\n- 16-22 months: Canines\n- 25-33 months: Second molars\nAll 20 primary teeth usually in by age 3.\n\nReal Teething Symptoms:\n- Increased drooling (starts 2-3 months before first tooth)\n- Chewing on everything\n- Irritability and fussiness\n- Swollen gum ridge\n- Mild disrupted sleep\n\nNot Teething Symptoms (seek medical advice):\n- High fever (above 38°C)\n- Diarrhoea\n- Runny nose\n- Rash\nThese symptoms often coincide with teething age due to reduced immunity from passive maternal antibodies — but they are caused by illness, not teething.\n\nSafe Relief Strategies:\n- Cold teething ring (refrigerated, not frozen — frozen is too hard and can bruise gums)\n- Cold, wet flannel to chew on\n- Gentle gum massage with a clean finger\n- Pain relief: Paracetamol (as per age-appropriate dose) if baby is clearly in distress\n\nWhat to Avoid:\n- Teething gels with benzocaine or lidocaine (can affect breathing in infants)\n- Amber teething necklaces (serious strangulation and choking hazard — IAP advises against these)`,
    topic: 'Baby Care',
    readTime: '5 min',
    ageMin: 3,
    ageMax: 30,
    emoji: '🦷',
    tag: 'Teething',
    imageUrl: 'https://images.unsplash.com/photo-1504439904031-93ded9f93e4e?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/dental-care/',
    audience: 'all',
  },
  {
    id: 'a45',
    title: 'Baby Eczema: Managing Atopic Dermatitis in Indian Climate',
    preview: 'Eczema affects up to 20% of children. India\'s climate — alternating between humid monsoons and dry winters — creates unique challenges. Here\'s how to manage it effectively.',
    body: `What Is Eczema?\nAtopic dermatitis (eczema) is a chronic inflammatory skin condition caused by a defective skin barrier and immune dysregulation. It often has a family history of asthma, eczema, or hay fever ("atopic triad").\n\nIn Indian Babies:\n- Typically appears at 2-6 months\n- Common sites: cheeks, forehead, scalp, behind knees, inside elbows\n- In dark-skinned babies, eczema may appear as darker patches, not red (often missed)\n\nThe Moisturiser Is Everything:\nThe cornerstone of eczema treatment is barrier repair. Moisturise liberally (aim to use 250g per week) immediately after every bath (within 3 minutes of patting dry).\nGood choices available in India: CeraVe, Cetaphil, Aveeno baby, Vaseline (petroleum jelly — cheap and highly effective).\n\nBath Routine for Eczema:\n- Lukewarm water (not hot), 5-10 minutes maximum\n- Fragrance-free, soap-free wash\n- Pat dry gently, never rub\n- Apply moisturiser immediately\n\nClimate-Specific Tips:\n- Monsoon: Humidity can help, but sweat is an eczema trigger — keep baby cool and change sweaty clothes promptly\n- Winter: Indoor heating and dry air worsen eczema — humidifier in the room and extra moisturisation\n- Summer: Cotton clothing, shade, and frequent moisturisation\n\nWhen to See a Doctor:\n- Widespread weeping, crusted areas (possible bacterial superinfection)\n- Eczema not responding to moisturiser\n- Need for prescription-strength topical corticosteroids (do not fear these — used correctly, they are safe)`,
    topic: 'Baby Care',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 36,
    emoji: '🩺',
    tag: 'Skin Health',
    imageUrl: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/pdf/ch-Atopic-Dermatitis.pdf',
    audience: 'all',
  },

  // ─── Planning to conceive ─────────────────────────────────────────────────────

  {
    id: 'a46',
    title: 'Planning to Conceive: Your Pre-Pregnancy Checklist',
    preview: 'The three months before conception are as important as pregnancy itself. A healthy start gives your baby the best possible beginning — and improves your pregnancy experience significantly.',
    body: `3 Months Before Trying:\n\nStart Folic Acid Now:\nFolic acid 400-800 mcg daily for at least 3 months before conception reduces the risk of neural tube defects (like spina bifida) by up to 70%. Neural tube closure happens at just 21-28 days of gestation — often before you know you're pregnant.\n\nHealth Check:\n- Visit your doctor for a preconception check-up\n- Update vaccinations: Rubella (MMR), Varicella (chickenpox), Hepatitis B, Tdap\n- Screen for: Iron-deficiency anaemia, thyroid (TSH), blood sugar, STIs, Vitamin D deficiency\n- If on any regular medication, discuss safety in pregnancy\n\nLifestyle Changes:\n- Alcohol: Stop completely — there is no proven safe amount in pregnancy\n- Smoking: Quit now — smoking reduces fertility and increases miscarriage risk\n- Weight: Being significantly underweight or overweight increases complication risk — discuss target BMI with your doctor\n- Exercise: Moderate exercise is beneficial. If sedentary, begin a gentle walking programme\n\nFor Partners:\n- Sperm take 70-90 days to develop — lifestyle changes in the male partner take 3 months to show up in sperm quality\n- Avoid hot baths, tight underwear (raises testicular temperature), heavy alcohol consumption, and anabolic steroids\n- Folate intake benefits both partners\n\nUnderstanding Fertility:\n- Average time to conceive: 4-6 months for couples under 30; longer if older\n- Seek specialist help after 12 months of trying (under 35) or 6 months (over 35)`,
    topic: 'Pregnancy',
    readTime: '6 min',
    ageMin: -9,
    ageMax: -9,
    emoji: '🌸',
    tag: 'Preconception',
    imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/immunization/preconception/',
    audience: 'all',
  },
  {
    id: 'a47',
    title: 'Indian Foods That Boost Fertility Naturally',
    preview: 'Diet plays a proven role in both female and male fertility. Indian cuisine is rich in fertility-supporting nutrients — and many traditional Indian practices around conception nutrition have a scientific basis.',
    body: `Nutrients That Support Fertility:\n\nFor Women:\n- Folate: Spinach, methi, rajma, fortified atta — 400mcg daily minimum\n- Iron: Dal, leafy greens, seeds — iron-deficiency anaemia impairs ovulation\n- Antioxidants: Colourful vegetables, amla (highest natural source of Vitamin C)\n- Healthy fats: Ghee, avocado, nuts — support hormone production\n- Zinc: Pumpkin seeds, dal, sesame — essential for reproductive hormone regulation\n\nFor Men (Sperm Quality):\n- Zinc: Supports testosterone production and sperm development\n- Lycopene: Tomatoes (especially cooked in oil) — improves sperm motility\n- Selenium: Brazil nuts, sunflower seeds — antioxidant protection for sperm\n- Vitamin C: Amla, guava — reduces sperm DNA damage\n- CoQ10: Found in meat, fish — improves sperm energy production\n\nIndian Foods to Include More Of:\n- Ashwagandha (shatavari for women): Adaptogenic herb with evidence for improving reproductive hormones\n- Sesame seeds (til): Rich in zinc and healthy fats\n- Cow's ghee (in moderation): Traditional fertility food with fat-soluble vitamins\n- Pomegranate: Rich in antioxidants and folate\n\nFoods to Reduce:\n- Trans fats (partially hydrogenated oils in commercial fried snacks): Shown to impair ovulation\n- Excess refined sugar: Disrupts insulin sensitivity and reproductive hormones\n- Processed/packaged foods: High sodium, preservatives`,
    topic: 'Nutrition',
    readTime: '5 min',
    ageMin: -9,
    ageMax: -9,
    emoji: '🥗',
    tag: 'Fertility Nutrition',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=400&fit=crop&q=80',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6079277/',
    audience: 'all',
  },

  // ─── Vaccination detail ───────────────────────────────────────────────────────

  {
    id: 'a48',
    title: 'India\'s National Immunisation Schedule Explained',
    preview: 'India\'s government immunisation schedule protects your child against 12 life-threatening diseases for free. Here\'s what each vaccine does, when it\'s given, and what to expect after each shot.',
    body: `Universal Immunisation Programme (UIP) — Free at Government Hospitals:\n\nBirth:\n- BCG: Tuberculosis protection — single dose at birth, produces characteristic scar\n- OPV 0: Oral Polio Vaccine — a few drops of oral liquid\n- Hepatitis B 0: Protects against Hep B liver disease\n\n6 Weeks:\n- DTwP 1: Diphtheria, Tetanus, Whooping Cough\n- IPV 1: Inactivated Polio Vaccine (injection)\n- Hep B 1\n- Hib 1: Haemophilus influenzae type b (meningitis, pneumonia)\n- Rotavirus 1: Rotavirus diarrhoea — oral, tastes sweet\n- PCV 1: Pneumococcal — pneumonia, meningitis\n\n10 Weeks: DTwP 2, IPV 2, Hib 2, Rotavirus 2, PCV 2\n14 Weeks: DTwP 3, IPV 3, Hib 3, Rotavirus 3, PCV 3\n\n9 Months: Measles-Rubella (MR) 1, JE 1 (Japanese Encephalitis in endemic areas)\n12 Months: Hep A 1\n15 Months: MR 2, PCV Booster, Varicella\n16-24 Months: DTwP Booster, OPV Booster, Hib Booster, Hep A 2\n\nCommon Post-Vaccine Reactions (Normal):\n- Mild fever for 24-48 hours — give paracetamol if uncomfortable\n- Redness and swelling at injection site\n- Irritability on day of vaccination\n- Reduced appetite\n\nThese are not reasons to skip future vaccines. They indicate your child's immune system is responding correctly.`,
    topic: 'Vaccination',
    readTime: '7 min',
    ageMin: 0,
    ageMax: 24,
    emoji: '💉',
    tag: 'Vaccines',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/immunization/',
    audience: 'all',
  },
  {
    id: 'a49',
    title: 'Toddler Nutrition: What to Feed Your 1-3 Year Old',
    preview: 'Between ages 1-3, your child\'s growth rate slows and their appetite with it. This causes enormous parental anxiety — but understanding what is normal makes the mealtime battles far easier.',
    body: `Normal Eating Patterns for Toddlers:\n- Toddlers grow much slower than infants — their appetite reflects this\n- Food neophobia (fear of new foods) peaks at 18-24 months — it is a developmental survival mechanism, not stubbornness\n- Toddlers may eat well one day and barely at all the next\n- Trust your child's hunger cues — division of responsibility: you decide what, when, where; they decide how much\n\nNutrient Priorities:\n\nIron: Deficiency is the most common nutritional problem in Indian toddlers. After 12 months, milk consumption often increases at the expense of iron-rich foods. Limit cow's milk to 400ml/day maximum. Sources: Rajma, chana, leafy greens, ragi, meat (if non-veg).\n\nCalcium: 700mg/day. Sources: Milk, curd, paneer, ragi, sesame.\n\nZinc: Important for immunity and growth. Sources: Dal, legumes, meat, pumpkin seeds.\n\nVitamin D: Most Indian children are deficient despite sun exposure. Supplementation often recommended — discuss with your paediatrician.\n\nSample Day for a 2-Year-Old:\n- Breakfast: Ragi porridge with banana, or dosa with coconut chutney\n- Snack: Curd with fruit, or chikki (jaggery + peanut)\n- Lunch: Dal, rice, sabzi, small piece of roti\n- Snack: Boiled egg, fruit, or paneer cubes\n- Dinner: Khichdi, idli with sambar, or chapati with dal\n\nMaking Meals Easier:\n- Family meals together — toddlers learn to eat by watching others\n- Offer new foods alongside accepted ones (without pressure to eat)\n- Keep portions small — toddler-appropriate = 1 tablespoon per year of age\n- No pressure, no bribes — both worsen the relationship with food`,
    topic: 'Nutrition',
    readTime: '6 min',
    ageMin: 12,
    ageMax: 36,
    emoji: '🍛',
    tag: 'Toddler Nutrition',
    imageUrl: 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=800&h=400&fit=crop&q=80',
    url: 'https://iapindia.org/pdf/Complementary-Feeding-guidelines.pdf',
    audience: 'all',
  },
  {
    id: 'a50',
    title: 'Mindful Parenting: Being Present in the Digital Age',
    preview: 'Research shows that parental smartphone use affects baby\'s emotional development in measurable ways. Here\'s what mindful parenting looks like in practice — and why it matters more than any toy or class.',
    body: `What the Research Shows:\nA 2018 study found that babies of mothers who were distracted by smartphones showed more negative emotional responses and explored less. The still-face experiment demonstrates that brief periods of non-responsiveness cause measurable stress in infants.\n\nWhy Presence Matters:\nParental responsiveness — noticing and responding to your child's cues — is the primary driver of secure attachment. Secure attachment is associated with better emotional regulation, higher self-esteem, better academic outcomes, and healthier relationships in adulthood.\n\nMindful Parenting in Practice:\n\n1. Phone-free floors: When you are with your baby on the floor or playmat, leave your phone in another room\n2. The 20-20 rule: For every 20 minutes of independent play, offer 20 minutes of undivided attention\n3. Narrate your inner experience: "I was on my phone and I missed what you were doing — I'm sorry. Let me put this away now."\n4. Scheduled connection: Even 30 minutes of truly present, phone-free play daily makes a measurable difference\n5. Manage your own stress: Stressed, overwhelmed parents cannot be present. Your self-care is your child's wellbeing.\n\nBeing Present Doesn't Mean Perfect:\nResponsive parenting doesn't require constant, intense stimulation — it means noticing and responding to cues. Comfortable, quiet companionship is deeply nourishing for a baby. You do not need to be "on" all the time.`,
    topic: 'Mental Health',
    readTime: '5 min',
    ageMin: 0,
    ageMax: 60,
    emoji: '🧘',
    tag: 'Mindful Parenting',
    imageUrl: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=800&h=400&fit=crop&q=80',
    url: 'https://www.zerotothree.org/resources/1423-mindfulness-for-parents',
    audience: 'all',
  },
  {
    id: 'a51',
    title: "Supporting Your Partner Through Pregnancy: A Father's Guide",
    preview:
      "Pregnancy is a team sport. While your partner's body is doing the visible work, your steady support — emotional, physical, and practical — shapes her experience more than any book or app. Here's how to show up across all three trimesters.",
    body: `First Trimester (Weeks 1-12): Be the Calm Anchor\n- Morning sickness is exhausting. Step up on household work without being asked — meals, dishes, laundry.\n- Smells become overwhelming. Cook strong-smelling foods outside or at different times if possible.\n- Fatigue is real. Let her sleep in. Take over errands and household decisions.\n- Go with her to the first few antenatal visits. Meet the doctor, understand the plan, ask questions together.\n\nSecond Trimester (Weeks 13-27): Build Together\n- Energy usually returns. This is the window for setting up the nursery, attending birthing classes together, and making hospital plans.\n- Feel baby's kicks around week 20. This is often the first moment fathers truly feel connected — place your hand on her belly regularly.\n- Talk and sing to the baby. Your voice is familiar to your baby at birth and soothes a crying newborn faster than almost anything else.\n\nThird Trimester (Weeks 28-40): Prepare for the Sprint\n- Pack the hospital bag together. Know where it is.\n- Map the fastest route to the hospital. Have petrol in the car and backup transport lined up.\n- Learn the signs of labour vs. false labour. Know when to call the doctor.\n- Prepare meals in advance and freeze them. The first two weeks at home are chaos.\n- Line up help for the first month — mother-in-law, a cook, a maid, a night nurse. Don't assume you and your partner will manage alone.\n\nCommon Mistakes to Avoid:\n- "You're being emotional" — hormones are real, her feelings are valid, don't dismiss.\n- Disappearing into work as a coping strategy.\n- Comparing her pregnancy to other women's experiences.\n- Making big decisions (house move, job change) without a serious conversation.\n\nThe research is clear: fathers who are actively involved during pregnancy have better mental health postpartum, closer bonds with their babies, and stronger marriages. Being present is the single biggest thing you can do.`,
    topic: 'Fatherhood',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 0,
    emoji: '🤝',
    tag: 'Pregnancy Support',
    audience: 'father',
  },
  {
    id: 'a52',
    title: "The First 40 Days: A Father's Survival Guide",
    preview:
      "The first 40 days (sawa mahina in many Indian traditions) set the tone for your relationship with your baby — and your marriage. Your job in this window is not fathering in the playful sense yet; it's protecting your partner's recovery and taking on the house.",
    body: `What Your Partner Is Going Through:\n- Healing from a major physical event (even an uncomplicated delivery)\n- Establishing breastfeeding, which is hard and often painful at first\n- Hormones crashing dramatically in the first 2 weeks (the "baby blues")\n- Sleep-deprived to a degree most people have never experienced\n- Vulnerable to postpartum depression and anxiety (1 in 5 Indian mothers)\n\nYour Job in the First 40 Days:\n\n1. Be the household manager. Groceries, cooking, laundry, dishes, bills, older children — all of this is yours now. Do not ask her what needs to be done. Figure it out.\n\n2. Protect her sleep. Aggressively. Take the baby between feeds so she can sleep in 2-3 hour blocks. If you're formula feeding or have pumped milk, do the night bottle.\n\n3. Manage the visitor flow. Relatives will want to come. Keep visits short, make sure people wash hands before touching the baby, and shield your partner from anyone who stresses her out (including your own mother if needed).\n\n4. Feed her. She needs ~500 extra calories per day if breastfeeding. Keep water, snacks, and meals coming without her having to ask. Traditional postpartum foods (panjiri, gond ke ladoo, methi laddoos) are nutrient-dense — respect the tradition where it helps.\n\n5. Do diapers and baths. These are easy ways to bond with your baby and give your partner a break. You'll get better with practice.\n\n6. Watch for postpartum depression. If she cries constantly after week 2-3, seems hopeless, can't bond with the baby, or talks about not being here — this is an emergency. Call her doctor same day.\n\nWhat NOT to Do:\n- Don't travel for work in the first 40 days unless absolutely unavoidable.\n- Don't compare this baby to your friends' "easy" babies.\n- Don't tell her to "just sleep when the baby sleeps" as if it's a solution.\n- Don't vanish into your phone or work all day and come home expecting her to be grateful.\n\nThe first 40 days are the hardest of your parenting career. Show up and you will never regret it.`,
    topic: 'Fatherhood',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 2,
    emoji: '🏡',
    tag: 'Newborn Support',
    audience: 'father',
  },
  {
    id: 'a53',
    title: "How Dads Bond With Babies: The Science",
    preview:
      "Bonding isn't only for mothers. Fathers experience hormonal changes too — testosterone drops, oxytocin rises — and the physical, playful way dads interact wires something uniquely valuable into a baby's brain.",
    body: `The Biology of Fatherhood:\nFathers who spend time with their babies show measurable hormonal changes. Testosterone drops (by as much as 30% in some studies), which makes dads calmer, more nurturing, and more attuned to baby cues. Oxytocin — the bonding hormone — rises with skin-to-skin contact, play, and caregiving.\n\nThese changes happen only with involvement. A father who doesn't engage misses this neurological rewiring.\n\nWhat Fathers Bring That's Different:\n- Different voice pitch: babies turn toward deeper male voices as early as 4 weeks\n- More physical, playful interaction: swinging, bouncing, rough-and-tumble — this builds emotional regulation and risk assessment\n- Less predictable patterns: fathers vary routines more than mothers, which helps babies build cognitive flexibility\n- Different holding patterns: holding baby facing out to see the world (mothers tend to hold face-in)\n\nWhat Helps You Bond:\n\n1. Skin-to-skin contact. Shirtless, baby on your bare chest, blanket over you both. Do this daily in the first 3 months. It's one of the most powerful bonding tools.\n\n2. The 3 Bs: bath, bed, bottle. Claim one of these as "Dad's time" and make it consistent. Bath time is often the easiest and most fun.\n\n3. Wear the baby. A soft-structured carrier or ring sling lets you move around the house and still be close. Babies in carriers cry less.\n\n4. Talk and sing. Babies recognise your voice from the womb. Narrate your day, sing lullabies (your pitch doesn't matter), read aloud. Language exposure from fathers predicts vocabulary growth at 2 years.\n\n5. Play. Once baby is 3-4 months, floor time with you is irreplaceable. Tummy time, peek-a-boo, funny faces — this is real parenting work, not filler.\n\nIf You Don't Feel a Bond Yet:\nUnlike mothers (who have 9 months of direct physical connection), father-infant bonding is usually gradual and takes 3-6 months to deepen. This is normal. Keep showing up with skin-to-skin, play, and caregiving — the feelings will catch up to the actions.\n\nA father who is present in the first year is one of the strongest predictors of a child's future wellbeing. This is not a minor contribution — it is foundational.`,
    topic: 'Fatherhood',
    readTime: '7 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🫂',
    tag: 'Bonding',
    audience: 'father',
  },
  {
    id: 'a54',
    title: "Paternal Postpartum Depression: The Silent Struggle",
    preview:
      "Around 10% of new fathers experience postpartum depression — and most never talk about it. In India, where fathers are often expected to just 'get on with it', the silence is even louder. This is what to watch for in yourself.",
    body: `Yes, Fathers Get Postpartum Depression Too:\nResearch shows 8-13% of new fathers globally experience clinically significant postpartum depression in the first year. In men whose partners have postpartum depression, the rate is around 25%. It's real, it's common, and it's very often missed.\n\nWhy Fathers Get Missed:\n- Male depression often looks like anger, irritability, and withdrawal — not sadness\n- Indian cultural expectations discourage men from naming emotional struggles\n- Fathers are rarely screened by doctors\n- The attention is (rightly) on the mother, so dad's symptoms go unnoticed\n\nSigns to Watch For in Yourself:\n- Persistent irritability or anger out of proportion to situations\n- Working excessive hours to avoid being home\n- Increased alcohol or substance use\n- Loss of interest in things you used to enjoy\n- Feeling emotionally disconnected from your baby or partner\n- Physical symptoms: persistent fatigue, headaches, stomach problems\n- Intrusive thoughts about harm to yourself or others\n- Feeling numb, trapped, or that your family would be better off without you\n\nRisk Factors:\n- Your partner has PPD (single biggest risk factor)\n- History of depression or anxiety in yourself\n- Difficult birth experience\n- Financial stress\n- Lack of social support\n- Sleep deprivation beyond normal newborn levels\n- Feeling incompetent or useless as a father\n\nWhat to Do:\n\n1. Talk to someone. A friend, brother, doctor, therapist — anyone. Naming it to another human cuts its power.\n\n2. See a doctor. A GP can screen you and refer appropriately. Treatment works — therapy, medication, or both.\n\n3. Protect your sleep. Sleep deprivation alone can mimic depression. Split nights with your partner, accept help, say no to optional commitments.\n\n4. Exercise. The evidence for exercise as a depression treatment is very strong. Walking 30 minutes a day counts.\n\n5. Avoid alcohol as a coping mechanism. It makes depression dramatically worse.\n\nWhere to Get Help in India:\n- iCall helpline: 9152987821 (Mon-Sat, 8am-10pm)\n- Vandrevala Foundation: 1860 2662 345 (24/7)\n- NIMHANS helpline: 080 4611 0007 (24/7)\n\nTaking care of your mental health isn't weakness. It's the most important thing you can do for your baby and your partner.`,
    topic: 'Mental Health',
    readTime: '7 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🧠',
    tag: 'Paternal Mental Health',
    audience: 'father',
  },
  {
    id: 'a55',
    title: "Holding and Handling Your Newborn with Confidence",
    preview:
      "Your first time holding a newborn feels terrifying. They seem so fragile. Here's a clear, practical guide to picking up, holding, and putting down your baby without fear — plus the specific things new dads worry about.",
    body: `They Are Tougher Than They Look (But Head Support Is Everything):\nA newborn's neck muscles cannot support their head for the first 3-4 months. Every time you lift, carry, or move your baby, one hand supports the head and neck. That's the single biggest rule.\n\nBasic Hold (Cradle Hold):\n1. Slide one hand under the head and neck\n2. Slide the other hand under the bottom\n3. Lift gently to your chest\n4. Transfer the head to the crook of your elbow, with your forearm supporting the back\n5. Your other hand is free to support the legs or stroke the head\n\nShoulder Hold (Best for Burping and Settling):\n1. Lift baby as above\n2. Rest baby's head on your shoulder, cheek against your neck\n3. One hand supports the bottom, the other pats or rubs the back\n\nFootball Hold (Good for Dads with Bigger Hands):\n1. Tuck baby under your arm with their body along your forearm\n2. Head rests in the palm of your hand\n3. Legs tuck under your armpit\n4. Great for giving bottles and for staying close without tiring your arms\n\nFears Dads Commonly Have (and the Reality):\n\n"Will I drop the baby?"\nWith basic head support, no. Babies are more robust than your fear suggests. Practice will build your confidence within days.\n\n"The soft spot on the head — am I going to damage it?"\nThe fontanelle is covered by a tough, flexible membrane. Normal handling — including washing the head in a bath — will not hurt it. Avoid hard pressing.\n\n"What if I hold the neck too tight?"\nYour support should feel like a gentle cradle, not a grip. If the head flops, you're not supporting enough; if your knuckles are white, you're supporting too hard.\n\n"I'm worried about my rough hands/stubble/cologne."\nWash hands, trim nails, skip strong cologne, and a quick shave helps for cheek-to-cheek snuggles. Baby's skin is delicate but not overly sensitive.\n\nNever Shake a Baby:\nEven gentle shaking can cause shaken baby syndrome — brain haemorrhage, blindness, or death. If frustration or exhaustion ever makes you feel like shaking:\n1. Put baby down safely in the crib\n2. Leave the room\n3. Breathe for 5 minutes\n4. Call someone — your partner, a friend, a helpline\n\nFrustration with a crying baby is normal. Acting on it is not.`,
    topic: 'Newborn Care',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 4,
    emoji: '👐',
    tag: 'Newborn Care',
    audience: 'father',
  },
  {
    id: 'a56',
    title: "Bottle-Feeding as a Dad: Bonding Through Feeds",
    preview:
      "Feeding is a powerful bonding window — oxytocin, eye contact, and sustained close physical contact. Whether it's expressed breast milk or formula, when dad does bottle feeds, baby gets a second deep attachment relationship.",
    body: `Why Dads Doing Bottle Feeds Matters:\n- Gives mom a genuine break (the best postpartum gift you can offer)\n- Builds your attachment with the baby through close, sustained contact\n- Lets baby form flexible feeding associations (not just with one parent)\n- Divides night duty and protects everyone's sleep\n\nBefore You Start:\n- Have the bottle ready before you pick up baby (a hungry baby can't wait)\n- Expressed breast milk should be warmed gently in a bowl of warm water, never microwaved (creates hot spots that burn)\n- Formula: follow the tin instructions exactly. Don't add extra scoops. Don't reduce scoops. Powder-to-water ratio is the single most important safety step in formula prep.\n\nThe Feed Itself (Paced Bottle Feeding):\n1. Hold baby in a semi-upright position (not flat on their back — causes choking and ear infections)\n2. Make eye contact. Put your phone in another room.\n3. Touch the nipple to baby's lips and wait for them to open their mouth wide — don't push it in\n4. Keep the bottle horizontal (not tipped high). This slows the flow and mimics breast feeding pacing.\n5. Pause every 1-2 minutes. Take the bottle out, let baby breathe and decide if they want more.\n6. Burp halfway through and at the end.\n7. Stop when baby turns away, shuts their mouth, or slows down. Don't pressure them to finish the bottle.\n\nHow Much, How Often (Rough Guide):\n- 0-1 month: 60-90ml every 2-3 hours\n- 1-3 months: 90-150ml every 3-4 hours\n- 3-6 months: 150-210ml every 4 hours\n- 6+ months: 150-240ml, less frequently as solids begin\n\nThese are averages. Every baby is different. Follow hunger cues, not a clock.\n\nTips from Experienced Dads:\n- Skin-to-skin during bottle feeds (shirt off, baby in just a diaper) is incredibly powerful\n- Take the night shift 2-3 times a week if possible — your partner will feel human again\n- Don't take it personally if baby cries at first. Some babies need a few tries to accept bottle from a non-mom\n- If breastfeeding, introduce bottle around 3-4 weeks, once breastfeeding is established but before 6 weeks (nipple rigidity develops after)\n\nBottle feeds can be one of the most emotionally rewarding parts of your day. Claim them.`,
    topic: 'Feeding',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 8,
    emoji: '🍼',
    tag: 'Feeding',
    audience: 'father',
  },
  {
    id: 'a57',
    title: "Splitting Night Duty: How Modern Indian Dads Do It",
    preview:
      "Night feeds and wakes break marriages. The partner who sleeps 2 hours while the other sleeps 8 will fracture eventually. Here's how to actually divide the night — and why splitting matters more than 'helping'.",
    body: `The Myth of "Helping":\nWhen dads say "I help with the baby at night", the word "help" says everything. Helping implies it's her job and you're a bonus. Splitting night duty is co-parenting. The language matters.\n\nOptions That Actually Work:\n\nOption 1: Shift System (Best for Exclusively Bottle-Fed or Pumping)\n- Mom takes 9pm-2am\n- Dad takes 2am-7am\n- Each person gets one solid 5-hour sleep stretch\n- This single change can save a marriage in the newborn phase\n\nOption 2: Breastfeeding Split (When Mom Is Doing the Feeds)\n- Dad does all pre-feed work: bring baby to mom, change diaper, burp, settle back to sleep\n- Mom only does the actual feed\n- Mom's "awake time" drops from 40 min per feed to 15-20 min\n- Dramatically reduces her sleep disruption\n\nOption 3: Every Other Night\n- Dad takes the full night every other night\n- Mom pumps or uses expressed milk\n- Mom gets one genuinely restful night out of two\n- Only works once breastfeeding is established (6-8 weeks+)\n\nOption 4: "On Call" Dad\n- Baby sleeps in a crib next to your bed\n- Dad gets up for every wake, changes diaper, brings to mom if breastfeeding, takes bottle if bottle-fed\n- Mom's only job is the feed itself (if breastfeeding)\n- Dad essentially gives up his nights but mom recovers faster and your marriage survives\n\nMaking Your Option Work:\n- Agree in advance, not during a 3am fight\n- Use separate rooms if needed so the off-duty parent actually sleeps\n- Earplugs and eye masks for the sleeping parent are essential, not optional\n- Accept the phase: this lasts 3-6 months typically, then gradually improves\n\nCommon Dad Objections (and the Reality):\n"I have to work in the morning." — So does she (looking after a newborn is work). Single-income households still need to split.\n"I can't breastfeed." — 90% of what happens around a feed isn't the feed. Do the other 90%.\n"I'm a deeper sleeper, I won't hear the baby." — Train yourself. Baby monitor on your side, vibration feature on your watch, keep the crib on your side of the bed.\n\nThe couples who split night duty emerge from the newborn phase stronger. The couples who don't, rarely do.`,
    topic: 'Sleep',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 12,
    emoji: '🌙',
    tag: 'Sleep',
    audience: 'father',
  },
  {
    id: 'a58',
    title: "Diaper Changing Without Drama: A Practical Guide",
    preview:
      "You will change around 2,000 diapers in your child's first year. Treating it as real work — not a chore to minimise — changes how your baby sees you and how your partner values your role.",
    body: `Set Up Your Station:\n- Changing mat + waterproof liner (or a spare towel)\n- Fresh diaper (open and ready, absorbent side up)\n- Wipes or cotton + warm water (cotton is gentler for newborn bottoms, great for the first 6 weeks)\n- Barrier cream (zinc oxide based — Desitin, Siloderm, or Himalaya's diaper rash cream)\n- A change of baby clothes nearby (blowouts happen)\n- Hand sanitiser or wet wipes for your hands\n\nThe Change Itself:\n1. Lay baby on their back on the mat. Keep one hand on them at all times — rolling happens suddenly.\n2. Open the dirty diaper but don't pull it away yet\n3. Use the clean inside front of the dirty diaper to wipe off the majority of poop\n4. Lift baby's legs by gently holding both ankles with one hand (don't pull)\n5. Slide the dirty diaper out and fold it up with the mess inside\n6. Wipe thoroughly, front to back (very important for girls — prevents UTIs)\n7. Let the skin air-dry for 30 seconds (drastically reduces diaper rash)\n8. Apply barrier cream to any redness\n9. Slide the new diaper under and fasten snugly — two fingers should fit at the waist\n10. Wash your hands\n\nThe Boy-Specific Rule:\nBoys pee mid-change. Often. Keep a cloth or second wipe ready to cover as you change. It's not personal.\n\nWhen to Change:\n- Newborns: 8-12 changes a day minimum\n- 3-6 months: 6-8 changes a day\n- Older: 4-6 changes a day\n- Always change after a poop, even if it's been 20 minutes since the last pee change\n- Change before bed and immediately on waking\n\nDiaper Rash Warning Signs:\n- Red, raw skin → more frequent changes + barrier cream + air time\n- Bright red with satellite dots → yeast infection (see paediatrician, needs antifungal)\n- Blood → call paediatrician\n\nCloth vs Disposable:\nBoth work. Cloth is cheaper long-term and greener, but needs a household setup (washing, drying). Disposable is faster for dads still learning. No judgment either way — do what works for your family.\n\nWhy This Matters:\nDiaper changes are 5-minute windows of concentrated connection. You talk, make faces, narrate what you're doing. Over a year, that's 150+ hours of bonding time. Don't rush them, don't outsource them, don't resent them.`,
    topic: 'Newborn Care',
    readTime: '6 min',
    ageMin: 0,
    ageMax: 24,
    emoji: '🧷',
    tag: 'Diapering',
    audience: 'father',
  },
  {
    id: 'a59',
    title: "From Partner to Dad: Your Identity Shift",
    preview:
      "No one warns you that becoming a dad changes who you are, not just what you do. Many fathers quietly struggle with the loss of their old life while pretending everything's fine. Acknowledging the shift is the first step to thriving in it.",
    body: `What Actually Changes:\n- Your time is no longer yours\n- Your sleep is no longer yours\n- Your money has a new first priority\n- Your marriage becomes a working partnership, not just a romantic one\n- Your sense of identity — work, hobbies, friends, fitness — gets reshuffled\n- Your parents and in-laws have new expectations of you\n- You become "responsible" in the eyes of the world overnight\n\nWhat Dads Commonly Feel (and Rarely Say):\n\nGrief for your old life. The freedom to say yes to a weekend trip. The evenings at the gym. The spontaneous dinners. This grief is real, and it co-exists with love for your child. Both can be true.\n\nResentment at times. Toward the baby, your partner, or your situation. If you never feel a flash of resentment, you're not paying attention. It passes. Don't act on it, don't deny it.\n\nFeeling invisible. The attention is on the mother and the baby. No one asks how you are. This is normal and largely necessary — but it wears on you if it continues too long.\n\nPressure to "provide". Indian culture often doubles this pressure on fathers. You can carry it without letting it crush you.\n\nFear of being a bad dad. Especially if your own father was absent, angry, or unavailable. This fear is a sign you care — and it's the first step to not repeating the pattern.\n\nHow to Ride the Shift:\n\n1. Keep one anchor. Pick one thing from your old life — exercise 3x a week, a weekly chai with a friend, one hobby — and fiercely protect it. You need a place where you are still you.\n\n2. Talk to another dad. Someone 1-2 years ahead of you. They will normalise everything you're feeling and tell you what actually helped.\n\n3. Have a weekly 20-minute conversation with your partner that isn't about logistics. How are you, really? What do you need this week? Work becomes teamwork when communication is deliberate.\n\n4. Rebuild your friendships slowly. Dad friends are different from single-guy friends. Find a few. It's worth the effort.\n\n5. Reflect on your father. What do you want to take? What do you want to break? Write it down. This isn't therapy-speak, it's the most important parenting work you will do.\n\nThe identity shift takes 1-2 years to fully settle. You won't go back to who you were before — you will become someone new, and if you pay attention, someone better.`,
    topic: 'Fatherhood',
    readTime: '7 min',
    ageMin: 0,
    ageMax: 24,
    emoji: '🧭',
    tag: 'Identity',
    audience: 'father',
  },
  {
    id: 'a60',
    title: "Rough-and-Tumble Play: Why Dads Should Lean In",
    preview:
      "Dads tend to play rougher — swinging, tossing, chasing, wrestling. This isn't just fun; it builds emotional regulation, body awareness, and risk assessment in ways quieter play can't replicate. Here's how to do it safely and well.",
    body: `What the Research Shows:\nChildren whose fathers engaged in rough-and-tumble play from infancy show:\n- Better emotional self-regulation\n- Stronger social skills (reading cues, taking turns, handling excitement)\n- Healthier risk assessment (they take appropriate risks, not reckless ones)\n- Lower rates of anxiety disorders\n- Stronger father-child bonds through adolescence\n\nWhat It Looks Like at Each Age:\n\n0-3 months:\n- Gentle bouncing on your knee while supporting the neck\n- "Airplane" — lifting baby above your chest while lying down, with firm two-handed hold\n- Tummy-to-tummy lying with slow rolling side to side\n\n3-6 months:\n- Faster airplane dips (baby will start laughing around 4 months)\n- "This little piggy" with animated voices\n- Lifting baby overhead (they love the view)\n- Gentle wrestle on the bed — letting them land on you\n\n6-12 months:\n- Chasing on hands and knees\n- Hiding and popping out (peek-a-boo at scale)\n- Lifting and spinning\n- Tickle-chase games\n\n12 months+:\n- Full wrestle on a soft surface\n- Shoulder rides\n- "Horse" — crawling with child on your back\n- Chase games where you "just catch" them\n- Throw-and-catch games (small distance, soft objects)\n\nSafety Rules (Important):\n- Never shake. The neck rule still applies in every game for the first 6 months.\n- Support the head fully for all lifting games until 4 months.\n- Watch baby's cues — too much excitement becomes overwhelming. Signs: eyes darting, body arching away, crying. Stop and calm down.\n- Soft surfaces only — bed, carpet, rug. No tile.\n- Remove watches, rings, sharp-edged belt buckles.\n- No rough play right before bed — winds them up, makes sleep harder.\n- No rough play right after a feed — they will vomit.\n\nWhen Your Partner Worries:\nMany mothers watch rough play nervously. This is normal. Explain what you're doing and why, invite her to join, and show her the baby's delighted face. Most of the worry dissolves once she sees the joy in it.\n\nWhen to Pull Back:\n- If baby is crying, not laughing\n- If either of you is tired or frustrated\n- If baby has just eaten\n- If baby is unwell\n- If your partner is truly uncomfortable (it's not the hill to die on — choose another game)\n\nRough-and-tumble play is one of the most distinct things fathers contribute. Lean in — the laughter is priceless and the brain-building is real.`,
    topic: 'Development',
    readTime: '7 min',
    ageMin: 0,
    ageMax: 60,
    emoji: '🤸',
    tag: 'Play',
    audience: 'father',
  },
];
