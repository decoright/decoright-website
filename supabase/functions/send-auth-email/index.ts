// ============================================================================
//  DecoRight — send-auth-email
//
//  A Supabase "Send Email" auth hook. Supabase stops sending auth mail through
//  its own SMTP and POSTs the message here instead, so it can be delivered via
//  Resend using our own branded, translated templates.
//
//    signup / email_change / reauthentication / magiclink -> a 6-digit code,
//      because VerifyOtp.tsx (web) and VerifyEmailScreen (Flutter app) call
//      supabase.auth.verifyOtp() with a typed token. The Flutter app's
//      "login with OTP" uses signInWithOtp, which arrives here as magiclink.
//    recovery / invite                                    -> a link, because
//      PasswordReset.tsx passes a redirectTo (the Flutter app passes the
//      decoright://reset-password deep link)
//
//  SINGLE FILE ON PURPOSE. The templates used to live in a sibling
//  templates.ts, but a dashboard deploy uploads only the entry file and the
//  bundler then fails with "Module not found ... templates.ts". Keeping
//  everything here means it deploys identically from the dashboard or the CLI.
//
//  SECURITY: the Resend API key is read from Supabase secrets, server side
//  only. In a Vite app it must never carry a VITE_ prefix or it ships to the
//  browser.
// ============================================================================

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

// ---------------------------------------------------------------------------
//  Email templates (EN / AR / FR)
//
//  Inline table markup with inline CSS: Gmail strips <style> blocks and most
//  clients do not support flexbox or grid.
//
//  src/index.css defines --acme-primary as oklch(0.5294 0.293075 293.6103).
//  No email client understands oklch, so it is converted to sRGB #7F00FF.
// ---------------------------------------------------------------------------

export type SupportedLang = 'en' | 'ar' | 'fr'

export type AuthAction =
  | 'signup'
  | 'recovery'
  | 'magiclink'
  | 'invite'
  | 'email_change'
  | 'reauthentication'

const BRAND = {
  name: 'Decoright',
  primary: '#7F00FF',
  primaryDark: '#5B00B5',
  ink: '#111111',
  body: '#4A4A4A',
  muted: '#8A8A8A',
  hairline: '#E6E6E6',
  surface: '#F6F5F8',
  page: '#FFFFFF',
}

// ---------------------------------------------------------------------------
//  Copy
//
//  `code` actions show a 6-digit OTP, because VerifyOtp.tsx calls
//  supabase.auth.verifyOtp() with a typed token. `link` actions show a
//  button, because PasswordReset.tsx relies on a redirect back into the app.
// ---------------------------------------------------------------------------

type Copy = {
  subject: string
  preheader: string
  heading: string
  greeting: (name: string | null) => string
  intro: string
  codeLabel?: string
  buttonLabel?: string
  expiry: string
  ignore: string
  trouble?: string
  footerHelp: string
}

const COPY: Record<SupportedLang, Record<AuthAction, Copy>> = {
  en: {
    signup: {
      subject: 'is your Decoright verification code',
      preheader: 'Enter this code to finish creating your account.',
      heading: 'Verify your account',
      greeting: (n) => (n ? `Hi ${n},` : 'Hi,'),
      intro: 'Welcome to Decoright. Enter the code below to finish creating your account.',
      codeLabel: 'Your verification code',
      expiry: 'This code expires in 60 minutes.',
      ignore: 'If you did not create a Decoright account, you can safely ignore this email.',
      footerHelp: 'Need help? Just reply to this email.',
    },
    recovery: {
      subject: 'Reset your Decoright password',
      preheader: 'Use the button below to choose a new password.',
      heading: 'Reset your password',
      greeting: (n) => (n ? `Hi ${n},` : 'Hi,'),
      intro: 'We received a request to reset the password for your Decoright account.',
      buttonLabel: 'Choose a new password',
      expiry: 'This link expires in 60 minutes and can only be used once.',
      ignore: 'If you did not request a password reset, you can safely ignore this email. Your password will not change.',
      trouble: 'If the button does not work, copy and paste this link into your browser:',
      footerHelp: 'Need help? Just reply to this email.',
    },
    magiclink: {
      subject: 'is your Decoright sign-in code',
      preheader: 'Enter this code to sign in.',
      heading: 'Sign in to Decoright',
      greeting: (n) => (n ? `Hi ${n},` : 'Hi,'),
      intro: 'Enter the code below to sign in to your Decoright account.',
      codeLabel: 'Your sign-in code',
      expiry: 'This code expires in 60 minutes and can only be used once.',
      ignore: 'If you did not try to sign in, you can safely ignore this email.',
      footerHelp: 'Need help? Just reply to this email.',
    },
    invite: {
      subject: "You've been invited to Decoright",
      preheader: 'Accept your invitation to get started.',
      heading: 'You have been invited',
      greeting: () => 'Hi,',
      intro: 'You have been invited to join Decoright. Accept the invitation to set up your account.',
      buttonLabel: 'Accept invitation',
      expiry: 'This invitation expires in 24 hours.',
      ignore: 'If you were not expecting this invitation, you can safely ignore this email.',
      trouble: 'If the button does not work, copy and paste this link into your browser:',
      footerHelp: 'Need help? Just reply to this email.',
    },
    email_change: {
      subject: 'Confirm your new Decoright email address',
      preheader: 'Confirm this address to finish the change.',
      heading: 'Confirm your new email',
      greeting: (n) => (n ? `Hi ${n},` : 'Hi,'),
      intro: 'Enter the code below to confirm this email address for your Decoright account.',
      codeLabel: 'Your confirmation code',
      expiry: 'This code expires in 60 minutes.',
      ignore: 'If you did not request this change, please contact us immediately.',
      footerHelp: 'Need help? Just reply to this email.',
    },
    reauthentication: {
      subject: 'Confirm it is you',
      preheader: 'Enter this code to confirm your identity.',
      heading: 'Confirm it is you',
      greeting: (n) => (n ? `Hi ${n},` : 'Hi,'),
      intro: 'Enter the code below to confirm your identity and continue.',
      codeLabel: 'Your confirmation code',
      expiry: 'This code expires in 60 minutes.',
      ignore: 'If you did not request this, please secure your account immediately.',
      footerHelp: 'Need help? Just reply to this email.',
    },
  },

  ar: {
    signup: {
      subject: 'هو رمز التحقق الخاص بك في Decoright',
      preheader: 'أدخل هذا الرمز لإكمال إنشاء حسابك.',
      heading: 'تحقق من حسابك',
      greeting: (n) => (n ? `مرحبًا ${n}،` : 'مرحبًا،'),
      intro: 'أهلًا بك في Decoright. أدخل الرمز أدناه لإكمال إنشاء حسابك.',
      codeLabel: 'رمز التحقق الخاص بك',
      expiry: 'تنتهي صلاحية هذا الرمز خلال 60 دقيقة.',
      ignore: 'إذا لم تقم بإنشاء حساب في Decoright، يمكنك تجاهل هذه الرسالة بأمان.',
      footerHelp: 'بحاجة إلى مساعدة؟ فقط قم بالرد على هذه الرسالة.',
    },
    recovery: {
      subject: 'إعادة تعيين كلمة مرور Decoright',
      preheader: 'استخدم الزر أدناه لاختيار كلمة مرور جديدة.',
      heading: 'إعادة تعيين كلمة المرور',
      greeting: (n) => (n ? `مرحبًا ${n}،` : 'مرحبًا،'),
      intro: 'تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في Decoright.',
      buttonLabel: 'اختر كلمة مرور جديدة',
      expiry: 'تنتهي صلاحية هذا الرابط خلال 60 دقيقة ويمكن استخدامه مرة واحدة فقط.',
      ignore: 'إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان. لن تتغير كلمة المرور الخاصة بك.',
      trouble: 'إذا لم يعمل الزر، انسخ هذا الرابط والصقه في متصفحك:',
      footerHelp: 'بحاجة إلى مساعدة؟ فقط قم بالرد على هذه الرسالة.',
    },
    magiclink: {
      subject: 'هو رمز تسجيل الدخول إلى Decoright',
      preheader: 'أدخل هذا الرمز لتسجيل الدخول.',
      heading: 'تسجيل الدخول إلى Decoright',
      greeting: (n) => (n ? `مرحبًا ${n}،` : 'مرحبًا،'),
      intro: 'أدخل الرمز أدناه لتسجيل الدخول إلى حسابك في Decoright.',
      codeLabel: 'رمز تسجيل الدخول',
      expiry: 'تنتهي صلاحية هذا الرمز خلال 60 دقيقة ويمكن استخدامه مرة واحدة فقط.',
      ignore: 'إذا لم تحاول تسجيل الدخول، يمكنك تجاهل هذه الرسالة بأمان.',
      footerHelp: 'بحاجة إلى مساعدة؟ فقط قم بالرد على هذه الرسالة.',
    },
    invite: {
      subject: 'لقد تمت دعوتك إلى Decoright',
      preheader: 'اقبل الدعوة للبدء.',
      heading: 'لقد تمت دعوتك',
      greeting: () => 'مرحبًا،',
      intro: 'لقد تمت دعوتك للانضمام إلى Decoright. اقبل الدعوة لإعداد حسابك.',
      buttonLabel: 'قبول الدعوة',
      expiry: 'تنتهي صلاحية هذه الدعوة خلال 24 ساعة.',
      ignore: 'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.',
      trouble: 'إذا لم يعمل الزر، انسخ هذا الرابط والصقه في متصفحك:',
      footerHelp: 'بحاجة إلى مساعدة؟ فقط قم بالرد على هذه الرسالة.',
    },
    email_change: {
      subject: 'تأكيد عنوان بريدك الإلكتروني الجديد في Decoright',
      preheader: 'أكد هذا العنوان لإتمام التغيير.',
      heading: 'تأكيد بريدك الإلكتروني الجديد',
      greeting: (n) => (n ? `مرحبًا ${n}،` : 'مرحبًا،'),
      intro: 'أدخل الرمز أدناه لتأكيد عنوان البريد الإلكتروني هذا لحسابك في Decoright.',
      codeLabel: 'رمز التأكيد الخاص بك',
      expiry: 'تنتهي صلاحية هذا الرمز خلال 60 دقيقة.',
      ignore: 'إذا لم تطلب هذا التغيير، يرجى الاتصال بنا فورًا.',
      footerHelp: 'بحاجة إلى مساعدة؟ فقط قم بالرد على هذه الرسالة.',
    },
    reauthentication: {
      subject: 'تأكيد هويتك',
      preheader: 'أدخل هذا الرمز لتأكيد هويتك.',
      heading: 'تأكيد هويتك',
      greeting: (n) => (n ? `مرحبًا ${n}،` : 'مرحبًا،'),
      intro: 'أدخل الرمز أدناه لتأكيد هويتك والمتابعة.',
      codeLabel: 'رمز التأكيد الخاص بك',
      expiry: 'تنتهي صلاحية هذا الرمز خلال 60 دقيقة.',
      ignore: 'إذا لم تطلب ذلك، يرجى تأمين حسابك فورًا.',
      footerHelp: 'بحاجة إلى مساعدة؟ فقط قم بالرد على هذه الرسالة.',
    },
  },

  fr: {
    signup: {
      subject: 'est votre code de vérification Decoright',
      preheader: 'Saisissez ce code pour terminer la création de votre compte.',
      heading: 'Vérifiez votre compte',
      greeting: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
      intro: 'Bienvenue chez Decoright. Saisissez le code ci-dessous pour terminer la création de votre compte.',
      codeLabel: 'Votre code de vérification',
      expiry: 'Ce code expire dans 60 minutes.',
      ignore: "Si vous n'avez pas créé de compte Decoright, vous pouvez ignorer cet e-mail.",
      footerHelp: 'Besoin d’aide ? Répondez simplement à cet e-mail.',
    },
    recovery: {
      subject: 'Réinitialisez votre mot de passe Decoright',
      preheader: 'Utilisez le bouton ci-dessous pour choisir un nouveau mot de passe.',
      heading: 'Réinitialisez votre mot de passe',
      greeting: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
      intro: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Decoright.',
      buttonLabel: 'Choisir un nouveau mot de passe',
      expiry: 'Ce lien expire dans 60 minutes et ne peut être utilisé qu’une seule fois.',
      ignore: "Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail. Votre mot de passe restera inchangé.",
      trouble: 'Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :',
      footerHelp: 'Besoin d’aide ? Répondez simplement à cet e-mail.',
    },
    magiclink: {
      subject: 'est votre code de connexion Decoright',
      preheader: 'Saisissez ce code pour vous connecter.',
      heading: 'Connectez-vous à Decoright',
      greeting: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
      intro: 'Saisissez le code ci-dessous pour vous connecter à votre compte Decoright.',
      codeLabel: 'Votre code de connexion',
      expiry: 'Ce code expire dans 60 minutes et ne peut être utilisé qu’une seule fois.',
      ignore: "Si vous n'avez pas tenté de vous connecter, vous pouvez ignorer cet e-mail.",
      footerHelp: 'Besoin d’aide ? Répondez simplement à cet e-mail.',
    },
    invite: {
      subject: 'Vous êtes invité à rejoindre Decoright',
      preheader: 'Acceptez votre invitation pour commencer.',
      heading: 'Vous avez été invité',
      greeting: () => 'Bonjour,',
      intro: 'Vous avez été invité à rejoindre Decoright. Acceptez l’invitation pour configurer votre compte.',
      buttonLabel: 'Accepter l’invitation',
      expiry: 'Cette invitation expire dans 24 heures.',
      ignore: "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
      trouble: 'Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :',
      footerHelp: 'Besoin d’aide ? Répondez simplement à cet e-mail.',
    },
    email_change: {
      subject: 'Confirmez votre nouvelle adresse e-mail Decoright',
      preheader: 'Confirmez cette adresse pour terminer le changement.',
      heading: 'Confirmez votre nouvelle adresse',
      greeting: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
      intro: 'Saisissez le code ci-dessous pour confirmer cette adresse e-mail pour votre compte Decoright.',
      codeLabel: 'Votre code de confirmation',
      expiry: 'Ce code expire dans 60 minutes.',
      ignore: "Si vous n'avez pas demandé ce changement, contactez-nous immédiatement.",
      footerHelp: 'Besoin d’aide ? Répondez simplement à cet e-mail.',
    },
    reauthentication: {
      subject: 'Confirmez votre identité',
      preheader: 'Saisissez ce code pour confirmer votre identité.',
      heading: 'Confirmez votre identité',
      greeting: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
      intro: 'Saisissez le code ci-dessous pour confirmer votre identité et continuer.',
      codeLabel: 'Votre code de confirmation',
      expiry: 'Ce code expire dans 60 minutes.',
      ignore: "Si vous n'êtes pas à l'origine de cette demande, sécurisez votre compte immédiatement.",
      footerHelp: 'Besoin d’aide ? Répondez simplement à cet e-mail.',
    },
  },
}

// Actions that show a typed code rather than a clickable button.
const CODE_ACTIONS: AuthAction[] = ['signup', 'email_change', 'reauthentication', 'magiclink']

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function normaliseLang(raw: unknown): SupportedLang {
  const value = String(raw ?? '').toLowerCase().split('-')[0]
  return value === 'ar' || value === 'fr' ? value : 'en'
}

export type RenderInput = {
  lang: SupportedLang
  action: AuthAction
  token: string
  actionUrl: string
  recipientName?: string | null
  logoUrl?: string
  siteUrl?: string
  supportEmail?: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

export function renderAuthEmail(input: RenderInput): RenderedEmail {
  const { lang, action, token, actionUrl } = input
  const copy = COPY[lang][action]
  const isRtl = lang === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  const usesCode = CODE_ACTIONS.includes(action)

  // Deliberately NOT escaped here. The greeting string this feeds into is
  // escaped as a whole below, and escaping twice would render a name like
  // O'Brien as O&#39;Brien in the delivered email.
  const name = input.recipientName || null
  const siteUrl = input.siteUrl || 'https://decoright-dz.com'
  const supportEmail = input.supportEmail || 'decoright26@gmail.com'

  // Subject: putting the code first makes it readable in a phone notification
  // without opening the message.
  const subject = usesCode && token ? `${token} ${copy.subject}` : copy.subject

  const fontStack = isRtl
    ? "'Segoe UI', Tahoma, Arial, sans-serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

  const logoBlock = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" width="44" height="44" alt="${BRAND.name}" style="display:block;border:0;border-radius:10px;" />`
    : `<div style="font-size:20px;font-weight:700;color:${BRAND.primary};letter-spacing:-0.3px;">${BRAND.name}</div>`

  const centrepiece = usesCode
    ? `
            <tr>
              <td align="center" style="padding:8px 0 4px 0;">
                <div style="font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:1px;padding-bottom:10px;">${escapeHtml(copy.codeLabel ?? '')}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td dir="ltr" align="center" style="background:${BRAND.surface};border:1px solid ${BRAND.hairline};border-radius:12px;padding:18px 28px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${BRAND.ink};">${escapeHtml(token)}</td>
                  </tr>
                </table>
              </td>
            </tr>`
    : `
            <tr>
              <td align="center" style="padding:10px 0 4px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="background:${BRAND.primary};border-radius:10px;">
                      <a href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${fontStack};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(copy.buttonLabel ?? '')}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`

  const troubleBlock =
    !usesCode && copy.trouble
      ? `
            <tr>
              <td align="${align}" style="padding:20px 0 0 0;font-family:${fontStack};font-size:12px;line-height:20px;color:${BRAND.muted};">
                ${escapeHtml(copy.trouble)}
                <br />
                <a dir="ltr" href="${escapeHtml(actionUrl)}" target="_blank" style="color:${BRAND.primaryDark};word-break:break-all;text-decoration:underline;">${escapeHtml(actionUrl)}</a>
              </td>
            </tr>`
      : ''

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(copy.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.surface};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND.page};border:1px solid ${BRAND.hairline};border-radius:16px;">
        <tr>
          <td style="padding:28px 32px 0 32px;" align="${align}">${logoBlock}</td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="${align}" style="font-family:${fontStack};font-size:22px;line-height:30px;font-weight:700;color:${BRAND.ink};padding-bottom:14px;">${escapeHtml(copy.heading)}</td>
              </tr>
              <tr>
                <td align="${align}" style="font-family:${fontStack};font-size:15px;line-height:24px;color:${BRAND.body};padding-bottom:6px;">${escapeHtml(copy.greeting(name))}</td>
              </tr>
              <tr>
                <td align="${align}" style="font-family:${fontStack};font-size:15px;line-height:24px;color:${BRAND.body};padding-bottom:22px;">${escapeHtml(copy.intro)}</td>
              </tr>
              ${centrepiece}
              <tr>
                <td align="${align}" style="font-family:${fontStack};font-size:13px;line-height:22px;color:${BRAND.muted};padding-top:20px;">${escapeHtml(copy.expiry)}</td>
              </tr>
              ${troubleBlock}
              <tr>
                <td style="padding:24px 0 0 0;"><div style="height:1px;background:${BRAND.hairline};line-height:1px;font-size:0;">&nbsp;</div></td>
              </tr>
              <tr>
                <td align="${align}" style="font-family:${fontStack};font-size:12px;line-height:20px;color:${BRAND.muted};padding-top:18px;">${escapeHtml(copy.ignore)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:20px 16px 0 16px;font-family:${fontStack};font-size:12px;line-height:20px;color:${BRAND.muted};">
            ${escapeHtml(copy.footerHelp)}<br />
            <a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND.muted};text-decoration:underline;">${escapeHtml(supportEmail)}</a>
            &nbsp;&middot;&nbsp;
            <a href="${escapeHtml(siteUrl)}" target="_blank" style="color:${BRAND.muted};text-decoration:underline;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  // Plain-text alternative. Sending text/plain alongside HTML measurably
  // improves inbox placement and is the only thing some corporate gateways read.
  const textLines = [
    copy.heading,
    '',
    copy.greeting(input.recipientName ?? null),
    copy.intro,
    '',
    usesCode ? `${copy.codeLabel}: ${token}` : `${copy.buttonLabel}: ${actionUrl}`,
    '',
    copy.expiry,
    '',
    copy.ignore,
    '',
    '---',
    `${BRAND.name} - ${siteUrl}`,
    supportEmail,
  ]

  return { subject, html, text: textLines.join('\n') }
}






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
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://decoright-dz.com'
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
