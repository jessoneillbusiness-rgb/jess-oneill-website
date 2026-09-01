export const mediaKit = {
  title: 'Media Kit',
  headline: 'Work with Jess O\'Neill',
  subheadline:
    'NYC-based creator sharing travel, food, beauty, and lifestyle with an engaged, style-forward audience.',
  contactEmail: 'jess@ykwtalent.com',
  location: 'New York City',
  niches: ['Travel', 'Food & Dining', 'Beauty', 'Fashion', 'Lifestyle', 'NYC Living'],
  audience: {
    summary:
      'Primarily US-based women aged 22–40 interested in elevated everyday living — where to eat, what to wear, where to travel, and how to feel good doing it.',
    highlights: [
      'Strong NYC & travel discovery content',
      'High-intent food, beauty, and lifestyle recommendations',
      'Authentic, relatable storytelling with a polished aesthetic',
      'Cross-platform presence on Instagram, TikTok, and Facebook',
    ],
  },
  offerings: [
    {
      title: 'Instagram',
      items: ['Feed posts & carousels', 'Reels', 'Stories & story sets', 'Link-in-bio features'],
    },
    {
      title: 'TikTok',
      items: ['Organic integrations', 'Dedicated videos', 'Trend-led content', 'Product seeding'],
    },
    {
      title: 'Facebook',
      items: ['Page posts', 'Cross-posted video', 'Community engagement'],
    },
    {
      title: 'Website',
      items: ['Dedicated journal features', 'Brand spotlight posts', 'Long-form reviews & guides'],
    },
  ],
  pressNote:
    'Instagram and TikTok stats update automatically. TikTok uses the official API when connected. Facebook shows follower count only until Meta API access is connected.',
} as const;
