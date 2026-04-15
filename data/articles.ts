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
  },
];
