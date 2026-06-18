# Decoright — Account Deletion (Google Play requirement)

This document is for the **website developer**. Google Play requires every app that lets
users create an account to publish a **public web page** explaining how a user can request
deletion of their account and data. The URL of that page is submitted in Google Play Console.

- **App:** Decoright
- **Android package:** `com.decoright.design`
- **Backend:** Supabase
- **Support contact:** support@decoright.dz

---

## 1. The URL to give Google Play

Build and publish a page at this address:

```
https://decoright-dz.com/delete-account
```

This is the link that gets pasted into:

> Google Play Console → your app → **App content** → **Data safety** →
> *"Provide a URL where users can request account deletion"*
> (also shown under **Account deletion** in the Data safety section).

Requirements Google enforces for this page:

- ✅ Must be **publicly accessible** — no login, no app install required to view it.
- ✅ Must clearly explain **how** to request deletion.
- ✅ Must state **what data is deleted** and **what (if anything) is retained** and for how long.
- ✅ Must work without the user needing to open the app.

---

## 2. What the page must contain

A simple static page is enough for Google. At minimum:

1. A heading: **"Delete your Decoright account"**.
2. Two ways to request deletion (see below).
3. A short list of what gets deleted vs. retained.
4. The support email: `support@decoright.dz`.

Provide it in the app's languages if possible: **French, Arabic, English**.

### Option A — In-app (already available, just describe it)

Users who still have the app installed can delete the account themselves:

> Open the Decoright app → **Settings** → **Delete Account** → confirm.

This already works in the app. The page only needs to *describe* these steps.

### Option B — Web request form (this is what you build)

For users who no longer have the app, add a form that collects:

- Email address used in the account (required)
- Optional message

On submit, either:

- **Simplest / recommended:** send the request to `support@decoright.dz` (or store it in a
  `deletion_requests` table) and have support process it within the stated window. Show a
  confirmation message: *"We received your request. Your account will be deleted within 30 days.
  A confirmation email will be sent to you."*
- **Full self-service:** verify the user's identity (e.g. magic-link / OTP to the email) and then
  call the same backend deletion routine the app uses (see section 3). Do **not** delete based on
  an unverified email — that would let anyone delete someone else's account.

---

## 3. Backend — how deletion actually happens

The app deletes accounts through a Supabase RPC. The web page should use the **same** routine so
behaviour stays consistent.

**RPC:** `delete_user_account`
**Parameter:** `p_user_id` (the authenticated user's UUID)

What the app does (`lib/data/services/auth_service.dart`):

```dart
final userId = _client.auth.currentUser?.id;
await _client.rpc('delete_user_account', params: {'p_user_id': userId});
await _client.auth.signOut();
```

Equivalent call from a web backend (only after the user's identity is verified):

```js
// Supabase JS — server side / after email verification
const { error } = await supabase.rpc('delete_user_account', {
  p_user_id: userId, // UUID of the verified user
});
```

> ⚠️ Never expose this call to an unauthenticated request. Identity must be verified first
> (signed-in session, or email magic-link/OTP), otherwise it can be abused to delete other users.

Supabase credentials live in the app's `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`);
the website should use its own server-side keys, never commit them to the repo.

---

## 4. What is deleted and what is kept

Fill this in to match what `delete_user_account` actually removes server-side, then publish it on
the page. Typical wording:

**Deleted permanently:**
- Profile (name, email, phone, avatar)
- Service requests and their details
- Chat conversations and messages
- Favorites and app preferences

**May be retained (and for how long):**
- Records required for legal, accounting, or fraud-prevention reasons — retained only as long as
  the law requires, then deleted.

> Confirm the exact behaviour of the RPC with whoever maintains the Supabase backend before
> publishing these lists, so the page is accurate.

---

## 5. Checklist before submitting to Google Play

- [ ] Page is live at `https://decoright-dz.com/delete-account` and loads without login.
- [ ] It describes the in-app path (Settings → Delete Account).
- [ ] It offers a web request method (form or `support@decoright.dz`).
- [ ] It lists deleted vs. retained data and the timeframe (e.g. within 30 days).
- [ ] URL pasted into Play Console → App content → Data safety → Account deletion.

---

*Maintained for the Decoright app. Last updated: 2026-06-18.*
