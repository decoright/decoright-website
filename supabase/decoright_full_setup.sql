-- ============================================================================
--  DecoRight — Complete Supabase Setup
--  Single-file, idempotent, re-runnable schema + security + storage + seed.
--
--  Generated from the application source of truth:
--    src/types/database.types.ts   (canonical column list + enums)
--    src/services/*.service.ts     (actual queries the RLS must allow)
--    supabase/migrations/*.sql     (policies + functions already in prod)
--
--  SAFETY CONTRACT
--    * Non-destructive. No DROP TABLE, no DROP COLUMN, no data deletion.
--    * Idempotent. Safe to run repeatedly on a live database.
--    * Converging. Missing tables/columns/indexes/policies are created;
--      existing ones are left in place or replaced with the canonical version.
--
--  HOW TO RUN  (Supabase Dashboard -> SQL Editor)
--    STEP 1: run PART 1 (enum types) ON ITS OWN, then press Run.
--            PostgreSQL forbids using a brand-new enum value in the same
--            transaction that created it, and the SQL Editor wraps each
--            execution in one transaction. Running PART 1 separately avoids
--            the "unsafe use of new value" error on databases that are
--            missing a value such as 'super_admin' or 'Cancelled'.
--    STEP 2: run PART 2 through PART 12 together.
--    STEP 3: read PART 13 and promote your own account to super_admin.
--    STEP 4: apply the two frontend patches listed in PART 14.
--
--  Anything marked  !! ACTION REQUIRED  needs a decision from you.
-- ============================================================================


-- ############################################################################
-- ############################################################################
--  PART 1 — EXTENSIONS AND ENUM TYPES        >>> RUN THIS BLOCK ON ITS OWN <<<
-- ############################################################################
-- ############################################################################

create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------------
-- Create each enum only if it does not exist yet.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('customer', 'admin', 'super_admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum (
      'Submitted',
      'Under Review',
      'Waiting for Client Info',
      'Approved',
      'In Progress',
      'Completed',
      'Rejected',
      'Cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'message_type_enum') then
    create type public.message_type_enum as enum
      ('TEXT', 'IMAGE', 'AUDIO', 'SYSTEM', 'FILE', 'VIDEO');
  end if;

  if not exists (select 1 from pg_type where typname = 'project_visibility') then
    create type public.project_visibility as enum
      ('PUBLIC', 'AUTHENTICATED_ONLY', 'HIDDEN');
  end if;

  if not exists (select 1 from pg_type where typname = 'space_type') then
    create type public.space_type as enum (
      'HOUSES_AND_ROOMS',
      'COMMERCIAL_SHOPS',
      'SCHOOLS_AND_NURSERIES',
      'OFFICES_RECEPTION',
      'DORMITORY_LODGINGS'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'file_type_enum') then
    create type public.file_type_enum as enum
      ('IMAGE', 'PDF', 'DOCUMENT', 'CAD', '3D_MODEL');
  end if;

  if not exists (select 1 from pg_type where typname = 'contact_status') then
    create type public.contact_status as enum ('NEW', 'READ', 'ARCHIVED');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_action') then
    create type public.admin_action as enum
      ('STATUS_CHANGE', 'PROJECT_PUBLISH', 'SETTINGS_UPDATE');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Top up enums that exist but predate later values.
-- No-ops when the value is already present.
-- ---------------------------------------------------------------------------
alter type public.user_role        add value if not exists 'super_admin';
alter type public.request_status   add value if not exists 'Cancelled';
alter type public.message_type_enum add value if not exists 'FILE';
alter type public.message_type_enum add value if not exists 'VIDEO';

-- >>> END OF PART 1. Run it, then continue with PART 2 onward. <<<


-- ############################################################################
--  PART 2 — SHARED HELPER FUNCTIONS
-- ############################################################################
--
--  Every helper is SECURITY DEFINER on purpose.
--
--  A policy on public.profiles that reads public.profiles would re-enter RLS
--  and fail with "infinite recursion detected in policy". SECURITY DEFINER
--  runs the body as the function owner, bypassing RLS, which breaks the loop.
--  search_path is pinned so the body cannot be hijacked by a caller-supplied
--  schema.
--
--  check_function_bodies is disabled for the rest of this script. These
--  helpers read tables that PART 3 has not created yet on a brand-new
--  project, and PostgreSQL validates the body of a SQL function at CREATE
--  time. Without this the script cannot bootstrap an empty database. The
--  bodies are still checked normally the first time they run, and the
--  setting is restored at the end of PART 7.
-- ---------------------------------------------------------------------------

set check_function_bodies = off;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  );
$$;

comment on function public.is_admin() is
  'True when the caller is admin or super_admin. SECURITY DEFINER to avoid RLS recursion on profiles.';

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

-- Does the caller own this service request?
create or replace function public.owns_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.service_requests sr
    where sr.id = p_request_id
      and sr.user_id = auth.uid()
  );
$$;

-- Can the caller see this chat room? Admins can see every room.
create or replace function public.can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.chat_rooms cr
      join public.service_requests sr on sr.id = cr.request_id
      where cr.id = p_room_id
        and sr.user_id = auth.uid()
    );
$$;

-- Generic updated_at stamper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ############################################################################
--  PART 3 — TABLES
-- ############################################################################
--
--  Each table is created if absent, then every canonical column is added if
--  absent. The ADD COLUMN pass is what makes this script safe to run against
--  your existing production database, which predates several columns.
-- ---------------------------------------------------------------------------

-- ---------- 3.1 profiles ----------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  full_name      text,
  phone          text,
  phone_verified boolean     default false,
  role           public.user_role default 'customer',
  is_active      boolean     default true,
  internal_notes text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.profiles add column if not exists email          text;
alter table public.profiles add column if not exists full_name      text;
alter table public.profiles add column if not exists phone          text;
alter table public.profiles add column if not exists phone_verified boolean default false;
alter table public.profiles add column if not exists role           public.user_role default 'customer';
alter table public.profiles add column if not exists is_active      boolean default true;
alter table public.profiles add column if not exists internal_notes text;
alter table public.profiles add column if not exists created_at     timestamptz default now();
alter table public.profiles add column if not exists updated_at     timestamptz default now();

-- Uniqueness for phone is applied in PART 3.5, after duplicate repair.

-- ---------- 3.2 service_types ----------------------------------------------
create table if not exists public.service_types (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  display_name_en text not null,
  display_name_ar text,
  display_name_fr text,
  description     text,
  image_url       text,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.service_types add column if not exists display_name_ar text;
alter table public.service_types add column if not exists display_name_fr text;
alter table public.service_types add column if not exists description     text;
alter table public.service_types add column if not exists image_url       text;
alter table public.service_types add column if not exists is_active       boolean not null default true;

-- ---------- 3.3 space_types -------------------------------------------------
create table if not exists public.space_types (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  display_name_en text not null,
  display_name_ar text,
  display_name_fr text,
  description     text,
  is_active       boolean     default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.space_types add column if not exists display_name_ar text;
alter table public.space_types add column if not exists display_name_fr text;
alter table public.space_types add column if not exists description     text;
alter table public.space_types add column if not exists is_active       boolean default true;

-- ---------- 3.4 space_type_images -------------------------------------------
create table if not exists public.space_type_images (
  id            uuid primary key default gen_random_uuid(),
  space_type_id uuid not null references public.space_types(id) on delete cascade,
  image_url     text not null,
  sort_order    integer     not null default 0,
  uploaded_at   timestamptz not null default now()
);

-- ---------- 3.5 projects ----------------------------------------------------
create table if not exists public.projects (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  title_ar                text,
  title_fr                text,
  description             text,
  description_ar          text,
  description_fr          text,
  location                text,
  location_ar             text,
  location_fr             text,
  slug                    text,
  service_type_id         uuid references public.service_types(id) on delete set null,
  space_type_id           uuid references public.space_types(id)   on delete set null,
  space_type              public.space_type,
  width                   numeric,
  height                  numeric,
  main_image_url          text,
  thumbnail_url           text,
  visibility              public.project_visibility default 'PUBLIC',
  view_count              integer     not null default 0,
  construction_start_date date,
  construction_end_date   date,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table public.projects add column if not exists title_ar        text;
alter table public.projects add column if not exists title_fr        text;
alter table public.projects add column if not exists description_ar  text;
alter table public.projects add column if not exists description_fr  text;
alter table public.projects add column if not exists location_ar     text;
alter table public.projects add column if not exists location_fr     text;
alter table public.projects add column if not exists slug            text;
alter table public.projects add column if not exists service_type_id uuid references public.service_types(id) on delete set null;
alter table public.projects add column if not exists space_type_id   uuid references public.space_types(id)   on delete set null;
alter table public.projects add column if not exists width           numeric;
alter table public.projects add column if not exists height          numeric;
alter table public.projects add column if not exists thumbnail_url   text;
alter table public.projects add column if not exists view_count      integer not null default 0;

-- Slug is the public URL key (/projects/:slug). Uniqueness applied in PART 3.5.

-- ---------- 3.6 project_images ----------------------------------------------
create table if not exists public.project_images (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade,
  image_url   text not null,
  is_cover    boolean     default false,
  sort_order  integer     default 0,
  uploaded_at timestamptz default now()
);

-- ---------- 3.7 gallery_items -----------------------------------------------
-- Before/after marketing showcases. PortfolioService reads this table, not projects.
create table if not exists public.gallery_items (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  title_ar         text,
  title_fr         text,
  description      text,
  description_ar   text,
  description_fr   text,
  before_image_url text,
  after_image_url  text,
  visibility       public.project_visibility default 'PUBLIC',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.gallery_items add column if not exists title_ar       text;
alter table public.gallery_items add column if not exists title_fr       text;
alter table public.gallery_items add column if not exists description_ar text;
alter table public.gallery_items add column if not exists description_fr text;

-- ---------- 3.8 service_requests --------------------------------------------
create table if not exists public.service_requests (
  id              uuid primary key default gen_random_uuid(),
  request_code    text,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  space_type_id   uuid references public.space_types(id) on delete set null,
  space_type      public.space_type,
  description     text,
  location        text,
  width           numeric,
  height          numeric,
  duration        integer,
  status          public.request_status default 'Submitted',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.service_requests add column if not exists request_code    text;
alter table public.service_requests add column if not exists space_type_id   uuid references public.space_types(id) on delete set null;
alter table public.service_requests add column if not exists width           numeric;
alter table public.service_requests add column if not exists height          numeric;
alter table public.service_requests add column if not exists duration        integer;

-- request_code is generated server-side in PART 6 and made unique in PART 3.5.

-- ---------- 3.9 request_attachments -----------------------------------------
create table if not exists public.request_attachments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid references public.service_requests(id) on delete cascade,
  file_url    text not null,
  file_name   text not null,
  file_type   public.file_type_enum not null,
  uploaded_at timestamptz default now()
);

-- ---------- 3.10 chat_rooms -------------------------------------------------
-- Exactly one room per service request.
create table if not exists public.chat_rooms (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid unique references public.service_requests(id) on delete cascade,
  is_active  boolean     default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One-room-per-request uniqueness is applied in PART 3.5.

-- ---------- 3.11 messages ---------------------------------------------------
create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  chat_room_id     uuid references public.chat_rooms(id) on delete cascade,
  request_id       uuid not null references public.service_requests(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  message_type     public.message_type_enum default 'TEXT',
  content          text not null default '',
  media_url        text,
  duration_seconds integer,
  attachments      jsonb,
  is_read          boolean     default false,
  created_at       timestamptz default now()
);

alter table public.messages add column if not exists chat_room_id     uuid references public.chat_rooms(id) on delete cascade;
alter table public.messages add column if not exists message_type     public.message_type_enum default 'TEXT';
alter table public.messages add column if not exists media_url        text;
alter table public.messages add column if not exists duration_seconds integer;
alter table public.messages add column if not exists attachments      jsonb;
alter table public.messages add column if not exists is_read          boolean default false;

-- Media messages are sent with content = ''. Guarantee the insert cannot fail
-- on a legacy NOT NULL without a default.
alter table public.messages alter column content set default '';

-- ---------- 3.12 likes ------------------------------------------------------
create table if not exists public.likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, project_id)
);

-- ---------- 3.13 testimonials -----------------------------------------------
create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  project_id  uuid references public.projects(id)  on delete cascade,
  rating      integer check (rating between 1 and 5),
  comment     text,
  is_approved boolean     default false,
  created_at  timestamptz default now()
);

-- ---------- 3.14 faqs -------------------------------------------------------
create table if not exists public.faqs (
  id            uuid primary key default gen_random_uuid(),
  question_en   text not null,
  question_ar   text,
  question_fr   text,
  answer_en     text not null,
  answer_ar     text,
  answer_fr     text,
  display_order integer     default 0,
  is_active     boolean     default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.faqs add column if not exists question_en   text;
alter table public.faqs add column if not exists question_ar   text;
alter table public.faqs add column if not exists question_fr   text;
alter table public.faqs add column if not exists answer_en     text;
alter table public.faqs add column if not exists answer_ar     text;
alter table public.faqs add column if not exists answer_fr     text;
alter table public.faqs add column if not exists display_order integer default 0;
alter table public.faqs add column if not exists is_active     boolean default true;

-- Legacy reconciliation. The 2024 migration created faqs.question / faqs.answer
-- as NOT NULL. The admin UI only writes the _en columns, so a leftover NOT NULL
-- would reject every insert. Relax it without deleting the columns or data.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'faqs'
      and column_name = 'question' and is_nullable = 'NO'
  ) then
    alter table public.faqs alter column question drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'faqs'
      and column_name = 'answer' and is_nullable = 'NO'
  ) then
    alter table public.faqs alter column answer drop not null;
  end if;
end
$$;

-- ---------- 3.15 legal_pages ------------------------------------------------
create table if not exists public.legal_pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title_en   text not null,
  title_ar   text not null,
  title_fr   text not null,
  content_en text not null,
  content_ar text not null,
  content_fr text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- 3.16 site_settings ----------------------------------------------
create table if not exists public.site_settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  value       text,
  description text,
  updated_at  timestamptz default now()
);

-- SiteSettingsService.update() upserts on the key column, so the unique index
-- is a hard requirement, not an optimisation. Applied in PART 3.5.

-- ---------- 3.17 contact_messages -------------------------------------------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  subject    text,
  message    text not null,
  status     public.contact_status default 'NEW',
  created_at timestamptz default now()
);

-- ---------- 3.18 deletion_requests ------------------------------------------
-- Public account/data deletion queue. Required by Google Play policy.
create table if not exists public.deletion_requests (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  message    text,
  status     text        not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.deletion_requests drop constraint if exists deletion_requests_email_check;
alter table public.deletion_requests add constraint deletion_requests_email_check
  check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- ---------- 3.19 activity_logs ----------------------------------------------
-- Written by ActivityLogService. Distinct from admin_activities below.
create table if not exists public.activity_logs (
  id                uuid primary key default gen_random_uuid(),
  event_type        text not null,
  actor_id          uuid references public.profiles(id) on delete set null,
  target_user_id    uuid references public.profiles(id) on delete set null,
  target_request_id uuid,
  metadata          jsonb       default '{}'::jsonb,
  created_at        timestamptz default now()
);

-- ---------- 3.20 admin_activities -------------------------------------------
create table if not exists public.admin_activities (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references public.profiles(id) on delete set null,
  action       public.admin_action not null,
  target_table text not null,
  target_id    uuid,
  details      text,
  created_at   timestamptz default now()
);


-- ############################################################################
--  PART 3.5 — DUPLICATE REPAIR, THEN UNIQUE CONSTRAINTS
-- ############################################################################
--
--  Order matters here. Creating a unique index on a column that already holds
--  duplicates aborts the whole script, so every repair runs first.
--
--  Two classes of column are handled differently:
--
--   * DERIVED values (request_code, slug) are regenerated automatically. They
--     are machine-made identifiers, so rewriting a duplicate loses nothing.
--
--   * REAL-WORLD values (phone, settings key, room-per-request) are never
--     touched, because picking a winner would destroy data. If duplicates
--     exist the constraint is skipped and a NOTICE tells you exactly what to
--     inspect. The script continues either way.
-- ---------------------------------------------------------------------------

create sequence if not exists public.request_code_seq start with 1000;

-- ---------- 3.5.1 request_code: regenerate blanks and duplicates ------------
do $$
declare
  v_max bigint;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_requests'
  ) then
    return;
  end if;

  -- Move the sequence past every numeric code already in use.
  select coalesce(max(nullif(regexp_replace(request_code, '\D', '', 'g'), '')::bigint), 999)
    into v_max
    from public.service_requests
   where request_code is not null;

  perform setval('public.request_code_seq', greatest(v_max, 999) + 1, false);

  -- Blank or missing codes.
  update public.service_requests
     set request_code = 'REQ-' || lpad(nextval('public.request_code_seq')::text, 5, '0')
   where request_code is null or trim(request_code) = '';

  -- Duplicates: keep the earliest row in each group, renumber the rest.
  with ranked as (
    select id,
           row_number() over (
             partition by request_code
             order by coalesce(created_at, now()), id
           ) as rn
      from public.service_requests
     where request_code is not null
  )
  update public.service_requests sr
     set request_code = 'REQ-' || lpad(nextval('public.request_code_seq')::text, 5, '0')
    from ranked r
   where sr.id = r.id
     and r.rn > 1;
end
$$;

-- ---------- 3.5.2 slug: generate blanks and de-duplicate --------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'slug'
  ) then
    return;
  end if;

  update public.projects
     set slug = nullif(regexp_replace(lower(trim(coalesce(title, ''))), '[^a-z0-9]+', '-', 'g'), '')
   where slug is null or trim(slug) = '';

  -- Anything still blank (title was empty or non-Latin) or duplicated gets the
  -- id fragment appended, which is unique by construction.
  with ranked as (
    select id,
           row_number() over (partition by slug order by coalesce(created_at, now()), id) as rn
      from public.projects
     where slug is not null
  )
  update public.projects p
     set slug = coalesce(nullif(trim(p.slug), ''), 'project') || '-' || left(p.id::text, 8)
    from ranked r
   where p.id = r.id
     and r.rn > 1;

  update public.projects
     set slug = 'project-' || left(id::text, 8)
   where slug is null or trim(slug) = '';
end
$$;

-- ---------- 3.5.3 apply the unique constraints ------------------------------
--
--  Each one is wrapped so a pre-existing duplicate downgrades to a warning
--  instead of killing the script.
-- ---------------------------------------------------------------------------
do $$
declare
  stmt   record;
  n_dupes bigint;
begin
  for stmt in
    select * from (values
      ('service_requests_request_code_key',
       'create unique index if not exists service_requests_request_code_key on public.service_requests (request_code) where request_code is not null',
       'select request_code, count(*) from public.service_requests where request_code is not null group by 1 having count(*) > 1'),
      ('projects_slug_key',
       'create unique index if not exists projects_slug_key on public.projects (slug) where slug is not null',
       'select slug, count(*) from public.projects where slug is not null group by 1 having count(*) > 1'),
      ('profiles_phone_key',
       'create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null',
       'select phone, count(*) from public.profiles where phone is not null group by 1 having count(*) > 1'),
      ('site_settings_key_key',
       'create unique index if not exists site_settings_key_key on public.site_settings (key)',
       'select key, count(*) from public.site_settings group by 1 having count(*) > 1'),
      ('chat_rooms_request_id_key',
       'create unique index if not exists chat_rooms_request_id_key on public.chat_rooms (request_id) where request_id is not null',
       'select request_id, count(*) from public.chat_rooms where request_id is not null group by 1 having count(*) > 1'),
      ('service_types_name_key',
       'create unique index if not exists service_types_name_key on public.service_types (name)',
       'select name, count(*) from public.service_types group by 1 having count(*) > 1'),
      ('space_types_name_key',
       'create unique index if not exists space_types_name_key on public.space_types (name)',
       'select name, count(*) from public.space_types group by 1 having count(*) > 1'),
      ('legal_pages_slug_key',
       'create unique index if not exists legal_pages_slug_key on public.legal_pages (slug)',
       'select slug, count(*) from public.legal_pages group by 1 having count(*) > 1')
    ) as v(idx_name, create_sql, dupe_sql)
  loop
    begin
      execute stmt.create_sql;
    exception when unique_violation or others then
      execute 'select count(*) from (' || stmt.dupe_sql || ') d' into n_dupes;
      raise warning
        E'SKIPPED unique index %. Duplicate values exist (% group(s)).\n         Inspect with:  %\n         Resolve the duplicates, then re-run this script.',
        stmt.idx_name, n_dupes, stmt.dupe_sql;
    end;
  end loop;
end
$$;

-- If chat_rooms_request_id_key was skipped, these are your duplicate rooms.
-- Merging them means repointing messages at the surviving room, which is a
-- data decision, so it is left commented out.
--
--   with keep as (
--     select distinct on (request_id) id, request_id
--       from public.chat_rooms
--      where request_id is not null
--      order by request_id, created_at
--   )
--   update public.messages m
--      set chat_room_id = k.id
--     from public.chat_rooms c
--     join keep k on k.request_id = c.request_id
--    where m.chat_room_id = c.id and c.id <> k.id;
--
--   delete from public.chat_rooms c
--    using keep k
--    where c.request_id = k.request_id and c.id <> k.id;


-- ############################################################################
--  PART 4 — INDEXES
-- ############################################################################
--
--  Sized against the real query patterns in src/services and src/contexts.
--  The browser-side rate limiter in src/lib/supabase.ts cuts off at 70
--  requests/minute on /rest/v1/messages, so slow chat queries turn into a
--  hard outage rather than a slow page. These indexes matter.
-- ---------------------------------------------------------------------------

-- Chat: the hottest path in the app.
create index if not exists idx_messages_room_created
  on public.messages (chat_room_id, created_at desc);
create index if not exists idx_messages_request
  on public.messages (request_id);
create index if not exists idx_messages_sender
  on public.messages (sender_id);
-- Partial index for the unread badge: only unread rows are ever scanned.
create index if not exists idx_messages_unread
  on public.messages (chat_room_id) where is_read = false;

create index if not exists idx_chat_rooms_request
  on public.chat_rooms (request_id);
create index if not exists idx_chat_rooms_active_updated
  on public.chat_rooms (updated_at desc) where is_active = true;

-- Requests: Kanban board and client list.
create index if not exists idx_service_requests_user
  on public.service_requests (user_id, created_at desc);
create index if not exists idx_service_requests_status
  on public.service_requests (status);
create index if not exists idx_service_requests_service_type
  on public.service_requests (service_type_id);
create index if not exists idx_service_requests_space_type
  on public.service_requests (space_type_id);
create index if not exists idx_service_requests_created
  on public.service_requests (created_at desc);

-- Portfolio.
create index if not exists idx_projects_visibility_created
  on public.projects (visibility, created_at desc);
create index if not exists idx_projects_service_type
  on public.projects (service_type_id);
create index if not exists idx_projects_space_type
  on public.projects (space_type_id);
create index if not exists idx_project_images_project
  on public.project_images (project_id, sort_order);
create index if not exists idx_gallery_items_visibility_created
  on public.gallery_items (visibility, created_at desc);
create index if not exists idx_space_type_images_space_type
  on public.space_type_images (space_type_id, sort_order);

-- Social.
create index if not exists idx_likes_project
  on public.likes (project_id);
create index if not exists idx_testimonials_project
  on public.testimonials (project_id) where is_approved = true;

-- Attachments and audit.
create index if not exists idx_request_attachments_request
  on public.request_attachments (request_id);
create index if not exists idx_activity_logs_created
  on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_actor
  on public.activity_logs (actor_id);
create index if not exists idx_admin_activities_created
  on public.admin_activities (created_at desc);
create index if not exists idx_deletion_requests_status
  on public.deletion_requests (status, created_at desc);

-- Profiles.
create index if not exists idx_profiles_role
  on public.profiles (role);


-- ############################################################################
--  PART 5 — TRIGGERS AND BUSINESS RULES
-- ############################################################################

-- ---------- 5.1 updated_at stamping ----------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'service_types', 'space_types', 'projects', 'gallery_items',
    'service_requests', 'chat_rooms', 'faqs', 'legal_pages', 'site_settings'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ---------- 5.2 profile auto-provisioning -----------------------------------
--
--  src/components/layout/Signup.tsx calls supabase.auth.signUp() and passes
--  full_name and phone in options.data. It never inserts into profiles.
--  Without this trigger a new user has no profile row, AuthProvider falls back
--  to role 'customer', and the phone number is silently lost.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    'customer'
  )
  on conflict (id) do update
    set email     = coalesce(excluded.email,     public.profiles.email),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone     = coalesce(excluded.phone,     public.profiles.phone);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step when a user changes their email in Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------- 5.3 backfill profiles for existing users ------------------------
-- Non-destructive: only inserts rows that are missing.
insert into public.profiles (id, email, full_name, phone, role)
select
  u.id,
  u.email,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'phone', '')), ''),
  'customer'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ---------- 5.4 sequential request codes ------------------------------------
--
--  RequestService.createRequest builds `REQ-${1000 + random*9000}`, which is
--  a 4-digit random number with a real collision rate and no uniqueness
--  guarantee. This replaces it with a gapless server-side sequence, so the
--  value the client sends is ignored.
-- ---------------------------------------------------------------------------
create sequence if not exists public.request_code_seq start with 1000;

create or replace function public.assign_request_code()
returns trigger
language plpgsql
as $$
begin
  new.request_code := 'REQ-' || lpad(nextval('public.request_code_seq')::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists trg_service_requests_code on public.service_requests;
create trigger trg_service_requests_code
  before insert on public.service_requests
  for each row execute function public.assign_request_code();

-- ---------- 5.5 automatic chat room per request -----------------------------
--
--  The client also creates the room, but a network failure there leaves a
--  request with no chat. This guarantees the room exists. ON CONFLICT makes
--  the client's redundant insert harmless.
-- ---------------------------------------------------------------------------
create or replace function public.create_chat_room_for_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.chat_rooms (request_id, is_active)
  values (new.id, true)
  on conflict (request_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_service_requests_chat_room on public.service_requests;
create trigger trg_service_requests_chat_room
  after insert on public.service_requests
  for each row execute function public.create_chat_room_for_request();

-- Backfill rooms for any request that is missing one.
insert into public.chat_rooms (request_id, is_active)
select sr.id, true
from public.service_requests sr
left join public.chat_rooms cr on cr.request_id = sr.id
where cr.id is null
on conflict (request_id) do nothing;

-- ---------- 5.6 status changes are admin-only -------------------------------
--
--  AGENTS.md states customers may view status but never modify it. Enforcing
--  that in a policy alone is not possible, because a policy cannot compare
--  OLD and NEW column values. A trigger can.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_request_status_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Only administrators can change request status'
      using errcode = '42501';
  end if;

  -- The owning customer must not be able to hand their request to someone else.
  if new.user_id is distinct from old.user_id and not public.is_admin() then
    raise exception 'Request ownership cannot be reassigned'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_requests_status_guard on public.service_requests;
create trigger trg_service_requests_status_guard
  before update on public.service_requests
  for each row execute function public.enforce_request_status_rules();

-- ---------- 5.7 SYSTEM message on status change -----------------------------
-- Gives the customer an in-chat trail of what happened to their request.
create or replace function public.log_status_change_to_chat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room_id uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select id into v_room_id from public.chat_rooms where request_id = new.id;

  if v_room_id is not null and auth.uid() is not null then
    insert into public.messages
      (chat_room_id, request_id, sender_id, message_type, content, is_read)
    values
      (v_room_id, new.id, auth.uid(), 'SYSTEM',
       'Request status changed to: ' || new.status::text, false);

    update public.chat_rooms set updated_at = now() where id = v_room_id;
  end if;

  -- Mirror into the audit log so the admin activity page shows it.
  insert into public.activity_logs (event_type, actor_id, target_request_id, metadata)
  values (
    'REQUEST_STATUS_CHANGED',
    auth.uid(),
    new.id,
    jsonb_build_object('old_status', old.status, 'new_status', new.status)
  );

  return new;
end;
$$;

drop trigger if exists trg_service_requests_status_message on public.service_requests;
create trigger trg_service_requests_status_message
  after update of status on public.service_requests
  for each row execute function public.log_status_change_to_chat();

-- ---------- 5.8 role escalation guard ---------------------------------------
--
--  Rules enforced here:
--    * Nobody can change their own role, including admins.
--    * Only a super_admin can grant or revoke super_admin.
--    * A plain admin can move a user between customer and admin.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_role_change_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  if auth.uid() is null then          -- service_role / SQL editor / triggers
    return new;
  end if;

  if new.id = auth.uid() then
    raise exception 'You cannot change your own role'
      using errcode = '42501';
  end if;

  if (new.role = 'super_admin' or old.role = 'super_admin')
     and not public.is_super_admin() then
    raise exception 'Only a super administrator can grant or revoke super_admin'
      using errcode = '42501';
  end if;

  if not public.is_admin() then
    raise exception 'Only administrators can change roles'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
  before update on public.profiles
  for each row execute function public.enforce_role_change_rules();

-- ---------- 5.9 message tampering guard -------------------------------------
--
--  Both sides update messages to flip is_read. That UPDATE grant must not
--  become a licence to rewrite someone else's message body.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_message_edit_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.sender_id = auth.uid() or public.is_admin() then
    return new;
  end if;

  if new.content    is distinct from old.content
     or new.media_url    is distinct from old.media_url
     or new.sender_id    is distinct from old.sender_id
     or new.message_type is distinct from old.message_type then
    raise exception 'You may only mark messages as read'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_messages_edit_guard on public.messages;
create trigger trg_messages_edit_guard
  before update on public.messages
  for each row execute function public.enforce_message_edit_rules();

-- ---------- 5.10 keep the room list ordered ---------------------------------
-- ChatContext orders rooms by updated_at. Stamping it in the database means
-- the ordering is right even if the client's follow-up UPDATE never lands.
create or replace function public.touch_chat_room()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.chat_room_id is not null then
    update public.chat_rooms set updated_at = now() where id = new.chat_room_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_touch_room on public.messages;
create trigger trg_messages_touch_room
  after insert on public.messages
  for each row execute function public.touch_chat_room();


-- ############################################################################
--  PART 6 — ROW LEVEL SECURITY
-- ############################################################################

alter table public.profiles            enable row level security;
alter table public.service_types       enable row level security;
alter table public.space_types         enable row level security;
alter table public.space_type_images   enable row level security;
alter table public.projects            enable row level security;
alter table public.project_images      enable row level security;
alter table public.gallery_items       enable row level security;
alter table public.service_requests    enable row level security;
alter table public.request_attachments enable row level security;
alter table public.chat_rooms          enable row level security;
alter table public.messages            enable row level security;
alter table public.likes               enable row level security;
alter table public.testimonials        enable row level security;
alter table public.faqs                enable row level security;
alter table public.legal_pages         enable row level security;
alter table public.site_settings       enable row level security;
alter table public.contact_messages    enable row level security;
alter table public.deletion_requests   enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.admin_activities    enable row level security;

-- ---------- 6.1 profiles ----------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- Role escalation is blocked by trg_profiles_role_guard, not by this policy.

drop policy if exists "profiles_delete_super_admin" on public.profiles;
create policy "profiles_delete_super_admin" on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

-- ---------- 6.2 reference data: readable by everyone, admin-managed ---------
--
--  Read is deliberately unfiltered rather than "is_active = true". These rows
--  are joined into every service request; hiding a deactivated type would make
--  an existing customer's request render with a null service name.
-- ---------------------------------------------------------------------------
drop policy if exists "service_types_read_all" on public.service_types;
create policy "service_types_read_all" on public.service_types
  for select to anon, authenticated using (true);

drop policy if exists "service_types_admin_write" on public.service_types;
create policy "service_types_admin_write" on public.service_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "space_types_read_all" on public.space_types;
create policy "space_types_read_all" on public.space_types
  for select to anon, authenticated using (true);

drop policy if exists "space_types_admin_write" on public.space_types;
create policy "space_types_admin_write" on public.space_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "space_type_images_read_all" on public.space_type_images;
create policy "space_type_images_read_all" on public.space_type_images
  for select to anon, authenticated using (true);

drop policy if exists "space_type_images_admin_write" on public.space_type_images;
create policy "space_type_images_admin_write" on public.space_type_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.3 projects and gallery: visibility ladder ---------------------
drop policy if exists "projects_read_public" on public.projects;
create policy "projects_read_public" on public.projects
  for select to anon
  using (visibility = 'PUBLIC');

drop policy if exists "projects_read_authenticated" on public.projects;
create policy "projects_read_authenticated" on public.projects
  for select to authenticated
  using (
    visibility in ('PUBLIC', 'AUTHENTICATED_ONLY')
    or public.is_admin()
  );

drop policy if exists "projects_admin_write" on public.projects;
create policy "projects_admin_write" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "project_images_read_public" on public.project_images;
create policy "project_images_read_public" on public.project_images
  for select to anon
  using (exists (
    select 1 from public.projects p
    where p.id = project_images.project_id and p.visibility = 'PUBLIC'
  ));

drop policy if exists "project_images_read_authenticated" on public.project_images;
create policy "project_images_read_authenticated" on public.project_images
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_images.project_id
        and p.visibility in ('PUBLIC', 'AUTHENTICATED_ONLY')
    )
  );

drop policy if exists "project_images_admin_write" on public.project_images;
create policy "project_images_admin_write" on public.project_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "gallery_items_read_public" on public.gallery_items;
create policy "gallery_items_read_public" on public.gallery_items
  for select to anon
  using (visibility = 'PUBLIC');

drop policy if exists "gallery_items_read_authenticated" on public.gallery_items;
create policy "gallery_items_read_authenticated" on public.gallery_items
  for select to authenticated
  using (
    visibility in ('PUBLIC', 'AUTHENTICATED_ONLY')
    or public.is_admin()
  );

drop policy if exists "gallery_items_admin_write" on public.gallery_items;
create policy "gallery_items_admin_write" on public.gallery_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.4 service_requests --------------------------------------------
drop policy if exists "service_requests_select_own_or_admin" on public.service_requests;
create policy "service_requests_select_own_or_admin" on public.service_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "service_requests_insert_own" on public.service_requests;
create policy "service_requests_insert_own" on public.service_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "service_requests_update_own_or_admin" on public.service_requests;
create policy "service_requests_update_own_or_admin" on public.service_requests
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
-- Status column protected by trg_service_requests_status_guard.

drop policy if exists "service_requests_delete_own_or_admin" on public.service_requests;
create policy "service_requests_delete_own_or_admin" on public.service_requests
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------- 6.5 request_attachments -----------------------------------------
drop policy if exists "request_attachments_select_participant" on public.request_attachments;
create policy "request_attachments_select_participant" on public.request_attachments
  for select to authenticated
  using (public.is_admin() or public.owns_request(request_id));

drop policy if exists "request_attachments_insert_participant" on public.request_attachments;
create policy "request_attachments_insert_participant" on public.request_attachments
  for insert to authenticated
  with check (public.is_admin() or public.owns_request(request_id));

drop policy if exists "request_attachments_delete_participant" on public.request_attachments;
create policy "request_attachments_delete_participant" on public.request_attachments
  for delete to authenticated
  using (public.is_admin() or public.owns_request(request_id));

-- ---------- 6.6 chat_rooms --------------------------------------------------
drop policy if exists "chat_rooms_select_participant" on public.chat_rooms;
create policy "chat_rooms_select_participant" on public.chat_rooms
  for select to authenticated
  using (public.is_admin() or public.owns_request(request_id));

drop policy if exists "chat_rooms_insert_participant" on public.chat_rooms;
create policy "chat_rooms_insert_participant" on public.chat_rooms
  for insert to authenticated
  with check (public.is_admin() or public.owns_request(request_id));

drop policy if exists "chat_rooms_update_participant" on public.chat_rooms;
create policy "chat_rooms_update_participant" on public.chat_rooms
  for update to authenticated
  using (public.is_admin() or public.owns_request(request_id))
  with check (public.is_admin() or public.owns_request(request_id));

drop policy if exists "chat_rooms_delete_admin" on public.chat_rooms;
create policy "chat_rooms_delete_admin" on public.chat_rooms
  for delete to authenticated
  using (public.is_admin());

-- ---------- 6.7 messages ----------------------------------------------------
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages
  for select to authenticated
  using (public.is_admin() or public.owns_request(request_id));

drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (public.is_admin() or public.owns_request(request_id))
  );

drop policy if exists "messages_update_participant" on public.messages;
create policy "messages_update_participant" on public.messages
  for update to authenticated
  using (public.is_admin() or public.owns_request(request_id))
  with check (public.is_admin() or public.owns_request(request_id));
-- Content protected by trg_messages_edit_guard; this grant is for is_read.

drop policy if exists "messages_delete_sender_or_admin" on public.messages;
create policy "messages_delete_sender_or_admin" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid() or public.is_admin());

-- ---------- 6.8 likes -------------------------------------------------------
drop policy if exists "likes_read_all" on public.likes;
create policy "likes_read_all" on public.likes
  for select to anon, authenticated using (true);

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own" on public.likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own" on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- ---------- 6.9 testimonials ------------------------------------------------
drop policy if exists "testimonials_read_approved" on public.testimonials;
create policy "testimonials_read_approved" on public.testimonials
  for select to anon, authenticated
  using (is_approved = true or user_id = auth.uid() or public.is_admin());

drop policy if exists "testimonials_insert_own" on public.testimonials;
create policy "testimonials_insert_own" on public.testimonials
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "testimonials_admin_write" on public.testimonials;
create policy "testimonials_admin_write" on public.testimonials
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.10 faqs -------------------------------------------------------
drop policy if exists "faqs_read_active" on public.faqs;
create policy "faqs_read_active" on public.faqs
  for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "faqs_admin_write" on public.faqs;
create policy "faqs_admin_write" on public.faqs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.11 legal_pages ------------------------------------------------
drop policy if exists "legal_pages_read_all" on public.legal_pages;
create policy "legal_pages_read_all" on public.legal_pages
  for select to anon, authenticated using (true);

drop policy if exists "Admins can manage legal pages" on public.legal_pages;
drop policy if exists "legal_pages_admin_write" on public.legal_pages;
create policy "legal_pages_admin_write" on public.legal_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.12 site_settings ----------------------------------------------
-- Public read: the logo, phone and social links render on the landing page
-- for logged-out visitors.
drop policy if exists "site_settings_read_all" on public.site_settings;
create policy "site_settings_read_all" on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.13 contact_messages -------------------------------------------
drop policy if exists "contact_messages_insert_anyone" on public.contact_messages;
create policy "contact_messages_insert_anyone" on public.contact_messages
  for insert to anon, authenticated with check (true);

drop policy if exists "contact_messages_admin_read" on public.contact_messages;
create policy "contact_messages_admin_read" on public.contact_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.14 deletion_requests ------------------------------------------
drop policy if exists "Anyone can submit a deletion request" on public.deletion_requests;
drop policy if exists "deletion_requests_insert_anyone" on public.deletion_requests;
create policy "deletion_requests_insert_anyone" on public.deletion_requests
  for insert to anon, authenticated with check (true);

drop policy if exists "Admins can manage deletion requests" on public.deletion_requests;
drop policy if exists "deletion_requests_admin_manage" on public.deletion_requests;
create policy "deletion_requests_admin_manage" on public.deletion_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 6.15 activity_logs ----------------------------------------------
drop policy if exists "activity_logs_insert_self" on public.activity_logs;
create policy "activity_logs_insert_self" on public.activity_logs
  for insert to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

drop policy if exists "activity_logs_admin_read" on public.activity_logs;
create policy "activity_logs_admin_read" on public.activity_logs
  for select to authenticated using (public.is_admin());

drop policy if exists "activity_logs_admin_manage" on public.activity_logs;
create policy "activity_logs_admin_manage" on public.activity_logs
  for delete to authenticated using (public.is_super_admin());

-- ---------- 6.16 admin_activities -------------------------------------------
drop policy if exists "admin_activities_admin_only" on public.admin_activities;
create policy "admin_activities_admin_only" on public.admin_activities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ############################################################################
--  PART 7 — RPC FUNCTIONS CALLED BY THE APP
-- ############################################################################

-- ---------- 7.1 increment_project_view_count --------------------------------
-- Called by ProjectService.incrementViewCount, including for logged-out
-- visitors, so it must bypass the admin-only write policy on projects.
create or replace function public.increment_project_view_count(project_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.projects
     set view_count = coalesce(view_count, 0) + 1
   where id = project_id;
end;
$$;

grant execute on function public.increment_project_view_count(uuid) to anon, authenticated;

-- ---------- 7.2 delete_user_account -----------------------------------------
--
--  !! SECURITY FIX. The version in
--  supabase/migrations/20260430000000_delete_account_function.sql has two
--  defects, both corrected here:
--
--   1. PRIVILEGE ESCALATION. It never checked who was calling. Because it is
--      SECURITY DEFINER and granted to `authenticated`, any logged-in user
--      could pass someone else's uuid and delete that account, including an
--      admin's. The caller is now required to be the account owner or an
--      admin.
--
--   2. DEAD DELETE. It deleted service_requests before deleting the
--      request_attachments that reference them, so the attachments subquery
--      matched nothing. The order is corrected, and the cascade rules in
--      PART 3 now do the work anyway.
-- ---------------------------------------------------------------------------
create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'You can only delete your own account'
      using errcode = '42501';
  end if;

  -- Nobody may delete a super_admin through this path.
  if exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'super_admin'
  ) then
    raise exception 'Super administrator accounts cannot be deleted this way'
      using errcode = '42501';
  end if;

  -- Children first, then parents. Cascades cover the rest.
  delete from public.request_attachments
    where request_id in (select id from public.service_requests where user_id = p_user_id);

  delete from public.messages          where sender_id = p_user_id;
  delete from public.likes             where user_id   = p_user_id;
  delete from public.testimonials      where user_id   = p_user_id;
  delete from public.service_requests  where user_id   = p_user_id;
  delete from public.profiles          where id        = p_user_id;
  delete from auth.users               where id        = p_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid) from public;
grant execute on function public.delete_user_account(uuid) to authenticated;

-- ---------- 7.3 phone_exists ------------------------------------------------
--
--  !! ACTION REQUIRED — see PART 14, patch 1.
--
--  Signup.tsx currently does an unauthenticated SELECT on public.profiles to
--  test whether a phone number is taken. Allowing that would require granting
--  `anon` read access to the profiles table, which exposes every customer's
--  name, email and phone number to the open internet.
--
--  This function answers the same question without leaking anything: it
--  returns a single boolean and never returns a row.
-- ---------------------------------------------------------------------------
create or replace function public.phone_exists(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where phone = p_phone
  );
$$;

grant execute on function public.phone_exists(text) to anon, authenticated;

-- Every function is defined; restore normal body checking for the session.
set check_function_bodies = on;


-- ############################################################################
--  PART 8 — STORAGE BUCKETS
-- ############################################################################
--
--  Four buckets, matching the code:
--    request-attachments  chat media + service request files
--    projects             project images and space type images
--    service-types        service type icons
--    site-assets          the site logo
--
--  All four are PUBLIC because every upload path in the app reads the file
--  back with getPublicUrl(), which only works on a public bucket.
--
--  !! PRIVACY NOTE on request-attachments. That bucket holds private customer
--  conversations: photos of their home, floor plans, documents. Public means
--  anyone holding the URL can open it without logging in. The URLs are long
--  and unguessable, so this is obscurity rather than access control. PART 15
--  contains the optional migration to signed URLs if you want it locked down.
--
--  30 MB matches GENERAL_MAX_BYTES in src/utils/file-upload.ts.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('request-attachments', 'request-attachments', true, 31457280),
  ('projects',            'projects',            true, 31457280),
  ('service-types',       'service-types',       true, 31457280),
  ('site-assets',         'site-assets',         true, 31457280)
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- ---------- 8.1 public read on all four buckets -----------------------------
drop policy if exists "decoright_public_read" on storage.objects;
create policy "decoright_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('request-attachments', 'projects', 'service-types', 'site-assets'));

-- ---------- 8.2 request-attachments: any signed-in user may upload ----------
drop policy if exists "decoright_attachments_insert" on storage.objects;
create policy "decoright_attachments_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'request-attachments');

drop policy if exists "decoright_attachments_update" on storage.objects;
create policy "decoright_attachments_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'request-attachments' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "decoright_attachments_delete" on storage.objects;
create policy "decoright_attachments_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'request-attachments' and (owner = auth.uid() or public.is_admin()));

-- ---------- 8.3 admin-only buckets ------------------------------------------
drop policy if exists "decoright_admin_buckets_write" on storage.objects;
create policy "decoright_admin_buckets_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('projects', 'service-types', 'site-assets')
    and public.is_admin()
  );

drop policy if exists "decoright_admin_buckets_update" on storage.objects;
create policy "decoright_admin_buckets_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('projects', 'service-types', 'site-assets')
    and public.is_admin()
  );

drop policy if exists "decoright_admin_buckets_delete" on storage.objects;
create policy "decoright_admin_buckets_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('projects', 'service-types', 'site-assets')
    and public.is_admin()
  );


-- ############################################################################
--  PART 9 — REALTIME
-- ############################################################################
--
--  ChatContext subscribes to postgres_changes on messages and chat_rooms.
--
--  REPLICA IDENTITY FULL on messages is not optional. The DELETE handler in
--  ChatContext reads payload.old.id. Under the default replica identity,
--  Postgres only ships the primary key for DELETE, and with some client
--  versions the old record arrives empty, so deleted messages never disappear
--  from the other participant's screen until they reload.
-- ---------------------------------------------------------------------------

alter table public.messages   replica identity full;
alter table public.chat_rooms replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'chat_rooms'
  ) then
    alter publication supabase_realtime add table public.chat_rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'service_requests'
  ) then
    alter publication supabase_realtime add table public.service_requests;
  end if;
end
$$;


-- ############################################################################
--  PART 10 — GRANTS
-- ############################################################################
--
--  RLS decides which rows. Grants decide whether the role may touch the table
--  at all. Both have to line up or PostgREST returns a bare permission error.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on
  public.projects, public.project_images, public.gallery_items,
  public.service_types, public.space_types, public.space_type_images,
  public.faqs, public.legal_pages, public.site_settings,
  public.likes, public.testimonials
to anon, authenticated;

grant insert on public.contact_messages  to anon, authenticated;
grant insert on public.deletion_requests to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.service_requests, public.request_attachments,
  public.chat_rooms, public.messages, public.likes, public.testimonials
to authenticated;

grant select, insert, update, delete on
  public.projects, public.project_images, public.gallery_items,
  public.service_types, public.space_types, public.space_type_images,
  public.faqs, public.legal_pages, public.site_settings,
  public.contact_messages, public.deletion_requests,
  public.activity_logs, public.admin_activities
to authenticated;

grant usage, select on sequence public.request_code_seq to authenticated;


-- ############################################################################
--  PART 11 — SEED DATA
-- ############################################################################
--  Every insert is ON CONFLICT DO NOTHING. Existing rows are never overwritten.
-- ---------------------------------------------------------------------------

-- ---------- 11.1 service types ----------------------------------------------
insert into public.service_types (name, display_name_en, display_name_ar, display_name_fr, is_active)
select v.name, v.display_name_en, v.display_name_ar, v.display_name_fr, v.is_active
from (values
  ('INTERIOR_DESIGN',     'Interior Design',     'التصميم الداخلي',   'Design d''intérieur',   true),
  ('FIXED_DESIGN',        'Fixed Design',        'التصميم الثابت',    'Design fixe',           true),
  ('DECOR_CONSULTATION',  'Decor Consultation',  'استشارة الديكور',   'Conseil en décoration', true),
  ('FURNITURE_REQUEST',   'Furniture Request',   'طلب أثاث',          'Demande de mobilier',   true),
  ('BUILDING_RENOVATION', 'Renovation',          'تجديد',             'Rénovation',            true)
) as v(name, display_name_en, display_name_ar, display_name_fr, is_active)
where not exists (
  select 1 from public.service_types st where st.name = v.name
);

-- ---------- 11.2 space types ------------------------------------------------
insert into public.space_types (name, display_name_en, display_name_ar, display_name_fr, is_active)
select v.name, v.display_name_en, v.display_name_ar, v.display_name_fr, v.is_active
from (values
  ('HOUSES_AND_ROOMS',      'Houses and Rooms',      'المنازل والغرف',      'Maisons et chambres',   true),
  ('COMMERCIAL_SHOPS',      'Commercial Shops',      'المحلات التجارية',    'Magasins commerciaux',  true),
  ('SCHOOLS_AND_NURSERIES', 'Schools and Nurseries', 'المدارس والحضانات',   'Écoles et crèches',     true),
  ('OFFICES_RECEPTION',     'Offices and Reception', 'المكاتب والاستقبال',  'Bureaux et réception',  true),
  ('DORMITORY_LODGINGS',    'Dormitory Lodgings',    'المساكن الجامعية',    'Logements résidentiels', true)
) as v(name, display_name_en, display_name_ar, display_name_fr, is_active)
where not exists (
  select 1 from public.space_types st where st.name = v.name
);

-- ---------- 11.3 site settings ----------------------------------------------
-- Keys read by src/hooks/useSiteSettings.ts. Defaults come from
-- src/constants/company.tsx.
insert into public.site_settings (key, value, description)
select v.key, v.value, v.description
from (values
  ('company_name',    'Decoright',                                        'Company name shown in the header and footer'),
  ('primary_email',   'decoright26@gmail.com',                            'Public support email address'),
  ('primary_phone',   '+213668632748',                                    'Public contact phone number'),
  ('google_maps_url', 'https://www.google.com/maps?q=40.7128,-74.0060',   'Google Maps link for the office location'),
  ('logo_url',        '',                                                 'Uploaded logo URL. Empty falls back to /Logo.PNG'),
  ('whatsapp',        '',                                                 'WhatsApp contact link'),
  ('facebook',        '',                                                 'Facebook page URL'),
  ('instagram',       '',                                                 'Instagram profile URL'),
  ('tiktok',          '',                                                 'TikTok profile URL'),
  ('youtube',         '',                                                 'YouTube channel URL'),
  ('pinterest',       '',                                                 'Pinterest profile URL'),
  ('xtwitter',        '',                                                 'X / Twitter profile URL'),
  ('telegram',        '',                                                 'Telegram contact link')
) as v(key, value, description)
where not exists (
  select 1 from public.site_settings ss where ss.key = v.key
);

-- ---------- 11.4 legal pages ------------------------------------------------
-- Slugs must match PATHS.PRIVACY_POLICY and PATHS.TERMS_OF_SERVICE.
insert into public.legal_pages (slug, title_en, title_ar, title_fr, content_en, content_ar, content_fr)
select v.slug, v.title_en, v.title_ar, v.title_fr, v.content_en, v.content_ar, v.content_fr
from (values
  (
    'privacy-policy',
    'Privacy Policy', 'سياسة الخصوصية', 'Politique de confidentialité',
    E'# Privacy Policy\n\nReplace this placeholder from the admin panel at /admin/legal-pages.\n\nDescribe what personal data DecoRight collects, why it is collected, how long it is kept, and how a customer can request deletion at /delete-account.',
    E'# سياسة الخصوصية\n\nيرجى استبدال هذا النص من لوحة التحكم.',
    E'# Politique de confidentialité\n\nRemplacez ce texte depuis le panneau d''administration.'
  ),
  (
    'terms-of-service',
    'Terms of Service', 'شروط الخدمة', 'Conditions d''utilisation',
    E'# Terms of Service\n\nReplace this placeholder from the admin panel at /admin/legal-pages.',
    E'# شروط الخدمة\n\nيرجى استبدال هذا النص من لوحة التحكم.',
    E'# Conditions d''utilisation\n\nRemplacez ce texte depuis le panneau d''administration.'
  )
) as v(slug, title_en, title_ar, title_fr, content_en, content_ar, content_fr)
where not exists (
  select 1 from public.legal_pages lp where lp.slug = v.slug
);

-- ---------- 11.5 starter FAQs -----------------------------------------------
insert into public.faqs (question_en, question_ar, question_fr, answer_en, answer_ar, answer_fr, display_order, is_active)
select v.question_en, v.question_ar, v.question_fr, v.answer_en, v.answer_ar, v.answer_fr, v.display_order, v.is_active
from (values
  (
    'How do I request a service?',
    'كيف أطلب خدمة؟',
    'Comment demander un service ?',
    'Create an account, open Request a Service, choose the service and space type, describe your project and attach photos or plans.',
    'أنشئ حسابًا، ثم افتح صفحة طلب خدمة، واختر نوع الخدمة والمساحة، ثم صف مشروعك وأرفق الصور أو المخططات.',
    'Créez un compte, ouvrez Demander un service, choisissez le type de service et d''espace, puis décrivez votre projet.',
    1, true
  ),
  (
    'How much does a project cost?',
    'كم تكلفة المشروع؟',
    'Combien coûte un projet ?',
    'Pricing depends on the scope of each project. Submit a request and we will discuss the budget with you directly in the chat.',
    'تعتمد التكلفة على نطاق كل مشروع. أرسل طلبًا وسنناقش الميزانية معك مباشرة في المحادثة.',
    'Le prix dépend de l''ampleur du projet. Envoyez une demande et nous discuterons du budget dans la messagerie.',
    2, true
  )
) as v(question_en, question_ar, question_fr, answer_en, answer_ar, answer_fr, display_order, is_active)
where not exists (
  select 1 from public.faqs f where f.question_en = v.question_en
);


-- ############################################################################
--  PART 12 — DATA BACKFILL AND CONSISTENCY REPAIR
-- ############################################################################

-- Project slugs and request codes were already generated and de-duplicated in
-- PART 3.5, before their unique indexes were applied.

-- Mirror auth emails into profiles for rows created before the email column.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- Normalise nulls that the UI treats as booleans.
update public.profiles       set is_active      = true  where is_active      is null;
update public.profiles       set phone_verified = false where phone_verified is null;
update public.messages       set is_read        = false where is_read        is null;
update public.chat_rooms     set is_active      = true  where is_active      is null;
update public.projects       set view_count     = 0     where view_count     is null;


-- ############################################################################
--  PART 13 — !! ACTION REQUIRED: CREATE YOUR FIRST SUPER ADMIN
-- ############################################################################
--
--  handle_new_user() gives every signup the 'customer' role, and the role
--  guard trigger blocks anyone from promoting themselves. So the first
--  administrator has to be created here, from the SQL Editor, which runs as
--  the postgres role and bypasses both RLS and the guard.
--
--  Sign up through the app first, then uncomment and run this with your email.
-- ---------------------------------------------------------------------------

-- update public.profiles
--    set role = 'super_admin'
--  where email = 'kricar.fr@gmail.com';

-- Confirm it worked:
-- select id, email, full_name, role from public.profiles where role <> 'customer';


-- ############################################################################
--  PART 14 — !! ACTION REQUIRED: TWO FRONTEND PATCHES
-- ############################################################################
--
--  PATCH 1 — src/components/layout/Signup.tsx  (REQUIRED, signup breaks without it)
--
--    The duplicate-phone check runs before the user is authenticated. Under
--    the profiles policy in PART 6 an anonymous SELECT returns zero rows, so
--    the check silently passes and the unique index rejects the signup later
--    with an opaque error. Swap the table read for the RPC from PART 7.3.
--
--    Replace:
--        const { data: existingPhone } = await supabase
--            .from('profiles')
--            .select('id')
--            .eq('phone', normalizedPhone)
--            .maybeSingle()
--
--        if (existingPhone) {
--
--    With:
--        const { data: phoneTaken } = await supabase
--            .rpc('phone_exists', { p_phone: normalizedPhone })
--
--        if (phoneTaken) {
--
--
--  PATCH 2 — src/services/request.service.ts  (OPTIONAL, removes console noise)
--
--    PART 5.5 now creates the chat room server-side. The manual insert in
--    createRequest() will hit the unique index on chat_rooms.request_id and
--    log a duplicate-key error. It is caught and non-fatal, but you can delete
--    the whole `const { data: chatRoom, error: chatError } = ...` block and
--    return the request on its own.
-- ############################################################################


-- ############################################################################
--  PART 15 — OPTIONAL HARDENING: PRIVATE CHAT ATTACHMENTS
-- ############################################################################
--
--  Run this ONLY if you also switch the frontend from getPublicUrl() to
--  createSignedUrl(). Running it alone will break every image in the chat.
--
--  What it does: makes the attachments bucket private, so files are reachable
--  only through a time-limited signed URL issued to a user who passes RLS.
--
--  Frontend change required in ChatContext.tsx, chat.service.ts and
--  request.service.ts:
--      const { data } = await supabase.storage
--        .from('request-attachments')
--        .createSignedUrl(path, 3600)
--      // then store `path` in messages.media_url instead of the public URL
--      // and sign it at render time.
-- ---------------------------------------------------------------------------

-- update storage.buckets set public = false where id = 'request-attachments';
--
-- drop policy if exists "decoright_public_read" on storage.objects;
-- create policy "decoright_public_read" on storage.objects
--   for select to anon, authenticated
--   using (bucket_id in ('projects', 'service-types', 'site-assets'));
--
-- create policy "decoright_attachments_read" on storage.objects
--   for select to authenticated
--   using (bucket_id = 'request-attachments' and (owner = auth.uid() or public.is_admin()));


-- ############################################################################
--  PART 16 — VERIFICATION
-- ############################################################################
--  Run these after the script. Each one should return what the comment says.
-- ---------------------------------------------------------------------------

-- Every public table must report rls_enabled = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relrowsecurity, c.relname;

-- Policy count per table. Anything showing 0 is unprotected or unreachable.
select tablename, count(*) as policies
  from pg_policies
 where schemaname = 'public'
 group by tablename
 order by tablename;

-- The four buckets, all public = true until you apply PART 15.
select id, public, file_size_limit from storage.buckets order by id;

-- Realtime must list messages, chat_rooms and service_requests.
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
 order by tablename;

-- Both must be 'f' (full) for correct DELETE payloads in chat.
select relname, relreplident from pg_class
 where relname in ('messages', 'chat_rooms');

-- The signup trigger must exist.
select tgname from pg_trigger where tgname = 'on_auth_user_created';

-- Seeded reference data: expect 5 service types and 5 space types.
select 'service_types' as t, count(*) from public.service_types
union all
select 'space_types',  count(*) from public.space_types
union all
select 'legal_pages',  count(*) from public.legal_pages
union all
select 'site_settings', count(*) from public.site_settings;

-- Nobody should be left without a profile row.
select count(*) as users_missing_profile
  from auth.users u
  left join public.profiles p on p.id = u.id
 where p.id is null;

-- ============================================================================
--  END OF SCRIPT
-- ============================================================================
