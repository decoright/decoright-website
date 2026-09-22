// ============================================================================
//  DecoRight — send-auth-email
//
//  A Supabase "Send Email" auth hook. Once registered, Supabase stops sending
//  auth mail through its own built-in SMTP and POSTs the message here instead,
//  letting us deliver it through Resend with our own branded, translated
//  templates.
//
//  This keeps the existing frontend flow untouched:
//    * signup           -> a 6-digit code, because VerifyOtp.tsx calls
//                          supabase.auth.verifyOtp() with a typed token
//    * recovery         -> a link back into the app, because
//                          PasswordReset.tsx passes a redirectTo
//
//  Why a hook instead of just pointing Supabase at Resend over SMTP:
//  the hook gives per-user language selection (EN/AR/FR with correct RTL)
//  and full control of the markup. The SMTP route is simpler but renders
//  one template for everyone. See supabase/functions/README.md.
//
//  SECURITY: the Resend API key lives in Supabase secrets and is only ever
//  read here, server side. It must never be exposed to the browser, which in
//  a Vite app means it must never be named with a VITE_ prefix.
// ============================================================================

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import {
  normaliseLang,
  renderAuthEmail,
  type AuthAction,
  type SupportedLang,
} from './templates.ts'

// ---------------------------------------------------------------------------
//  Configuration
// ---------------------------------------------------------------------------

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

// Must be an address on a domain verified in Resend.
const EMAIL_FROM = Deno.env.get('AUTH_EMAIL_FROM') ?? 'Decoright <onboarding@resend.dev>'
const EMAIL_REPLY_TO = Deno.env.get('AUTH_EMAIL_REPLY_TO') ?? ''
const BRAND_LOGO_URL = Deno.env.get('BRAND_LOGO_URL') ?? ''
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://decoright.netlify.app'
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'decoright26@gmail.com'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// ---------------------------------------------------------------------------
//  Types mirroring the Supabase hook payload
// ---------------------------------------------------------------------------

type HookPayload = {
  user: {
    id: string
    email: string
    user_metadata?: Record<string, unknown> | null
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url?: string
    token_new?: string
    token_hash_new?: string
  }
}

const KNOWN_ACTIONS: AuthAction[] = [
  'signup',
  'recovery',
  'magiclink',
  'invite',
  'email_change',
  'reauthentication',
]

function toAuthAction(raw: string): AuthAction {
  const value = (raw || '').toLowerCase()

  // Supabase emits several email_change variants; they all use one template.
  if (value.startsWith('email_change')) return 'email_change'
  if (value === 'signup' || value === 'confirmation') return 'signup'

  return (KNOWN_ACTIONS as string[]).includes(value) ? (value as AuthAction) : 'signup'
}

/**
 * Pick the recipient's language.
 *
 * Signup.tsx passes `lang` in options.data, which lands in user_metadata.
 * Anything unrecognised, or a user who signed up before that change, falls
 * back to English.
 */
function resolveLang(metadata: Record<string, unknown> | null | undefined): SupportedLang {
  if (!metadata) return 'en'
  return normaliseLang(metadata.lang ?? metadata.language ?? metadata.locale)
}

function resolveName(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null
  const full = metadata.full_name ?? metadata.name
  if (typeof full !== 'string') return null
  const trimmed = full.trim()
  if (!trimmed) return null
  // First name only: friendlier, and avoids an awkwardly long greeting line.
  return trimmed.split(/\s+/)[0]
}

/**
 * Build the URL that confirms a link-based action.
 *
 * Supabase normally assembles this for you as {{ .ConfirmationURL }}. Once a
 * send hook is registered you get the raw token_hash instead and have to build
 * it yourself, against the project's auth endpoint rather than the site URL.
 */
function buildActionUrl(payload: HookPayload): string {
  const { token_hash, email_action_type, redirect_to } = payload.email_data

  // new URL() throws on an empty base. SUPABASE_URL is injected automatically
  // by the platform, but a local `supabase functions serve` without it would
  // otherwise crash the request instead of reporting a cause.
  const base = SUPABASE_URL || payload.email_data.site_url
  if (!base) {
    throw new Error('Neither SUPABASE_URL nor email_data.site_url is available')
  }

  const url = new URL('/auth/v1/verify', base)
  url.searchParams.set('token', token_hash)
  url.searchParams.set('type', email_action_type)
  if (redirect_to) url.searchParams.set('redirect_to', redirect_to)
  return url.toString()
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
//  Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: { message: 'Method not allowed' } }, 405)
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set on the function')
    return json({ error: { http_code: 500, message: 'Email service is not configured' } }, 500)
  }

  const raw = await req.text()

  // ---- Verify the request really came from Supabase Auth --------------------
  //
  // Without this, the function URL is a public endpoint that anyone could POST
  // to in order to send mail from your verified domain.
  let payload: HookPayload
  if (HOOK_SECRET) {
    try {
      const headers = Object.fromEntries(req.headers)
      // The dashboard shows the secret as `v1,whsec_...`; the library wants
      // only the base64 portion.
      const secret = HOOK_SECRET.replace(/^v1,\s*/, '').replace(/^whsec_/, '')
      const wh = new Webhook(secret)
      payload = wh.verify(raw, headers) as HookPayload
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return json({ error: { http_code: 401, message: 'Invalid signature' } }, 401)
    }
  } else {
    // Allowed only so the function can be smoke-tested locally before the
    // secret exists. Never leave it unset in production.
    console.warn('SEND_EMAIL_HOOK_SECRET is not set: skipping signature verification')
    try {
      payload = JSON.parse(raw) as HookPayload
    } catch {
      return json({ error: { http_code: 400, message: 'Malformed JSON body' } }, 400)
    }
  }

  const { user, email_data } = payload ?? {}
  if (!user?.email || !email_data) {
    return json({ error: { http_code: 400, message: 'Missing user or email_data' } }, 400)
  }

  // ---- Render ---------------------------------------------------------------
  const action = toAuthAction(email_data.email_action_type)
  const lang = resolveLang(user.user_metadata)

  let subject: string, html: string, text: string
  try {
    ;({ subject, html, text } = renderAuthEmail({
      lang,
      action,
      token: email_data.token,
      actionUrl: buildActionUrl(payload),
      recipientName: resolveName(user.user_metadata),
      logoUrl: BRAND_LOGO_URL,
      siteUrl: SITE_URL,
      supportEmail: SUPPORT_EMAIL,
    }))
  } catch (err) {
    console.error('Failed to render the email:', err)
    return json({ error: { http_code: 500, message: 'Could not build the email' } }, 500)
  }

  // ---- Send through Resend --------------------------------------------------
  const body: Record<string, unknown> = {
    from: EMAIL_FROM,
    to: [user.email],
    subject,
    html,
    text,
    headers: {
      // Tells Gmail and friends this is a transactional message tied to one
      // action, which keeps threads from collapsing together.
      'X-Entity-Ref-ID': `${user.id}:${action}:${email_data.token_hash}`,
    },
    tags: [
      { name: 'category', value: 'auth' },
      { name: 'action', value: action },
      { name: 'lang', value: lang },
    ],
  }
  if (EMAIL_REPLY_TO) body.reply_to = EMAIL_REPLY_TO

  let response: Response
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('Could not reach Resend:', err)
    return json({ error: { http_code: 502, message: 'Email provider unreachable' } }, 502)
  }

  if (!response.ok) {
    const detail = await response.text()
    console.error(`Resend rejected the message (${response.status}):`, detail)

    // Surfacing the provider's status lets Supabase decide whether to retry,
    // but the message shown to the end user stays generic.
    return json(
      {
        error: {
          http_code: response.status,
          message: 'Could not send the verification email. Please try again.',
        },
      },
      response.status === 429 ? 429 : 500,
    )
  }

  const sent = await response.json().catch(() => ({}))
  console.log(
    JSON.stringify({
      event: 'auth_email_sent',
      resend_id: (sent as { id?: string }).id ?? null,
      action,
      lang,
      user_id: user.id,
    }),
  )

  // An empty 200 tells Supabase Auth the message was handed off successfully.
  return json({}, 200)
})
