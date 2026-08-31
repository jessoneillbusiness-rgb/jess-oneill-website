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
| `RESEND_API_KEY` | To send email | API key from [resend.com](https://resend.com) |
| `OUTREACH_FROM_EMAIL` | To send email | Verified sender, e.g. `Jess O'Neill <jess@ykwtalent.com>` |
| `OUTREACH_REPLY_TO` | Optional | Reply-to address (defaults to `jess@ykwtalent.com`) |

### 4. Set up Resend (email sending)

1. Create a free account at [resend.com](https://resend.com)
2. Verify your sending domain (`jess-oneill.com` or your agency domain)
3. Create an API key and add it as `RESEND_API_KEY`

Until Resend is configured, you can still add contacts and edit drafts — sending will show a setup message.

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
