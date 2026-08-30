export const site = {
  name: "Jess O'Neill",
  tagline: 'Travel · Food · Beauty · Lifestyle',
  heroTitle: 'Stories, Style & Everyday Life',
  description:
    'Travel discoveries, food favourites, beauty rituals, and lifestyle inspiration — shared from Jess O\'Neill.',
  url: 'https://www.jess-oneill.com',
  author: "Jess O'Neill",
  email: 'hello@jess-oneill.com',
} as const;

export const categories = [
  { slug: 'travel', label: 'Travel', description: 'Destinations, itineraries, and wanderlust' },
  { slug: 'food', label: 'Food', description: 'Restaurants, recipes, and culinary finds' },
  { slug: 'beauty', label: 'Beauty', description: 'Skincare, makeup, and self-care rituals' },
  { slug: 'lifestyle', label: 'Lifestyle', description: 'Wellness, home, and everyday joy' },
] as const;

export type Category = (typeof categories)[number]['slug'];

export const socialLinks = [
  {
    name: 'Instagram',
    url: 'https://instagram.com/jessoneill',
    icon: 'instagram',
  },
  {
    name: 'TikTok',
    url: 'https://tiktok.com/@jessoneill',
    icon: 'tiktok',
  },
  {
    name: 'YouTube',
    url: 'https://youtube.com/@jessoneill',
    icon: 'youtube',
  },
  {
    name: 'Pinterest',
    url: 'https://pinterest.com/jessoneill',
    icon: 'pinterest',
  },
] as const;
