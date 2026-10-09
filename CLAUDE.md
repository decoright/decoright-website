# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` covers business rules, roles, and the request lifecycle. Read it too. This file covers what only becomes clear after reading several source files, plus the places where `AGENTS.md` and the other docs have drifted from the code (collected near the end).

---

## Commands

```bash
pnpm install
pnpm dev        # Vite dev server on http://localhost:5173
pnpm build      # tsc -b && vite build  <- type errors fail the build
pnpm lint       # eslint .
pnpm preview
```

There is no test framework. `pnpm build` is the only automated gate, so run it before merging anything to `main`.

`tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` and `noUncheckedSideEffectImports`. An unused import or a value-position type import breaks the production build even though `pnpm lint` stays green. Type-only imports must use `import type`.

Path aliases `@/` (src root) and `@components/` are declared twice, in `vite.config.ts` and in `tsconfig.app.json`. A new alias goes in both.

Local env: copy `.env.example` to `.env`. `src/lib/supabase.ts` accepts the client key under either `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`. Nothing else in `src/` reads env vars. Never give a secret a `VITE_` prefix, Vite inlines it into the bundle served to every visitor.

---

## Supabase client is rate limited in the browser

`src/lib/supabase.ts` wraps `fetch` with a client-side limiter before handing it to `createClient`. This is the single most important thing to know before writing data access code.

| Scope | Limit per 60s |
|-------|---------------|
| All Supabase requests | 120 |
| `/rest/v1/messages` | 70 |
| `/rest/v1/chat_rooms` | 50 |
| `/functions/v1/*` | 20 |

Exceeding any limit throws `rate_limited_client_global`, `rate_limited_client_endpoint`, or `rate_limited_client_cooldown` and starts a 15 second cooldown that blocks every request. The failure looks like a broken page, not a rate limit, so N+1 query loops and unthrottled realtime refetches are real bugs here.

The mitigation helpers live in `src/utils/request-guard.ts` and are used throughout the chat and dashboard code:

- `dedupeRequest(key, factory)` collapses concurrent identical calls into one promise.
- `throttleCall(key, minIntervalMs)` returns false to skip a call made too soon.
- `debounce(fn, waitMs)` for realtime event storms.

Follow the existing pattern when adding anything that fires on a Supabase Realtime event. `ChatContext` and `useUnreadCount` are good references.

---

## Architecture

### Routing

One `createBrowserRouter` call in `src/routers/AppRoutes.tsx` defines everything, with every page lazily imported. Three top-level branches wrap `PublicLayout`, `ClientLayout`, and `AdminLayout`.

Public routes and client routes both mount at `/`, distinguished only by the `RequireAuth` wrapper on the client branch. Adding a public path that collides with a client path is an easy mistake.

All paths live in `src/routers/Paths.ts` as a `const` object that also exports link generators such as `PATHS.ADMIN.requestServiceDetail(id)`. Never hardcode a route string. Add it to `Paths.ts` and use the generator.

### Auth and roles

`AuthProvider` reads the Supabase session, then fetches `profiles.role` and lowercases it, defaulting to `customer`. It re-runs on every `onAuthStateChange`.

Roles are `super_admin`, `admin`, and `customer` (`src/types/auth.ts`, `userRoles` in `src/constants`). Route protection is `RequireAuth` with an optional `role` prop. When `role="admin"` it checks the `isAdmin` boolean, which is true for both `admin` and `super_admin`. `RequireRole.tsx` and `RequireAdmin.tsx` also exist but are not wired into any route, and both redirect to `/unauthorized`, which has no route defined. Use `RequireAuth`.

Sign-in paths:

- Email and password. Signup is confirmed with a typed 6-digit code: `VerifyOtp.tsx` calls `verifyOtp`, so auth emails must carry a code, not a link (see the email hook below). `Signup.tsx` also puts `lang` into the `signUp` user metadata, which is what selects the email language. Keep that when touching signup.
- Google, through `signInWithOAuth` with `redirectTo` set to `PATHS.AUTH_CALLBACK` (`/auth/callback`). `src/pages/AuthCallback.tsx` is registered in the public branch, deliberately outside `RequireAuth`: the guard would race `detectSessionInUrl` and bounce the user to `/login` before the session lands. The page waits for `loading` to clear, then routes by role. The callback URL must also be listed under Redirect URLs in the Supabase dashboard; `docs/GOOGLE_AUTH.md` has the full setup and its current status.

### Chat: one live implementation and one dead one

Both the client and the admin chat pages render `src/components/chat/ChatLayout.tsx`, which mounts `ChatProvider` from `src/contexts/ChatContext.tsx`. That context holds the room list, messages, send, media upload and delete. `src/hooks/useChat.ts` is a thin re-export of its hook. The room id comes from the `:id` path param, which works under both `/client/chat/:id/` and `/admin/chat/:id`. `ChatRoom.tsx` is a nested route child under both pages. Admin versus client behaviour is decided by `window.location.pathname.startsWith('/admin')` in `ChatList` and `ChatHeader`, and by `isAdmin` from `useAuth` for delete permissions and sender labels.

`src/hooks/useAdminChat.ts` and `src/services/chat.service.ts` (`ChatService`) reimplement the same feature set but are not imported anywhere. `useAdminChat` reads a `?room=` search param that nothing sets. Do not extend them. Chat changes go in `ChatContext`.

Rooms are created automatically. `RequestService.createRequest` inserts the `service_requests` row and then a `chat_rooms` row for it, one to one. A chat room failure is logged but does not fail the request.

### Services

`src/services/*.service.ts` exports a plain object per domain, such as `RequestService`, `AdminService`, `PortfolioService` and `DeletionRequestService`. Services throw, components catch and toast.

Admin mutations should also call `ActivityLogService.logEvent`, which writes to `activity_logs`. `AdminService.getUsersActivity` reads the older `admin_activities` table, the one `AGENTS.md` lists. Both tables exist in the schema.

Lookup data is cached in `localStorage` with a TTL through `src/utils/local-cache.ts`: active service types, active space types, and site settings. Only the site-settings service patches its cache on write; nothing calls `clearCachedValue`. After an admin edits service or space types, the public site can show stale data until the TTL expires.

RPCs the frontend calls: `delete_user_account`, `phone_exists`, and `increment_project_view_count`. `public.is_admin()` backs the RLS policies. All are defined in the full setup script.

### Storage and uploads

Four public buckets, defined in `supabase/decoright_full_setup.sql`:

| Bucket | Written by |
|--------|------------|
| `request-attachments` | `RequestService` (request attachments) and `ChatContext` (chat media, keyed by room id as a path prefix) |
| `projects` | `AdminService` (project images) and `SpaceTypesService` (space-type images) |
| `service-types` | `ServiceTypesService` |
| `site-assets` | `SiteSettingsService` (logo and similar), also where the auth email logo lives |

`src/utils/file-upload.ts` owns validation: an explicit MIME allowlist plus an extension allowlist, 12 MB for images and 30 MB otherwise, with `prepareFileForUpload` compressing images first. Always route uploads through `validateUploadFile` and `prepareFileForUpload` rather than calling storage upload directly.

Read images back through `getOptimizedImageUrl` in `src/utils/supabase-image.ts`, which appends Supabase image-transform query params and passes non-storage URLs through untouched.

### Generated database types

`src/types/database.types.ts` is generated by the Supabase CLI or MCP. Do not hand-edit it. Its `Enums` block is the authoritative list of status values, and `request_status` includes `Cancelled`, which the lifecycle diagram in `AGENTS.md` omits.

Service code derives its types from it, for example the `Insert` type of the `service_requests` table.

### Database scripts

`supabase/decoright_full_setup.sql` is the canonical, idempotent, non-destructive whole-schema script. Its PART 1 (extensions and enums) must be run in its own SQL Editor execution before the rest, because Postgres cannot use a new enum value inside the transaction that created it. `supabase/migrations/` is the incremental history the script was folded from; `temp_migrations/` is a scratch copy and not a source of truth. A schema change means a migration, the same change in the full setup script, and regenerated types.

A separate Flutter customer app talks to the same Supabase project. Schema, RLS, RPC and auth-email changes affect it too. `docs/FLUTTER_BACKEND.md` and `docs/FLUTTER_SCREENS.md` describe what it depends on.

### Edge functions and auth email

`supabase/functions/send-auth-email/index.ts` is a Supabase Auth "Send Email" hook. Once registered, Supabase Auth stops sending mail itself and POSTs to this function, which delivers through Resend with inline EN/AR/FR templates. It is one file on purpose: a dashboard deploy uploads only the entry file, so a sibling `templates.ts` fails to bundle. Keep the templates inline.

`supabase/config.toml` sets `verify_jwt = false` for it because the hook authenticates with a Standard Webhooks signature, not a user JWT. Secrets, deploy steps and troubleshooting are in `supabase/functions/README.md`. Secrets only take effect on the next deploy.

Signup, email change, reauthentication and magic link emails carry a 6-digit code; recovery and invite carry a link. That mapping matches what `VerifyOtp.tsx` and `PasswordReset.tsx` expect, so change both sides together.

`src/components/ui/PhoneVerificationModal.tsx` invokes `send-otp` and `verify-otp` functions that are not in the repo. The modal itself is not imported anywhere.

### Account deletion

The public `/delete-account` page inserts into `deletion_requests`. Admins process those at `/admin/deletion-requests`. A signed-in user can also self-delete from account settings through the `delete_user_account` RPC. `docs/account_deletion.md` explains the Play Store requirement behind the public page.

---

## i18n

Translations are not bundled. The http backend fetches `/locales/{{lng}}/translation.json` at runtime from `public/locales/`, so a new key means editing three files: English, French, and Arabic. `react.useSuspense` is on, so the router-level `Suspense` fallback also covers translation loading. i18next runs with `debug: true`, so console noise from it is expected.

Language detection order is localStorage, cookie, then navigator, cached under the `i18nextLng` key. `src/utils/i18n.ts` sets the document `lang` and `dir` attributes on every language change and exports `isRTL`. Arabic is right to left, so any new layout needs RTL checking.

Multilingual database columns follow a language-suffix convention such as `display_name_en` and `display_name_ar`. Read them with `getLocalizedContent` from `src/utils/i18n.ts`, which falls back to English and then to the bare field.

---

## Styling

Tailwind 4 with CSS-first configuration. There is no `tailwind.config.js`. Everything lives in `src/index.css`:

- `@theme` and `@theme inline` define the token set. Brand colors are the `--acme-*` variables mapped onto the Tailwind color tokens, with extra breakpoints `xs`, `2xs`, `3xs` and text sizes `2xs`, `3xs`.
- Custom variants: `dark` keys off a `data-theme` attribute, and `lang-en`, `lang-fr`, `lang-ar` key off the `lang` attribute.
- Custom utilities used across pages: `h-hero`, `min-h-hero`, `content-container`, `min-scrollbar`, `custom-scrollbar`.
- The base layer styles bare elements. Paragraphs, links, spans, and labels are muted by default, and `section` gets horizontal padding automatically. Expect to override these rather than assume unstyled defaults.

`components.json` configures shadcn, but `src/components/ui/` is hand-written, with several components derived from Tremor. Match the neighbours rather than pulling in a shadcn component blindly. `cn` and `cx` in `src/lib/utils.ts` are both the same clsx plus tailwind-merge wrapper.

---

## Git and deployment

`dev` holds all work and `main` is production, auto-deploying to Netlify at `https://decoright-dz.com`. The exact merge sequence is written up in `.agent/workflows/push_to_main.md`. Conventional Commits and the `<type>/<issue>-<description>` branch naming are specified in `git_conventions.md`.

There is no `netlify.toml`; build settings and the `VITE_*` variables live in the Netlify UI. SPA routing depends on `public/_redirects`. `wrangler.jsonc` configures Cloudflare static assets and is secondary to the Netlify deployment.

The app talks to Supabase project `pibqqtjarlgqjpabbens`, per `VITE_SUPABASE_URL` and `supabase/config.toml`.

---

## Known drift and dead code

- `AGENTS.md` says roles are `admin | client`, lists the deployment as `decoright.netlify.app`, omits `Cancelled` from the lifecycle, and its table list is missing `legal_pages`, `deletion_requests`, `activity_logs` and `space_type_images`.
- `.env.example` refers to `supabase/create_admin.sql`, which is not in the repo.
- `opencode.json` points its Supabase MCP server at `iqdreqrottmwiyyhhfxm`, a different project from the one the app uses.
- `releases` at the repo root is a saved GitHub HTML page committed by accident. Ignore it.
- Unreferenced modules: `useAdminChat.ts`, `chat.service.ts`, `RequireRole.tsx`, `RequireAdmin.tsx`, `PhoneVerificationModal.tsx`.

---

## Reference documents in the repo

| File | Contents |
|------|----------|
| `supabase/decoright_full_setup.sql` | Canonical whole-schema script: tables, RLS, triggers, storage, realtime, seed |
| `supabase/functions/README.md` | Resend auth email hook: secrets, deploy, hook registration, troubleshooting |
| `AGENTS.md` | Business rules, roles, request lifecycle, conventions |
| `AGENTS_ERD.md` | Mermaid ERD with schema design notes |
| `DB_SCHEMA.md` | Raw JSON dump of every column and type |
| `UI_SCREENS.md` | Screen-by-screen description of the web UI |
| `docs/GOOGLE_AUTH.md` | Google sign-in setup for web, Android and iOS, with what is still outstanding |
| `docs/FLUTTER_BACKEND.md` | Backend and API reference for the Flutter client |
| `docs/FLUTTER_SCREENS.md` | Screen list for the Flutter client |
| `docs/account_deletion.md` | Account deletion flow, required for the Play Store |
| `supabase_setup_guide.md` | Project bootstrap steps |
