# Media Kit Outreach

Private dashboard for sending your media kit to PR contacts **with approval before every send**.

**URL:** [jess-oneill.com/outreach](https://www.jess-oneill.com/outreach) (not linked in public navigation)

## How it works

1. **Add contacts** you find from your own research (brand sites, LinkedIn, PR directories, past collaborations).
2. **Generate draft emails** — one personalised draft per contact with your media kit link.
3. **Edit each email** — tailor the subject and body before sending.
4. **Approve & send** — nothing is sent until you click approve on that specific draft.

This is intentionally **not** fully automated. You stay in control of who you contact and exactly what they receive.

## One-time Cloudflare setup

### 1. Create a KV namespace

1. Cloudflare dashboard → **Workers & Pages** → **KV**
2. **Create a namespace** (e.g. `jess-outreach`)
3. Copy the namespace ID

### 2. Bind KV to your Pages project

1. Pages project → **Settings** → **Functions** → **KV namespace bindings**
2. Add binding:
   - **Variable name:** `OUTREACH_KV`
   - **KV namespace:** the one you created

### 3. Add environment variables

Pages project → **Settings** → **Environment variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `OUTREACH_ADMIN_PASSWORD` | Yes | Password to sign in at `/outreach` |
| `OUTREACH_SESSION_SECRET` | Recommended | Random string for session cookies |
| `RESEND_API_KEY` | For dashboard send | API key from [resend.com](https://resend.com) |
| `OUTREACH_FROM_EMAIL` | For dashboard send | Verified sender, e.g. `Jess O'Neill <partnerships@jess-oneill.com>` |
| `OUTREACH_REPLY_TO` | Recommended | Where replies go, e.g. `jessoneill.business@gmail.com` |
| `OUTREACH_BCC` | Optional | Inbox copy of sent emails (defaults to reply-to) |

### 4. Set up Resend (one-click send from the dashboard)

Resend sends emails from the dashboard on your behalf. Recommended setup:

#### From address (what contacts see)

Resend needs a **domain you control** — you can't send as `@gmail.com` because Google owns that domain.

Best options for you:

| Option | Example From address |
|--------|---------------------|
| **jess-oneill.com** (recommended) | `Jess O'Neill <partnerships@jess-oneill.com>` |
| **ykwtalent.com** (agency domain) | `Jess O'Neill <jess@ykwtalent.com>` |

Verify the domain in Resend by adding DNS records (Resend walks you through this). Since `jess-oneill.com` is already on Cloudflare, this is straightforward.

#### Replies (where responses land)

Set `OUTREACH_REPLY_TO` to the inbox you actually check — e.g. `jessoneill.business@gmail.com` or your Outlook address. When a PR contact hits **Reply**, their response goes there automatically.

#### Copies in your inbox

By default, a **BCC copy** of each sent email goes to your reply-to address so you have a record in Gmail/Outlook. Override with `OUTREACH_BCC` if needed.

#### Environment variables for Resend

| Variable | Example |
|----------|---------|
| `RESEND_API_KEY` | Your API key from resend.com |
| `OUTREACH_FROM_EMAIL` | `Jess O'Neill <partnerships@jess-oneill.com>` |
| `OUTREACH_REPLY_TO` | `jessoneill.business@gmail.com` |
| `OUTREACH_BCC` | `jessoneill.business@gmail.com` (optional — defaults to reply-to) |

#### Resend setup steps

1. Create a free account at [resend.com](https://resend.com)
2. **Domains** → add `jess-oneill.com` → add the DNS records Resend provides in Cloudflare
3. **API Keys** → create a key → add as `RESEND_API_KEY` in Cloudflare Pages
4. Add the variables above in Cloudflare Pages → Settings → Environment variables
5. Redeploy the site

## Sending with Gmail or Outlook (alternative)

If you prefer not to use Resend, you can still open pre-filled drafts in Gmail or Outlook from the dashboard — no API keys needed. See steps in the dashboard help text.

## CSV import format

Import multiple contacts at once with a CSV file:

```csv
name,email,company,role,category,notes
Alex Morgan,alex@brand.com,Glossier,PR Manager,Beauty,Met at beauty event
```

## Tips for finding PR contacts

- Brand press pages (`/press`, `/media`, `/contact`)
- LinkedIn searches: “PR manager” + brand or category
- PR agency rosters for brands you admire
- Past campaign credits on competitor creator posts

Always use publicly listed business emails and follow CAN-SPAM / GDPR best practices.

## Updating the default email template

Edit `functions/lib/outreach-templates.js` to change the default subject and body used when generating drafts.
