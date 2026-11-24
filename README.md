# HTWMA Member Hub

Official public website and administrator portal for **The Hindupur Two Wheelers Mechanic & Owners Association (HTWMA)**, Hindupur, Sri Sathya Sai District, Andhra Pradesh.

## Architecture

- **Frontend**: TanStack Start + React 19 + TypeScript (strict) + Tailwind CSS v4 + shadcn/ui
- **Backend & Database**: Supabase PostgreSQL (`szxfrbrppkofeoojzewq`) with Row Level Security (`FORCE ROW LEVEL SECURITY`) on every table
- **Authentication**: Supabase Auth (`public.admin_users` linked to `auth.users` with public sign-ups disabled)
- **Storage**: Supabase Storage with 3 private admin-only buckets (`member-photos`, `member-documents`, `member-signatures`) and 1 public media bucket (`public-media`)

## Database Schema (`supabase/migrations/`)

1. `admin_users` — Authorised association administrators linked to `auth.users` (`admin` / `super_admin` roles, active status, last login).
2. `member_sequences` — Atomic concurrency-safe counters (`SELECT ... FOR UPDATE`) for sequential membership numbers and fee receipt numbers.
3. `members` — Association member profiles, membership/registration numbers, garage details, DOB, blood group, nominee name/age, WhatsApp/mobile, emergency contact, workshop/residence addresses, masked ID last-4 digits, and status (`active` / `inactive` / `archived`).
4. `member_documents` — Restricted 1:1 table storing full Aadhaar, PAN, and Driving Licence numbers plus private document scan paths (`member-documents` bucket). Never accessible publicly.
5. `committee_roles` & `committee_members` — Office-bearer titles (President, Vice President, General Secretary, Secretary, Treasurer, Executive Committee Members) and term assignments with single-holder triggers and opt-in public phone projection (`get_public_committee()`).
6. `gallery` — Event, meeting, workshop, and community photos stored in `public-media`.
7. `announcements` — Official notices, meeting circulars, and welfare updates published on the Home and About pages.
8. `contact_messages` — Public visitor enquiries submitted from the Contact page (`submit_contact_message` RPC) and managed in the admin inbox.
9. `site_settings` — Singleton association identity, logo, address, phone/WhatsApp/email, social links, public copy, required form fields, and default fee amounts.
10. `member_fees` — Membership fee payments and printable receipts.
11. `activity_logs` — Tamper-resistant audit trail of administrator sign-ins, member mutations, sensitive ID/document views, and data exports.

See [`docs/supabase/SETUP.md`](docs/supabase/SETUP.md) and [`docs/supabase/schema.sql`](docs/supabase/schema.sql) for full database and RLS details.

## Local Development

1. Copy `.env.example` to `.env` and set your public Supabase URL and publishable/anon key:

   ```bash
   cp .env.example .env
   ```

   _(Never place a Supabase `service_role` or `sb_secret_*` key in `.env` or frontend code.)_

2. Install dependencies and start the development server:

   ```bash
   npm install
   npm run dev
   ```

3. Quality checks:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
