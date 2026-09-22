# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` in this repo covers business rules, roles, and the request lifecycle. Read it too. This file covers the parts that only become clear after reading several source files, plus places where `AGENTS.md` has drifted from the code.

---

## Commands

```bash
pnpm install
pnpm dev        # Vite dev server
pnpm build      # tsc -b && vite build  <- type errors fail the build
pnpm lint       # eslint .
pnpm preview
```

There is no test framework configured. `pnpm build` is the only automated gate, so run it before merging anything to `main`.

`tsconfig.app.json` enables `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and `verbatimModuleSyntax`. An unused import or a value-position type import breaks the production build even though `pnpm lint` stays green. Type-only imports must use `import type`.

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

Roles are `super_admin`, `admin`, and `customer`. `AGENTS.md` still says `admin | client`, which is wrong.

Route protection is `RequireAuth` with an optional `role` prop. When `role="admin"` it checks the `isAdmin` boolean, which is true for both `admin` and `super_admin`. `RequireRole.tsx` also exists but is not wired into any route, and it redirects to `/unauthorized`, which has no route defined. Use `RequireAuth` unless you also add that route.

### Two parallel chat implementations

This is the biggest source of confusion in the codebase. Both exist and both are live:

- `src/contexts/ChatContext.tsx` holds room list, messages, send, and delete. It reads the room id from the URL path param at `/client/chat/:id`. `src/hooks/useChat.ts` is a thin re-export of its context hook.
- `src/hooks/useAdminChat.ts` reimplements the same feature set on top of `ChatService`, reading the room from a `?room=` search param.

`src/components/chat/ChatRoom.tsx` is rendered as a nested route child under both the client and admin chat pages. Before changing chat behavior, check which of the two paths the screen you are editing actually uses.

Rooms are created automatically. `RequestService.createRequest` inserts the `service_requests` row and then inserts a `chat_rooms` row for it, one to one. A chat room failure is logged but does not fail the request.

### Services

`src/services/*.service.ts` exports a plain object per domain, such as `RequestService`, `ChatService`, `AdminService`, and `PortfolioService`. Services throw, components catch and toast.

Admin mutations should also call `ActivityLogService.logEvent`. Note that it writes to the `activity_logs` table, which is separate from the `admin_activities` table listed in `AGENTS.md`. Both exist in the schema.

### Storage and uploads

There is one bucket, `request-attachments`, shared by service-request attachments and chat media. Chat files are keyed by room id as a path prefix.

`src/utils/file-upload.ts` owns validation: an explicit MIME allowlist plus an extension allowlist, 12 MB for images and 30 MB otherwise, with `prepareFileForUpload` compressing images first. Always route uploads through `validateUploadFile` and `prepareFileForUpload` rather than calling storage upload directly.

Read images back through `getOptimizedImageUrl` in `src/utils/supabase-image.ts`, which appends Supabase image-transform query params and passes non-storage URLs through untouched.

### Generated database types

`src/types/database.types.ts` is generated by the Supabase CLI or MCP. Do not hand-edit it. Its `Enums` block is the authoritative list of status values, and `request_status` includes `Cancelled`, which the lifecycle diagram in `AGENTS.md` omits.

Service code derives its types from it, for example the `Insert` type of the `service_requests` table.

---

## i18n

Translations are not bundled. The http backend fetches `/locales/{{lng}}/translation.json` at runtime from `public/locales/`, so a new key means editing three files: English, French, and Arabic.

`src/utils/i18n.ts` sets the document `lang` and `dir` attributes on every language change and exports `isRTL`. Arabic is right to left, so any new layout needs RTL checking.

Multilingual database columns follow a language-suffix convention such as `display_name_en` and `display_name_ar`. Read them with `getLocalizedContent`, which falls back to English and then to the bare field.

---

## Styling

Tailwind 4 with CSS-first configuration. There is no `tailwind.config.js`. Everything lives in `src/index.css`:

- `@theme` and `@theme inline` define the token set. Brand colors are the `--acme-*` variables mapped onto the Tailwind color tokens.
- Custom variants: `dark` keys off a `data-theme` attribute, and `lang-en`, `lang-fr`, `lang-ar` key off the `lang` attribute.
- Custom utilities used across pages: `h-hero`, `min-h-hero`, `content-container`, `min-scrollbar`, `custom-scrollbar`.
- The base layer styles bare elements. Paragraphs, links, spans, and labels are muted by default, and `section` gets horizontal padding automatically. Expect to override these rather than assume unstyled defaults.

`components.json` configures shadcn, but `src/components/ui/` is hand-written, with several components derived from Tremor. Match the neighbours rather than pulling in a shadcn component blindly. `cn` and `cx` in `src/lib/utils.ts` are both the same clsx plus tailwind-merge wrapper.

---

## Git and deployment

`dev` holds all work and `main` is production, auto-deploying to Netlify. The exact merge sequence is written up in `.agent/workflows/push_to_main.md`. Conventional Commits and the `<type>/<issue>-<description>` branch naming are specified in `git_conventions.md`.

SPA routing on Netlify depends on `public/_redirects`. `wrangler.jsonc` configures Cloudflare static assets and is secondary to the Netlify deployment.

Migrations are checked into `supabase/migrations/`. The `temp_migrations/` folder is a scratch copy and is not the source of truth.

---

## Reference documents in the repo

| File | Contents |
|------|----------|
| `supabase/decoright_full_setup.sql` | Canonical whole-schema script: tables, RLS, triggers, storage, realtime, seed |
| `AGENTS.md` | Business rules, roles, request lifecycle, conventions |
| `AGENTS_ERD.md` | Mermaid ERD with schema design notes |
| `DB_SCHEMA.md` | Raw JSON dump of every column and type |
| `UI_SCREENS.md` | Screen-by-screen description of the UI |
| `docs/FLUTTER_BACKEND.md` | Backend and API reference for the Flutter client |
| `docs/account_deletion.md` | Account deletion flow, required for the Play Store |
| `supabase_setup_guide.md` | Project bootstrap steps |

The Supabase MCP project ref, from `opencode.json`, is `iqdreqrottmwiyyhhfxm`.
