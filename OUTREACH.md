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
| `RESEND_API_KEY` | Optional | Only needed for one-click dashboard send |
| `OUTREACH_FROM_EMAIL` | Optional | Verified sender for Resend |
| `OUTREACH_REPLY_TO` | Optional | Reply-to address (defaults to `jess@ykwtalent.com`) |

### 4. Set up Resend (optional — one-click send only)

Resend is **optional**. The default workflow opens Gmail or Outlook so you send from your own inbox.

If you want one-click sending from the dashboard without opening your mail app:

1. Create a free account at [resend.com](https://resend.com)
2. Verify your sending domain (`jess-oneill.com` or your agency domain)
3. Create an API key and add it as `RESEND_API_KEY`

## Sending with Gmail or Outlook (recommended)

No extra email service is required.

1. Review and edit the draft in `/outreach`
2. Click **Open in Gmail** or **Open in Outlook**
3. Your mail app opens with the recipient, subject, and body pre-filled
4. Send from there — it appears in your normal Sent folder and replies go to your inbox
5. Click **Mark as sent** in the dashboard to track what you've sent

This works with `jessoneill.business@gmail.com`, Outlook/Microsoft 365, and most mail apps via **Open in mail app**.

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
