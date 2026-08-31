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

/** Social profiles used for links and live follower counts */
export const socialChannels = [
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com/jess.oneill/',
    username: 'jess.oneill',
    icon: 'instagram',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    url: 'https://www.tiktok.com/imjesschillin',
    username: 'imjesschillin',
    icon: 'tiktok',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com/people/Jess-Oneill/',
    username: 'Jess-Oneill',
    icon: 'facebook',
  },
] as const;

/** @deprecated use socialChannels — kept for SocialLinks component */
export const socialLinks = socialChannels.map(({ name, url, icon }) => ({ name, url, icon }));
