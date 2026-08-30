# Abund NYC

A beautiful blog website for travel, food, beauty, and lifestyle content — built with [Astro](https://astro.build).

**Live domain:** [www.abundnyc.com](https://www.abundnyc.com)

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) to preview the site.

## Publishing a new post

1. Create a new `.md` file in `src/content/posts/`
2. Add frontmatter at the top:

```markdown
---
title: 'Your Post Title'
description: 'A short summary for cards and SEO.'
category: travel   # travel | food | beauty | lifestyle
pubDate: 2026-04-01
image: /images/categories/travel.svg
imageAlt: 'Description of the image'
---

Your post content here in Markdown...
```

3. Run `npm run build` to verify, then deploy (see below).

## Customization

Edit `src/config/site.ts` to update:

- Site name, tagline, and description
- Email address
- **Social media links** (Instagram, TikTok, YouTube, Pinterest)

Replace placeholder social URLs with your real profile links.

## Deploy for free

This site is a static site — no server or database needed. Recommended free hosts:

| Platform | Best for | Free tier |
|----------|----------|-----------|
| **Cloudflare Pages** | Best overall (fast CDN, free SSL, custom domain) | Unlimited sites, 500 builds/month |
| **Vercel** | Easiest GitHub integration | 100 GB bandwidth/month |
| **Netlify** | Simple drag-and-drop or Git deploy | 100 GB bandwidth/month |

### Recommended: Cloudflare Pages

1. Push this project to a GitHub repository
2. Sign up at [pages.cloudflare.com](https://pages.cloudflare.com)
3. Click **Create a project** → connect your GitHub repo
4. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **Save and Deploy**

### Connect your domain (www.abundnyc.com)

**If your domain is on Cloudflare:**

1. In Cloudflare Pages → your project → **Custom domains**
2. Add `abundnyc.com` and `www.abundnyc.com`
3. DNS is configured automatically

**If your domain is elsewhere (GoDaddy, Namecheap, etc.):**

1. In your hosting platform, add `abundnyc.com` and `www.abundnyc.com` as custom domains
2. The platform will give you DNS records (usually a CNAME for `www` pointing to their servers)
3. In your domain registrar's DNS settings, add:
   - `CNAME` record: `www` → `your-site.pages.dev` (or Vercel/Netlify URL)
   - `A` or `CNAME` for root `@` → follow your host's instructions for apex domain
4. Wait up to 48 hours for DNS propagation (usually much faster)

### Alternative: Vercel

1. Push to GitHub
2. Sign up at [vercel.com](https://vercel.com) → **Import Project**
3. Vercel auto-detects Astro — click **Deploy**
4. Add custom domain under **Settings → Domains**

## Project structure

```
src/
  config/site.ts       # Site settings & social links
  content/posts/       # Blog posts (Markdown)
  components/          # Reusable UI components
  layouts/             # Page layouts
  pages/               # Routes (homepage, blog, categories, about)
  styles/global.css    # Global styles
public/                # Static assets (images, favicon)
```

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
