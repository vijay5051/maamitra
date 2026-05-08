import { Platform, type ImageSourcePropType } from 'react-native';

const PROD_ORIGIN = 'https://maamitra.co.in';

const STATIC_ARTICLE_BANNER_PATHS: Record<string, string> = {
  a01: '/article-banners/starting-solid-foods-the-right-way.png',
  a02: '/article-banners/understanding-your-newborns-sleep-cycles.png',
  a03: '/article-banners/breastfeeding-tips-for-indian-mothers.png',
  a04: '/article-banners/babys-first-year-month-by-month-development.png',
  a05: '/article-banners/postpartum-recovery-what-to-expect.png',
  a06: '/article-banners/iap-vaccination-schedule-explained.png',
  a07: '/article-banners/iron-rich-foods-for-breastfeeding-mothers.png',
  a08: '/article-banners/managing-postpartum-anxiety.png',
  a09: '/article-banners/gentle-yoga-poses-for-new-moms.png',
  a10: '/article-banners/when-to-introduce-water-to-your-baby.png',
  a11: '/article-banners/sleep-training-an-indian-familys-guide.png',
  a12: '/article-banners/baby-massage-benefits-and-techniques.png',
  a13: '/article-banners/toddler-nutrition-healthy-indian-meals.png',
  a14: '/article-banners/recognising-developmental-red-flags.png',
  a15: '/article-banners/self-care-for-the-overwhelmed-mother.png',
  a16: '/article-banners/first-trimester-what-to-expect-week-by-week.png',
  a17: '/article-banners/prenatal-yoga-safe-poses-for-every-trimester.png',
  a18: '/article-banners/what-to-eat-during-pregnancy-an-indian-diet-guide.png',
  a19: '/article-banners/managing-morning-sickness-what-actually-works.png',
  a20: '/article-banners/third-trimester-preparing-for-labour-and-delivery.png',
  a21: '/article-banners/skin-to-skin-contact-the-science-of-kangaroo-care.png',
  a22: '/article-banners/bathing-your-newborn-a-step-by-step-guide.png',
  a23: '/article-banners/decoding-your-babys-cries.png',
  a24: '/article-banners/umbilical-cord-care-dos-and-donts.png',
  a25: '/article-banners/breastfeeding-positions-finding-what-works-for-you.png',
  a26: '/article-banners/increasing-your-milk-supply-evidence-vs-myths.png',
  a27: '/article-banners/formula-feeding-a-complete-guide-for-indian-mothers.png',
  a28: '/article-banners/tummy-time-why-it-matters-and-how-to-do-it.png',
  a29: '/article-banners/talking-to-your-baby-building-language-from-birth.png',
  a30: '/article-banners/sensory-play-activities-for-each-stage.png',
  a31: '/article-banners/baby-massage-a-guide-to-traditional-malish.png',
  a32: '/article-banners/postpartum-recovery-your-body-after-birth.png',
  a33: '/article-banners/postpartum-depression-recognising-it-and-getting-help.png',
  a34: '/article-banners/nutrition-for-new-mothers-what-to-eat-after-birth.png',
  a35: '/article-banners/pelvic-floor-recovery-after-birth.png',
  a36: '/article-banners/sleep-training-a-clear-guide-to-the-main-methods.png',
  a37: '/article-banners/bedtime-routines-that-actually-work.png',
  a38: '/article-banners/toddler-tantrums-whats-normal-and-how-to-respond.png',
  a39: '/article-banners/introducing-allergenic-foods-when-and-how.png',
  a40: '/article-banners/screen-time-for-under-2s-what-the-research-says.png',
  a41: '/article-banners/potty-training-a-gentle-step-by-step-approach.png',
  a42: '/article-banners/baby-proofing-your-home-room-by-room-guide.png',
  a43: '/article-banners/fever-in-babies-when-to-worry-when-to-wait.png',
  a44: '/article-banners/teething-timeline-symptoms-and-relief.png',
  a45: '/article-banners/baby-eczema-managing-atopic-dermatitis-in-indian-climate.png',
  a48: '/article-banners/indias-national-immunisation-schedule-explained.png',
  a49: '/article-banners/toddler-nutrition-what-to-feed-your-1-3-year-old.png',
  a50: '/article-banners/mindful-parenting-being-present-in-the-digital-age.png',
  a51: '/article-banners/supporting-your-partner-through-pregnancy-a-fathers-guide.png',
  a52: '/article-banners/the-first-40-days-a-fathers-survival-guide.png',
  a53: '/article-banners/how-dads-bond-with-babies-the-science.png',
  a54: '/article-banners/paternal-postpartum-depression-the-silent-struggle.png',
  a55: '/article-banners/holding-and-handling-your-newborn-with-confidence.png',
  a56: '/article-banners/bottle-feeding-as-a-dad-bonding-through-feeds.png',
  a57: '/article-banners/splitting-night-duty-how-modern-indian-dads-do-it.png',
  a58: '/article-banners/diaper-changing-without-drama-a-practical-guide.png',
  a59: '/article-banners/from-partner-to-dad-your-identity-shift.png',
  a60: '/article-banners/rough-and-tumble-play-why-dads-should-lean-in.png',
};

export function getStaticArticleImageSource(articleId?: string | null): ImageSourcePropType | undefined {
  if (!articleId) return undefined;
  const path = STATIC_ARTICLE_BANNER_PATHS[articleId];
  if (!path) return undefined;
  // Web is served from the same origin so a relative path is fine; native
  // needs an absolute URL to fetch over HTTP.
  return { uri: Platform.OS === 'web' ? path : `${PROD_ORIGIN}${path}` };
}
