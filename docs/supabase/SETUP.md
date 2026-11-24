# HTWMA Supabase PostgreSQL Setup Guide

## 1. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your Supabase project URL and **anon / publishable** key (never use the `service_role` or `sb_secret_*` key in frontend variables):

```env
VITE_SUPABASE_URL=https://szxfrbrppkofeoojzewq.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
```

## 2. Database Migrations

All SQL migrations live in `supabase/migrations/` (and consolidated in `docs/supabase/schema.sql`):

1. `20261124053338_htwma_core_schema.sql` – Core tables (`admin_users`, `member_sequences`, `members`, `member_documents`, `committee_roles`, `committee_members`, `gallery`, `announcements`, `contact_messages`, `site_settings`, `activity_logs`, `member_fees`) and constraints.
2. `20261124053528_htwma_indexes_triggers_and_rpcs.sql` – Search/trigram indexes, sequence allocators, `updated_at` triggers, masked-ID sync triggers, and transactional RPCs (`upsert_member_with_documents`, `bulk_import_members`, `delete_member_permanently`, `get_public_committee`, `submit_contact_message`).
3. `20261124053636_htwma_rls_storage_and_bootstrap.sql` – Forced Row Level Security (RLS), least-privilege `GRANT`s, Storage buckets (`member-photos`, `member-documents`, `member-signatures`, `public-media`) + Storage RLS policies, and structural seed data.

## 3. Adding or Authorizing an Administrator

Authentication is handled exclusively by **Supabase Auth** (`auth.users`). Passwords are never stored in application tables.

1. In the Supabase Dashboard, open **Authentication → Users → Add user** and create the administrator user (e.g. `htwma@gmail.com`).
2. Copy the user's `UUID` and authorize them in `public.admin_users`:

```sql
INSERT INTO public.admin_users (id, email, display_name, role, is_active)
VALUES ('<auth-user-uuid>', 'htwma@gmail.com', 'HTWMA Admin', 'super_admin', true)
ON CONFLICT (id) DO UPDATE SET is_active = true, role = 'super_admin';
```

## 4. Storage Buckets

| Bucket              | Visibility                                       | Purpose                                                             | Max Size | Allowed MIME Types   |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------- | -------- | -------------------- |
| `member-photos`     | **Private** (Admin signed URLs only)             | Member passport photos                                              | 8 MB     | JPEG, PNG, WebP      |
| `member-documents`  | **Private** (Admin signed URLs only)             | Aadhaar, PAN, Driving Licence, and supporting files                 | 10 MB    | JPEG, PNG, WebP, PDF |
| `member-signatures` | **Private** (Admin signed URLs only)             | Member signature scans                                              | 5 MB     | JPEG, PNG, WebP      |
| `public-media`      | **Public** (Read-only for visitors, Admin write) | Published gallery images, committee public photos, association logo | 10 MB    | JPEG, PNG, WebP, SVG |
