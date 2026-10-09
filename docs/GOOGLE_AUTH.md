# DecoRight - Google Sign-In Setup

Setup guide for enabling Google sign-in across the web app, the Android app and the iOS app, all against the same Supabase project.

**Status: the provider is enabled and the web flow is configured.** Verified against the live project:

| Check | Result |
|---|---|
| `external.google` in auth settings | `true` |
| `/auth/v1/authorize?provider=google` | 302 to `accounts.google.com` |
| Client ID sent to Google | the web client, `87209694897-o8atm…` |
| Redirect URI sent to Google | `https://pibqqtjarlgqjpabbens.supabase.co/auth/v1/callback` |
| Scopes requested | `email profile` |

Sections 3.2, 4.1 and 5 are done. What remains is the mobile work in 3.3, 3.4 and 5.2, plus the consent screen in 3.1 before external users can sign in.

One thing cannot be checked from outside: Supabase validates **Redirect URLs** when Google returns, not when the flow starts, so a missing entry there still produces a normal-looking redirect to Google and only fails at the end. Confirm section 4.2 by hand.

---

## 1. Project facts you will need

| Item | Value |
|---|---|
| Supabase project ref | `pibqqtjarlgqjpabbens` |
| Supabase URL | `https://pibqqtjarlgqjpabbens.supabase.co` |
| OAuth callback (goes into Google Cloud) | `https://pibqqtjarlgqjpabbens.supabase.co/auth/v1/callback` |
| Production website | `https://decoright-dz.com` |
| Local dev | `http://localhost:5173` |

To check whether the provider is live at any point, without opening the dashboard:

```bash
curl -s -H "apikey: <publishable-key>" \
  https://pibqqtjarlgqjpabbens.supabase.co/auth/v1/settings | grep -o '"google":[a-z]*'
```

---

## 2. How the two flows differ

This is the part that causes the most confusion, so read it before creating anything.

**Web** uses a redirect flow. The browser goes to Google, Google returns to the Supabase callback, Supabase then returns to your site. The client calls `signInWithOAuth`.

**Mobile** should use native sign-in. The Google SDK shows the account picker inside the app, returns an ID token, and you hand that token to Supabase with `signInWithIdToken`. There is no browser and no callback URL. Using the web redirect flow on mobile technically works but gives a worse experience, and Google is progressively restricting it.

Because of that split you need **three** OAuth clients in Google Cloud, not one.

| Client type | Required input | Used by |
|---|---|---|
| Web application | the Supabase callback URL above | the website, and as the *server client ID* for both mobile apps |
| Android | package name + SHA-1 fingerprint | the Android app |
| iOS | bundle identifier | the iOS app |

The Web client is not optional for mobile. Native Google Sign-In needs it as the server client ID, which is the audience Supabase validates the ID token against.

---

## 3. Google Cloud Console

### 3.1 Consent screen

APIs and Services → OAuth consent screen. Choose External. Fill in the app name, support email, and both policy links:

- `https://decoright-dz.com/legal/privacy-policy`
- `https://decoright-dz.com/legal/terms-of-service`

Both pages exist and return HTTP 200 publicly, so Google can fetch them. Google will not let external users sign in until this screen is complete.

> **Blocker: both pages are still placeholder text.** The privacy policy currently reads "Replace this placeholder from the admin panel" and is 237 characters long. Google reviewers read the privacy policy during verification, and a placeholder gets the submission rejected. Write real content at `/admin/legal-pages` before submitting the consent screen.
>
> The privacy policy in particular has to state what personal data is collected (name, email, phone, uploaded photos and plans, chat messages), why, how long it is kept, and how a user requests deletion. The deletion route already exists at `/delete-account` and should be named explicitly, since Google and the Play Store both look for it.

Scopes: `email`, `profile`, `openid`. Nothing more. Requesting extra scopes triggers a verification review you do not need.

### 3.2 Web client

Credentials → Create Credentials → OAuth client ID → Web application.

- Authorized JavaScript origins: `https://decoright-dz.com`, `http://localhost:5173`
- Authorized redirect URI: `https://pibqqtjarlgqjpabbens.supabase.co/auth/v1/callback`

Keep the Client ID and Client Secret. Both go into Supabase.

### 3.3 Android client

Credentials → Create Credentials → OAuth client ID → Android.

- Package name: the app's application ID, for example `com.decoright.app`
- SHA-1 certificate fingerprint

**You need two fingerprints, not one.** This is the single most common cause of "it works for us but not for real users".

```bash
# Debug build, for development
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

For release, do **not** use your upload keystore. Google Play re-signs the app, so the fingerprint that matters is the one under Play Console → Release → Setup → App signing → App signing key certificate. Add that SHA-1 as a second Android OAuth client, or the app will fail to sign in for everyone who installs it from the Play Store while working perfectly in your own testing.

No client secret is issued for Android clients. That is expected.

### 3.4 iOS client

Credentials → Create Credentials → OAuth client ID → iOS. Provide the bundle identifier.

### 3.5 Do you need to download the config files?

The credentials list shows a download icon on the Android and iOS rows. **No, you do not need those files.** They are a convenience wrapper around values you already have.

This project authenticates against Supabase, not Firebase. `google-services.json` and `GoogleService-Info.plist` are Firebase artifacts. Download them only if you separately adopt Firebase for something else, such as push notifications or analytics.

What each platform actually needs:

| Platform | Needs | Where it comes from |
|---|---|---|
| Android | nothing in the app bundle | the OAuth client existing with the correct package name and SHA-1 is the whole requirement |
| iOS | two values in the Xcode project | derived from the iOS client ID, see below |

Android is genuinely file-free. The `google_sign_in` plugin does not read a config file; it sends the `serverClientId` you pass in Dart, and Google matches the request against the package name and signing fingerprint. If those are registered, it works.

iOS needs two entries in `Info.plist`:

```xml
<key>GIDClientID</key>
<string>87209694897-6457msgl303ajunogc5e722cg211pi63.apps.googleusercontent.com</string>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.87209694897-6457msgl303ajunogc5e722cg211pi63</string>
    </array>
  </dict>
</array>
```

The URL scheme is the **reversed client ID**: take the iOS client ID, drop `.apps.googleusercontent.com`, and put `com.googleusercontent.apps.` in front. Nothing needs downloading to work that out.

---

## 4. Supabase configuration

### 4.1 Enable the provider

Authentication → Providers → Google:

1. Toggle **Enable Sign in with Google** on.
2. **Client IDs**: a comma-separated list of **all three** client IDs, web first. No spaces after the commas.
3. **Client Secret (for OAuth)**: the secret from the **Web** client only. Android and iOS clients do not issue secrets.
4. **Skip nonce checks**: leave off. Turn it on only if the Flutter app later fails with a nonce mismatch, since some Google SDK configurations do not expose one.
5. Save.

A client ID is a long string ending in `.apps.googleusercontent.com`, for example
`87209694897-o8atm….apps.googleusercontent.com`. It is **not** the display name you
gave the client in Google Cloud. Pasting the name produces
"Invalid characters. Google Client IDs should be a comma-separated list of
domain-like strings." Copy the real value with the copy icon in the Client ID
column of the credentials list.

All three IDs belong in that single box. The web one serves the website; the Android
and iOS ones are what let Supabase accept an ID token minted for a mobile app. Omit
them and the website works while both mobile apps fail with an unhelpful error.

> Older Supabase dashboards split this into a `Client ID` field plus a separate
> `Authorized Client IDs` field. If yours looks like that, put the web ID in the
> first and the two mobile IDs in the second. The effect is identical.

Copying the callback URL out of this page does not enable anything. The provider stays disabled until the client IDs and secret are saved.

### 4.2 URL configuration

Authentication → URL Configuration:

| Field | Value |
|---|---|
| Site URL | `https://decoright-dz.com` |
| Redirect URLs | `https://decoright-dz.com/**`, `http://localhost:5173/**`, `com.decoright.app://login-callback` |

The wildcards matter. Without them Supabase refuses the return trip and the user lands back on the login page with no visible error. The third entry is the mobile deep link and is only needed if the app ever uses the redirect flow or password reset links.

---

## 5. Client code

### 5.1 Web

Implemented and complete. No further code work is needed on the web side.

Both `src/components/layout/Login.tsx` and `src/components/layout/Signup.tsx` call:

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}${PATHS.AUTH_CALLBACK}` },
})
```

`src/pages/AuthCallback.tsx` handles the return. It waits for the session to
settle, then sends admins to the admin dashboard and everyone else to the client
home. If Google refuses or the user cancels, it reads the error from the query
string or the hash fragment and shows it with a link back to login.

That page sits **outside** `RequireAuth` on purpose. Wrapping it would race the
guard against Supabase's session detection and bounce the user to `/login` before
the session exists.

The route is `PATHS.AUTH_CALLBACK`, defined in `src/routers/Paths.ts`. Change it
there and the constant flows to both buttons and the router, but remember the new
path must also be added to Redirect URLs in the dashboard.

### 5.2 Flutter, native sign-in

Client IDs are not secrets. They ship inside the app binary and the web bundle, so
they are safe to commit. The client *secret* is the one that must stay in Supabase.

```dart
// Web client. Used as serverClientId on BOTH platforms, not just web.
const webClientId = '87209694897-o8atmhns6318n01p2ifad3ou37l240si.apps.googleusercontent.com';
// iOS client.
const iosClientId = '87209694897-6457msgl303ajunogc5e722cg211pi63.apps.googleusercontent.com';

final googleSignIn = GoogleSignIn(
  clientId: iosClientId,      // iOS only
  serverClientId: webClientId, // both platforms
);

final googleUser = await googleSignIn.signIn();
final googleAuth = await googleUser!.authentication;

await supabase.auth.signInWithIdToken(
  provider: OAuthProvider.google,
  idToken: googleAuth.idToken!,
  accessToken: googleAuth.accessToken,
);
```

`serverClientId` must be the **Web** client ID. Passing the Android client ID there is a frequent mistake and produces a token Supabase will not accept.

---

## 6. What happens to the account afterwards

Worth knowing before you test, because the data differs from an email signup.

A Google account arrives with `full_name`, `email` and `avatar_url` in its metadata, but **no phone number and no password**. Email signup collects both.

- A profile row is created automatically by the `handle_new_user` database trigger, with role `customer`.
- `profiles.phone` will be null. The database permits this, and the unique index on phone ignores null values, so any number of Google users can coexist.
- The user has no password. The app has a password-set route for third-party signups at `/password/set`.
- Auth emails sent to these users will be in English, because the language is captured from the signup form and Google users never see it.

Nobody is granted admin by signing in with Google. Every new account is a customer, and the database blocks self-promotion.

---

## 7. Checklist

Do these in order. Confirm the web flow before starting mobile, so you are debugging one thing at a time.

- [ ] Real privacy policy and terms written at /admin/legal-pages (currently placeholder)
- [ ] OAuth consent screen completed with both policy URLs
- [x] Web client created with the Supabase callback URI
- [x] Client IDs and Secret saved in Supabase, provider toggled on (verified live)
- [ ] Site URL and Redirect URLs set
- [x] `/auth/callback` route implemented (src/pages/AuthCallback.tsx)
- [ ] Web sign-in tested on production and localhost
- [ ] Android client created with the **debug** SHA-1
- [ ] Android client created with the **Play App Signing** SHA-1
- [ ] iOS client created with the bundle ID
- [x] All three client IDs listed in the Supabase Client IDs box
- [ ] Deep link scheme added to Redirect URLs
- [ ] Native sign-in tested on a real Android device from an internal Play track

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Unsupported provider: provider is not enabled` | Provider never saved with credentials | Section 4.1 |
| `redirect_uri_mismatch` from Google | Callback URI missing or mistyped in Google Cloud | Must match section 1 exactly, including `https` |
| Sign-in returns to the login page silently | Site URL or Redirect URLs not set | Section 4.2 |
| Works on web, fails on mobile with an invalid token | Android/iOS client IDs missing from the Client IDs box | Section 4.1 step 2 |
| `Invalid characters. Google Client IDs should be...` | Pasted the client display name, not its ID | Use the value ending `.apps.googleusercontent.com` |
| Works in debug, fails for Play Store users | Release SHA-1 not registered | Section 3.3, use the Play App Signing fingerprint |
| User authenticated but lands on an error page | site deployed before the callback route shipped | redeploy; the route exists as of this doc |
| `Error 403: access_denied` | Consent screen still in Testing mode | Publish it, or add the tester's address |

---

## 9. Related documents

| File | Contents |
|---|---|
| `docs/FLUTTER_BACKEND.md` | Backend and API reference for the Flutter client |
| `supabase/functions/README.md` | Auth email delivery through Resend |
| `supabase/decoright_full_setup.sql` | Full schema, RLS and the `handle_new_user` trigger |
| `supabase/create_admin.sql` | Creating an administrator account |
