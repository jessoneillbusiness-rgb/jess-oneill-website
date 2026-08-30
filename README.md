# Jess O'Neill

A blog website for travel, food, beauty, and lifestyle content — built with [Astro](https://astro.build).

**Live domain:** [www.jess-oneill.com](https://www.jess-oneill.com)

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

- Site name, tagline, hero title, and description
- Email address
- **Social media links** (Instagram, TikTok, YouTube, Pinterest)

Replace placeholder social URLs with your real profile links.

## Deploy on Cloudflare Pages

This site is a static site — no server or database needed. Since you're moving **jess-oneill.com** to Cloudflare, Pages is the natural fit: free hosting, fast CDN, automatic SSL, and DNS managed in one place.

### Step 1: Move your domain to Cloudflare

1. Create a free account at [cloudflare.com](https://cloudflare.com)
2. Go to **Websites** → **Add a site** → enter `jess-oneill.com`
3. Cloudflare will scan your existing DNS records — review and continue
4. Cloudflare gives you two nameservers (e.g. `ada.ns.cloudflare.com`)
5. At your current domain registrar, replace the nameservers with Cloudflare's
6. Wait for activation (usually 24–48 hours, often faster)

Once active, Cloudflare manages DNS, SSL, and security for your domain.

### Step 2: Deploy the site to Cloudflare Pages

1. Push this project to a **GitHub** repository
2. In Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Select your repository
4. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **Save and Deploy**

Your site will be live at a `*.pages.dev` URL within a few minutes.

### Step 3: Connect www.jess-oneill.com

1. In your Pages project → **Custom domains** → **Set up a custom domain**
2. Add `jess-oneill.com` and `www.jess-oneill.com`
3. Because the domain is already on Cloudflare, DNS records are added automatically
4. Cloudflare provisions a free SSL certificate — your site will be live at `https://www.jess-oneill.com`

**Tip:** Set `www.jess-oneill.com` as the primary domain and redirect the bare `jess-oneill.com` to it (Cloudflare Pages offers this option when adding both domains).

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
