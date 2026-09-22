# Auth emails through Resend

Supabase's built-in email sender is capped at a handful of messages per hour and is explicitly not meant for production. This replaces it with Resend, while keeping the signup flow in the app exactly as it is.

The function in `send-auth-email/` is a Supabase **Send Email hook**. Once registered, Supabase Auth stops sending mail itself and POSTs the message to this function instead.

| Flow in the app | What the email contains | Why |
|---|---|---|
| Signup | A 6-digit code | `VerifyOtp.tsx` calls `verifyOtp()` with a typed token |
| Password reset | A button linking back to the app | `PasswordReset.tsx` passes a `redirectTo` |
| Email change, reauthentication | A 6-digit code | Same verification mechanism as signup |
| Magic link, invite | A button | Link-based by nature |

Emails are sent in English, Arabic or French, chosen from `user_metadata.lang`. Arabic renders right to left.

---

## Before you start: the sending domain

This is the one thing that will block you, so deal with it first.

Resend will only send from a domain you have verified with DNS records. You cannot verify `decoright.netlify.app`, because Netlify owns that domain and you cannot add DNS records to it.

Your options:

1. **Use a domain you own.** Add it in Resend under Domains, create the DKIM and SPF records it gives you at your registrar, and wait for verification. Then send from something like `no-reply@yourdomain.com`.
2. **Test first with `onboarding@resend.dev`.** Resend allows this without any setup, but it will **only deliver to the email address your Resend account is registered with**. Good enough to confirm the wiring works, useless for real customers.

Everything below works either way. Set `AUTH_EMAIL_FROM` accordingly.

---

## Step 1 — Install the CLI and link the project

```bash
npm install -g supabase
supabase login
supabase link --project-ref iqdreqrottmwiyyhhfxm
```

## Step 2 — Set the secrets

These live in Supabase, never in the frontend. A Vite app inlines any variable starting with `VITE_` into the JavaScript bundle it ships to the browser, so a key named that way would be readable by anyone who opens devtools. The Resend key must never have that prefix.

```bash
supabase secrets set \
  RESEND_API_KEY="re_your_key_here" \
  AUTH_EMAIL_FROM="Decoright <no-reply@yourdomain.com>" \
  AUTH_EMAIL_REPLY_TO="decoright26@gmail.com" \
  PUBLIC_SITE_URL="https://decoright.netlify.app" \
  SUPPORT_EMAIL="decoright26@gmail.com"
```

Optional, for a logo in the email header. It must be a public absolute URL, so upload it to the `site-assets` bucket and paste the public URL:

```bash
supabase secrets set BRAND_LOGO_URL="https://<project>.supabase.co/storage/v1/object/public/site-assets/logo/logo.png"
```

`SUPABASE_URL` is injected automatically. You do not set it.

| Secret | Required | Default if unset |
|---|---|---|
| `RESEND_API_KEY` | Yes | none, the function returns 500 |
| `SEND_EMAIL_HOOK_SECRET` | Yes, see step 4 | signature check is skipped and a warning is logged |
| `AUTH_EMAIL_FROM` | Recommended | `Decoright <onboarding@resend.dev>` |
| `AUTH_EMAIL_REPLY_TO` | No | no reply-to header |
| `PUBLIC_SITE_URL` | No | `https://decoright.netlify.app` |
| `SUPPORT_EMAIL` | No | `decoright26@gmail.com` |
| `BRAND_LOGO_URL` | No | wordmark text instead of an image |

## Step 3 — Deploy the function

```bash
supabase functions deploy send-auth-email
```

`supabase/config.toml` already sets `verify_jwt = false` for this function. That matters: the hook authenticates with a webhook signature rather than a user JWT, so with the default setting every delivery would be rejected with a 401 before the code runs. If you deploy without the config file for any reason, pass the flag instead:

```bash
supabase functions deploy send-auth-email --no-verify-jwt
```

## Step 4 — Register the hook

In the Supabase dashboard:

1. Go to **Authentication → Hooks**.
2. Find **Send Email hook** and enable it.
3. Choose **HTTPS** as the type.
4. URL: `https://iqdreqrottmwiyyhhfxm.supabase.co/functions/v1/send-auth-email`
5. Copy the generated secret. It looks like `v1,whsec_...`.
6. Save.

Then give that secret to the function and redeploy:

```bash
supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_paste_it_here"
supabase functions deploy send-auth-email
```

Do not skip this. Without the secret the function URL is a public endpoint, and anyone who finds it could POST to it and send mail from your verified domain.

## Step 5 — Confirm email is actually required

**Authentication → Providers → Email → Confirm email** must be on. If it is off, Supabase creates accounts without sending anything and the verification screen will sit there waiting for a code that was never sent.

## Step 6 — Test

Sign up with a real address. If you are still on `onboarding@resend.dev`, it has to be the address on your Resend account.

Watch it happen:

```bash
supabase functions logs send-auth-email --tail
```

A success logs a line like `{"event":"auth_email_sent","resend_id":"...","action":"signup","lang":"en"}`. The message also shows up in the Resend dashboard under Emails.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 in the function logs | `verify_jwt` is still on | Redeploy with the config file, or `--no-verify-jwt` |
| `Invalid signature` | Secret mismatch | Re-copy the secret from the dashboard, set it, redeploy |
| `Email service is not configured` | `RESEND_API_KEY` unset | `supabase secrets set RESEND_API_KEY=...` then redeploy |
| Resend returns 403 | Sending from an unverified domain | Verify the domain, or use `onboarding@resend.dev` |
| Resend returns 422 | `AUTH_EMAIL_FROM` is malformed | Use the exact form `Name <address@domain>` |
| Nothing sends at all | Hook not enabled, or confirm-email is off | Steps 4 and 5 |
| Email arrives but the code is rejected | Code already used, or expired | Codes are single-use and last 60 minutes |
| "Email rate limit exceeded" | Supabase auth rate limit, separate from Resend | **Authentication → Rate Limits**, raise the email limit |

Secrets only take effect on a deploy. After any `supabase secrets set`, run `supabase functions deploy send-auth-email` again.

---

## Rate limits worth knowing

Three separate limits apply, and they are easy to confuse.

- **Supabase auth rate limit.** Caps how often Auth will issue an email per user and overall. Raise it under Authentication → Rate Limits once you are off the built-in sender.
- **Resend plan limit.** The free plan allows 100 emails per day and 3,000 per month. Check your plan before launch.
- **The browser-side limiter in `src/lib/supabase.ts`.** Unrelated to email, but it caps `/functions/v1/*` at 20 requests per minute from a single page session, which can bite during rapid manual testing.

---

## Simpler alternative: Resend over SMTP

If you do not need per-language templates, you can skip this function entirely and point Supabase's own mailer at Resend. Roughly five minutes of work, no code, no deploys.

**Project Settings → Authentication → SMTP Settings**, enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | an address on your verified domain |
| Sender name | `Decoright` |

Then edit **Authentication → Email Templates → Confirm signup** so it contains `{{ .Token }}`. The stock template only has `{{ .ConfirmationURL }}`, and the app asks the user to type a 6-digit code, so without that change the email will not carry anything usable.

The trade-off: one template for everyone, in one language. Arabic and French customers get English mail. That is the reason this project uses the hook instead.

You cannot use both. Registering the Send Email hook overrides the SMTP settings for auth mail.

---

## Related frontend changes

Two edits were made so this works end to end.

- `src/components/layout/Signup.tsx` now passes `lang` into `signUp()` metadata, which is what selects the email language. Users who registered before this change get English.
- `src/lib/supabase.ts` now accepts either `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`, because the local `.env` used the newer name while the code only read the older one, which stopped the app booting locally.
