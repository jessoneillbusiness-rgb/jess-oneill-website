/**
 * Modeling portfolio content — update measurements and add images here.
 * Drop photos into public/images/modeling/ and reference them below.
 */
export const modelingProfile = {
  headline: 'Model Portfolio',
  subheadline:
    'Editorial, commercial, and lifestyle work — available for bookings in NYC and on location.',
  intro:
    'Experienced in editorial, beauty, lifestyle, and brand campaigns. Based in New York City with availability for travel.',
  location: 'New York City',
  contactEmail: 'jessoneill.business@gmail.com',
  /** Set to your agency email if represented, e.g. jess@ykwtalent.com */
  bookingEmail: 'jessoneill.business@gmail.com',
  representedBy: null as string | null,

  /** Update with your current stats — leave blank to hide a row */
  measurements: {
    height: '5\'9" / 175 cm',
    bust: '32" / 81 cm',
    waist: '24" / 61 cm',
    hips: '34" / 86 cm',
    dress: '4 US / 8 UK',
    shoe: '8 US / 39 EU',
    hair: 'Brown',
    eyes: 'Hazel',
  },

  /** Additional details shown alongside measurements */
  details: [
    { label: 'Based in', value: 'New York City' },
    { label: 'Available for', value: 'Editorial · Commercial · Beauty · Lifestyle' },
    { label: 'Travel', value: 'Available on request' },
  ],

  /**
   * Portfolio images — add your work here.
   * Example:
   * { src: '/images/modeling/editorial-01.jpg', alt: 'Editorial shoot', caption: 'Vogue editorial', category: 'Editorial' }
   */
  portfolio: [
    {
      src: '/images/modeling/editorial-01.jpg',
      alt: "Jess O'Neill in a floral corset dress, editorial bedroom setting",
      caption: 'Editorial lifestyle',
      category: 'Editorial',
    },
    {
      src: '/images/modeling/lifestyle-01.jpg',
      alt: "Jess O'Neill in a pink dress on a terrace overlooking the mountains",
      caption: 'Travel & lifestyle',
      category: 'Lifestyle',
    },
    {
      src: '/images/modeling/commercial-01.jpg',
      alt: "Jess O'Neill in a polka dot dress on a terrace overlooking a lake",
      caption: 'Resort & destination',
      category: 'Commercial',
    },
    {
      src: '/images/modeling/portrait-01.jpg',
      alt: "Jess O'Neill smiling at an outdoor restaurant",
      caption: 'Outdoor portrait',
      category: 'Lifestyle',
    },
  ],
} as const;
