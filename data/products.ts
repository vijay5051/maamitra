export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  badge: string;
  emoji: string;
  description: string;
}

export const PRODUCTS: Product[] = [
  {
    id: 'p01',
    name: 'Medela Freestyle Breast Pump',
    category: 'Feeding',
    price: 8499,
    originalPrice: 10999,
    rating: 4.6,
    reviews: 342,
    badge: 'Best Seller',
    emoji: '🍼',
    description:
      'Hospital-grade double electric breast pump with quiet motor and hands-free operation. Includes two-phase expression technology that mimics natural nursing, making it ideal for working mothers. Comes with 4 breast shield sizes and a discreet carry bag.',
  },
  {
    id: 'p02',
    name: 'Himalaya Baby Diaper Rash Cream',
    category: 'Skincare',
    price: 249,
    originalPrice: 299,
    rating: 4.4,
    reviews: 1203,
    badge: 'Top Rated',
    emoji: '🌿',
    description:
      "Gentle, paediatrician-tested cream formulated with aloe vera and almond oil to soothe and protect baby's delicate skin from diaper rash. Free from parabens, mineral oils, and artificial fragrances. Suitable from birth.",
  },
  {
    id: 'p03',
    name: 'Mee Mee Nursing Pillow',
    category: 'Feeding',
    price: 1299,
    originalPrice: 1599,
    rating: 4.3,
    reviews: 567,
    badge: "Mom's Choice",
    emoji: '🤱',
    description:
      'Ergonomically designed C-shaped nursing pillow that supports baby at the ideal height for comfortable breastfeeding or bottle feeding. The removable, washable cover features a soft cotton-polyester blend. Doubles as a tummy time support and a sitting prop for older babies.',
  },
  {
    id: 'p04',
    name: 'Philips AVENT Video Baby Monitor',
    category: 'Sleep',
    price: 12999,
    originalPrice: 15999,
    rating: 4.5,
    reviews: 234,
    badge: 'Premium',
    emoji: '📷',
    description:
      '2.8-inch colour screen with night vision and 300 m range. Features two-way talk, temperature display, lullabies, and a DECT secure signal to prevent interference. Up to 10 hours battery life on the parent unit keeps you connected through the night.',
  },
  {
    id: 'p05',
    name: 'Marpac Hushh White Noise Machine',
    category: 'Sleep',
    price: 3499,
    originalPrice: 4299,
    rating: 4.7,
    reviews: 891,
    badge: 'Best Seller',
    emoji: '🔊',
    description:
      'Portable USB-rechargeable white noise machine with three soothing sound options: bright white noise, deep white noise, and gentle surf. Compact clip-on design attaches to a pram or cot. Research-backed for reducing newborn startle reflex and improving sleep duration.',
  },
  {
    id: 'p06',
    name: 'Fisher-Price Rainforest Play Mat',
    category: 'Development',
    price: 4299,
    originalPrice: 5499,
    rating: 4.5,
    reviews: 678,
    badge: 'Top Rated',
    emoji: '🌿',
    description:
      'Colourful activity gym with 5 removable, repositionable toys including a mirror, crinkle butterfly, and soft teether. Plays 20+ minutes of music and nature sounds. The padded mat provides a comfortable tummy time and back play surface that stimulates vision, motor skills, and sensory exploration.',
  },
  {
    id: 'p07',
    name: 'Ergobaby Omni 360 Baby Carrier',
    category: 'Mother',
    price: 15999,
    originalPrice: 18999,
    rating: 4.8,
    reviews: 445,
    badge: 'Premium',
    emoji: '👶',
    description:
      'All-position carrier supports newborn to toddler (3.2–20 kg) in front-facing-in, front-facing-out, hip, and back carry positions with no infant insert needed. The lumbar support waistbelt and padded shoulder straps distribute weight evenly, making it comfortable for all-day wear.',
  },
  {
    id: 'p08',
    name: 'Lansinoh Nipple Cream',
    category: 'Feeding',
    price: 699,
    originalPrice: 899,
    rating: 4.6,
    reviews: 2341,
    badge: 'Best Seller',
    emoji: '💊',
    description:
      'HPA Lanolin nipple cream — 100% natural, ultra-pure, and safe for baby; no need to wipe off before feeding. Clinically proven to restore and protect cracked or sore nipples caused by breastfeeding. Hypoallergenic and free from preservatives, fragrances, and additives. The go-to cream recommended by lactation consultants.',
  },
  {
    id: 'p09',
    name: 'Chicco Trio Travel System',
    category: 'Sleep',
    price: 32999,
    originalPrice: 39999,
    rating: 4.4,
    reviews: 123,
    badge: 'Premium',
    emoji: '🛒',
    description:
      '3-in-1 travel system combining a pram, car seat, and carrycot. The lightweight aluminium frame folds in one step. The KeyFit 30 infant car seat clicks directly onto the pram chassis without an adaptor, making transitions from car to stroller seamless. Suitable from birth up to 22 kg.',
  },
  {
    id: 'p10',
    name: 'Nuby Silicone Baby Teether',
    category: 'Development',
    price: 399,
    originalPrice: 499,
    rating: 4.2,
    reviews: 892,
    badge: 'Value Pick',
    emoji: '😁',
    description:
      'BPA-free, food-grade silicone teether with multiple textures to soothe sore gums during teething. The soft nubs massage the gums gently while the easy-grip handle makes it simple for small hands to hold. Dishwasher-safe and freezer-safe for added soothing relief.',
  },
  {
    id: 'p11',
    name: 'Mama Earth Stretch Marks Oil',
    category: 'Mother',
    price: 499,
    originalPrice: 649,
    rating: 4.3,
    reviews: 1567,
    badge: 'Top Rated',
    emoji: '🌸',
    description:
      "Lightweight, fast-absorbing body oil with rosehip oil, almond oil, and cocoa butter to nourish skin and reduce the appearance of stretch marks. Free from parabens, mineral oils, and sulphates. Dermatologically tested and safe for use during pregnancy and postpartum. India's top-selling stretch mark oil.",
  },
  {
    id: 'p12',
    name: 'Pigeon Nursing Bottle Set',
    category: 'Feeding',
    price: 1199,
    originalPrice: 1499,
    rating: 4.5,
    reviews: 2103,
    badge: 'Best Seller',
    emoji: '🍼',
    description:
      'Set of 3 nursing bottles (120ml, 240ml, 330ml) with Pigeon\'s SofTouch nipple, which has a skin-like texture and a wide base that makes latching natural and easy, reducing nipple confusion for breastfed babies. Made from safe, BPA-free PPSU plastic that withstands repeated sterilisation.',
  },
  {
    id: 'p13',
    name: 'Chicco Soft Relax Baby Bouncer',
    category: 'Development',
    price: 8999,
    originalPrice: 11999,
    rating: 4.4,
    reviews: 334,
    badge: "Mom's Choice",
    emoji: '🪑',
    description:
      'Ergonomically shaped bouncer seat with natural motion that responds to baby\'s movements. Features a vibrating seat motor for extra calming, a recline adjustment for different activities and feeding, and a removable play arch with 3 hanging toys. Suitable from birth to 9 kg.',
  },
  {
    id: 'p14',
    name: 'Morisons Baby Dreams Bath Sponge',
    category: 'Skincare',
    price: 299,
    originalPrice: 349,
    rating: 4.1,
    reviews: 678,
    badge: 'Value Pick',
    emoji: '🛁',
    description:
      'Ultra-soft natural sea sponge for gentle baby bathing. The naturally hypoallergenic material is free from dyes, bleaches, and chemicals, making it safe for even the most sensitive newborn skin. Holds a rich lather with minimal product and dries quickly to prevent mould and bacteria build-up.',
  },
  {
    id: 'p15',
    name: 'Boldfit Postpartum Belly Wrap',
    category: 'Mother',
    price: 799,
    originalPrice: 1199,
    rating: 4.3,
    reviews: 2891,
    badge: 'Best Seller',
    emoji: '🤰',
    description:
      "3-in-1 postpartum belly wrap providing targeted support for the abdomen, waist, and pelvis after delivery. The breathable cotton-spandex blend with hook-and-eye closure allows gradual size adjustment. Suitable for both vaginal and C-section recovery. India's best-selling postpartum support garment.",
  },
];
