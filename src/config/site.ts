export const site = {
  name: 'Abund NYC',
  tagline: 'Travel · Food · Beauty · Lifestyle',
  description:
    'Stories, discoveries, and inspiration from New York City and beyond — travel, food, beauty, and everyday living.',
  url: 'https://www.abundnyc.com',
  author: 'Abund NYC',
  email: 'hello@abundnyc.com',
} as const;

export const categories = [
  { slug: 'travel', label: 'Travel', description: 'Destinations, itineraries, and wanderlust' },
  { slug: 'food', label: 'Food', description: 'Restaurants, recipes, and culinary finds' },
  { slug: 'beauty', label: 'Beauty', description: 'Skincare, makeup, and self-care rituals' },
  { slug: 'lifestyle', label: 'Lifestyle', description: 'NYC living, wellness, and everyday joy' },
] as const;

export type Category = (typeof categories)[number]['slug'];

export const socialLinks = [
  {
    name: 'Instagram',
    url: 'https://instagram.com/abundnyc',
    icon: 'instagram',
  },
  {
    name: 'TikTok',
    url: 'https://tiktok.com/@abundnyc',
    icon: 'tiktok',
  },
  {
    name: 'YouTube',
    url: 'https://youtube.com/@abundnyc',
    icon: 'youtube',
  },
  {
    name: 'Pinterest',
    url: 'https://pinterest.com/abundnyc',
    icon: 'pinterest',
  },
] as const;
