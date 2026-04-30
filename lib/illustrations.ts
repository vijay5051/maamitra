// Static map of all illustration assets. Required as ImageSource modules so
// Metro bundles them. Use via the <Illustration name="..." /> component.

export const illustrations = {
  homeHero: require('../assets/illustrations/home-hero.webp'),
  homeHeroMorning: require('../assets/illustrations/home-hero-morning.webp'),
  homeHeroAfternoon: require('../assets/illustrations/home-hero-afternoon.webp'),
  homeHeroEvening: require('../assets/illustrations/home-hero-evening.webp'),
  chatMascot: require('../assets/illustrations/chat-mascot.webp'),

  // Mood faces (1=glowing, 2=calm, 3=neutral, 4=tired, 5=overwhelmed)
  mood1: require('../assets/illustrations/mood-1-glowing.webp'),
  mood2: require('../assets/illustrations/mood-2-calm.webp'),
  mood3: require('../assets/illustrations/mood-3-neutral.webp'),
  mood4: require('../assets/illustrations/mood-4-tired.webp'),
  mood5: require('../assets/illustrations/mood-5-overwhelmed.webp'),

  // Health category cards
  healthCatBaby: require('../assets/illustrations/health-cat-baby.webp'),
  healthCatMother: require('../assets/illustrations/health-cat-mother.webp'),
  healthCatBenefits: require('../assets/illustrations/health-cat-benefits.webp'),

  // Hero & welcome
  wellnessHero: require('../assets/illustrations/wellness-hero.webp'),
  familyEmpty: require('../assets/illustrations/family-empty.webp'),
  onboardingWelcome: require('../assets/illustrations/onboarding-welcome.webp'),

  // Feature carousel (welcome / onboarding)
  featureAi: require('../assets/illustrations/feature-ai.webp'),
  featureGrowth: require('../assets/illustrations/feature-growth.webp'),
  featureCommunity: require('../assets/illustrations/feature-community.webp'),
  featureLibrary: require('../assets/illustrations/feature-library.webp'),
  featureIndia: require('../assets/illustrations/feature-india.webp'),
  featurePrivate: require('../assets/illustrations/feature-private.webp'),
  featureFree: require('../assets/illustrations/feature-free.webp'),

  // Community topic banners
  topicNewborn: require('../assets/illustrations/topic-newborn.webp'),
  topicPregnancy: require('../assets/illustrations/topic-pregnancy.webp'),
  topicNutrition: require('../assets/illustrations/topic-nutrition.webp'),
  topicMentalHealth: require('../assets/illustrations/topic-mental-health.webp'),
  topicMilestones: require('../assets/illustrations/topic-milestones.webp'),
  topicProducts: require('../assets/illustrations/topic-products.webp'),
  topicGeneral: require('../assets/illustrations/topic-general.webp'),

  // Empty states
  emptyCommunity: require('../assets/illustrations/empty-community.webp'),
  emptyLibrary: require('../assets/illustrations/empty-library.webp'),
  emptyFamily: require('../assets/illustrations/empty-family.webp'),
  emptyVaccines: require('../assets/illustrations/empty-vaccines.webp'),

  // Quick-action chips
  quickDiet: require('../assets/illustrations/quick-diet.webp'),
  quickSleep: require('../assets/illustrations/quick-sleep.webp'),
  quickVaccines: require('../assets/illustrations/quick-vaccines.webp'),
  quickMilestones: require('../assets/illustrations/quick-milestones.webp'),
  quickRecipes: require('../assets/illustrations/quick-recipes.webp'),
  quickSchemes: require('../assets/illustrations/quick-schemes.webp'),

  // Yoga poses
  yogaCatCow: require('../assets/illustrations/yoga-cat-cow.webp'),
  yogaChildsPose: require('../assets/illustrations/yoga-childs-pose.webp'),
  yogaSupineTwist: require('../assets/illustrations/yoga-supine-twist.webp'),
  yogaPelvicTilt: require('../assets/illustrations/yoga-pelvic-tilt.webp'),
  yogaBridge: require('../assets/illustrations/yoga-bridge.webp'),
  yogaSeatedForward: require('../assets/illustrations/yoga-seated-forward.webp'),
  yogaLegsUpWall: require('../assets/illustrations/yoga-legs-up-wall.webp'),
  yogaSavasana: require('../assets/illustrations/yoga-savasana.webp'),
} as const;

export type IllustrationName = keyof typeof illustrations;

// Tab-bar icons — small brand mini-illustrations, ~256×256.
// Distinct from full illustrations (above) so it's clear these are
// for chrome surfaces, not hero scenes.
export const tabIcons = {
  home: require('../assets/icons/tab-home.webp'),
  health: require('../assets/icons/tab-health.webp'),
  wellness: require('../assets/icons/tab-wellness.webp'),
  library: require('../assets/icons/tab-library.webp'),
  community: require('../assets/icons/tab-community.webp'),
  family: require('../assets/icons/tab-family.webp'),
  chat: require('../assets/icons/tab-chat.webp'),
  profile: require('../assets/icons/tab-profile.webp'),
} as const;

export type TabIconName = keyof typeof tabIcons;
