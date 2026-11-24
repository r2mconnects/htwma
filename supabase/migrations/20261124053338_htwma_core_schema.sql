-- Migration: 20261124053338_htwma_core_schema
-- HTWMA (Hindupur Two Wheelers Mechanic & Owners Association) – Core PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_member_number(val text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE
    WHEN btrim(val) ~ '^[0-9]+$' THEN COALESCE(NULLIF(ltrim(btrim(val), '0'), ''), '0')
    ELSE upper(btrim(val))
  END;
$$;

-- 1. admin_users: Admin accounts, roles, permissions, and account status (linked to Supabase Auth)
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text NOT NULL DEFAULT 'HTWMA Admin' CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'editor', 'viewer')),
  permissions jsonb NOT NULL DEFAULT '["members:manage","documents:view","committee:manage","gallery:manage","announcements:manage","messages:manage","fees:manage","settings:manage","audit:view"]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. member_sequences: Sequential membership & receipt numbers without duplicates
CREATE TABLE public.member_sequences (
  sequence_key text PRIMARY KEY CHECK (sequence_key ~ '^[a-z0-9_]+$'),
  prefix text NOT NULL DEFAULT '',
  current_value bigint NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  pad_length integer NOT NULL DEFAULT 3 CHECK (pad_length BETWEEN 1 AND 10),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. members: Association member directory records (sensitive IDs excluded; stored in member_documents)
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number text NOT NULL CHECK (char_length(btrim(member_number)) BETWEEN 1 AND 20 AND btrim(member_number) ~ '^[A-Za-z0-9/-]+$'),
  normalized_member_number text GENERATED ALWAYS AS (public.normalize_member_number(member_number)) STORED,
  registration_number text NOT NULL DEFAULT '' CHECK (char_length(registration_number) <= 40),
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  garage_name text NOT NULL DEFAULT '' CHECK (char_length(garage_name) <= 150),
  photo_path text,
  signature_path text,
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500),
  residence_address text NOT NULL DEFAULT '' CHECK (char_length(residence_address) <= 500),
  date_of_birth date CHECK (date_of_birth IS NULL OR (date_of_birth >= DATE '1920-01-01' AND date_of_birth <= CURRENT_DATE)),
  blood_group text NOT NULL DEFAULT '' CHECK (blood_group IN ('', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  nominee_name text NOT NULL DEFAULT '' CHECK (char_length(nominee_name) <= 120),
  nominee_age integer CHECK (nominee_age IS NULL OR (nominee_age >= 0 AND nominee_age <= 120)),
  mobile text NOT NULL DEFAULT '' CHECK (mobile = '' OR mobile ~ '^[6-9][0-9]{9}$'),
  whatsapp_number text NOT NULL DEFAULT '' CHECK (whatsapp_number = '' OR whatsapp_number ~ '^[6-9][0-9]{9}$'),
  emergency_contact text NOT NULL DEFAULT '' CHECK (emergency_contact = '' OR emergency_contact ~ '^[6-9][0-9]{9}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  registration_date date DEFAULT CURRENT_DATE,
  consent_given boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  aadhaar_last4 text NOT NULL DEFAULT '' CHECK (char_length(aadhaar_last4) <= 4),
  pan_last4 text NOT NULL DEFAULT '' CHECK (char_length(pan_last4) <= 4),
  dl_last4 text NOT NULL DEFAULT '' CHECK (char_length(dl_last4) <= 4),
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_normalized_member_number_key UNIQUE (normalized_member_number)
);

-- 3. member_documents: Private Aadhaar, PAN, Driving Licence numbers & private document storage paths
CREATE TABLE public.member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  aadhaar_number text NOT NULL DEFAULT '' CHECK (aadhaar_number = '' OR aadhaar_number ~ '^[0-9]{12}$'),
  pan_number text NOT NULL DEFAULT '' CHECK (pan_number = '' OR pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  driving_licence_number text NOT NULL DEFAULT '' CHECK (driving_licence_number = '' OR driving_licence_number ~ '^[A-Z0-9-]{8,25}$'),
  aadhaar_doc_path text,
  pan_doc_path text,
  dl_doc_path text,
  other_doc_path text,
  other_doc_label text NOT NULL DEFAULT '' CHECK (char_length(other_doc_label) <= 120),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  updated_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Committee role definitions (President, Vice President, General Secretary, Secretary, Treasurer, Executive Committee Member)
CREATE TABLE public.committee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL UNIQUE CHECK (char_length(btrim(role_name)) BETWEEN 2 AND 80),
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order >= 1),
  is_multiple_allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. committee_members: Office-bearers and Executive Committee assignments linked to members
CREATE TABLE public.committee_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.committee_roles(id) ON DELETE RESTRICT,
  term_start date,
  term_end date CHECK (term_end IS NULL OR term_start IS NULL OR term_end >= term_start),
  public_phone text NOT NULL DEFAULT '' CHECK (public_phone = '' OR public_phone ~ '^[6-9][0-9]{9}$'),
  show_phone boolean NOT NULL DEFAULT false,
  public_photo_path text,
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order >= 1),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. gallery: Event photos, meeting photos, descriptions, categories, storage paths, and upload dates
CREATE TABLE public.gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_path text NOT NULL CHECK (char_length(btrim(image_path)) >= 1),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 500),
  category text NOT NULL DEFAULT 'Events' CHECK (category IN ('Office', 'Meetings', 'Events', 'Activities', 'Other')),
  event_date date,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  alt_text text NOT NULL DEFAULT '' CHECK (char_length(alt_text) <= 200),
  credit text NOT NULL DEFAULT '' CHECK (char_length(credit) <= 150),
  is_published boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 1,
  is_demo boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. announcements: Association news, notices, and updates
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 150),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  category text NOT NULL DEFAULT 'Notice' CHECK (category IN ('Notice', 'Meeting', 'Event', 'Welfare', 'General')),
  published_date date NOT NULL DEFAULT CURRENT_DATE,
  is_published boolean NOT NULL DEFAULT true,
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. contact_messages: Messages submitted through the public contact form
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL CHECK (char_length(btrim(sender_name)) BETWEEN 2 AND 100),
  sender_phone text NOT NULL DEFAULT '' CHECK (sender_phone = '' OR sender_phone ~ '^[6-9][0-9]{9}$'),
  sender_email text NOT NULL DEFAULT '' CHECK (sender_email = '' OR sender_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 160),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 5 AND 2000),
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  admin_notes text NOT NULL DEFAULT '' CHECK (char_length(admin_notes) <= 1000),
  replied_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. site_settings: Association name, logo, address, phone, email, social links, and website configuration
CREATE TABLE public.site_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  association_name text NOT NULL DEFAULT 'Hindupur Two Wheelers Mechanic & Owners Association',
  short_name text NOT NULL DEFAULT 'HTWMA',
  tagline text NOT NULL DEFAULT 'Together for a Stronger Two Wheeler Community',
  logo_path text,
  location_label text NOT NULL DEFAULT 'Hindupur, Andhra Pradesh',
  address text NOT NULL DEFAULT '#17-8-146, Ward No.17, Parigi Road, Hindupur-515201, Sri Sathya Sai Dist., Andhra Pradesh',
  phone text NOT NULL DEFAULT '7386557855' CHECK (phone = '' OR phone ~ '^[6-9][0-9]{9}$'),
  whatsapp text NOT NULL DEFAULT '7386557855' CHECK (whatsapp = '' OR whatsapp ~ '^[6-9][0-9]{9}$'),
  email text NOT NULL DEFAULT '' CHECK (email = '' OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  office_hours text NOT NULL DEFAULT '[Placeholder] Office hours to be confirmed',
  map_url text NOT NULL DEFAULT 'https://www.google.com/maps/search/?api=1&query=Parigi+Road+Hindupur+515201',
  facebook_url text NOT NULL DEFAULT '',
  youtube_url text NOT NULL DEFAULT '',
  x_url text NOT NULL DEFAULT '',
  home_intro text NOT NULL DEFAULT '',
  about_intro text NOT NULL DEFAULT '',
  mission text NOT NULL DEFAULT '',
  vision text NOT NULL DEFAULT '',
  history text NOT NULL DEFAULT '',
  activities text NOT NULL DEFAULT '',
  form_code text NOT NULL DEFAULT 'REGISTRATION FORM F-140/2020, HINDUPUR',
  required_fields jsonb NOT NULL DEFAULT '["mobile"]'::jsonb,
  fee_defaults jsonb NOT NULL DEFAULT '{"Registration": 199, "Annual": 199}'::jsonb,
  updated_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. activity_logs: Tamper-resistant audit trail of admin operations
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  admin_email text NOT NULL DEFAULT '',
  action text NOT NULL CHECK (char_length(btrim(action)) BETWEEN 1 AND 60),
  entity_type text NOT NULL CHECK (char_length(btrim(entity_type)) BETWEEN 1 AND 60),
  entity_id text NOT NULL DEFAULT '-',
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 500),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Member fee payments (joining, annual, monthly, donations, fines)
CREATE TABLE public.member_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount >= 1 AND amount <= 1000000),
  fee_type text NOT NULL CHECK (fee_type IN ('Registration', 'Annual', 'Monthly', 'Donation', 'Fine', 'Other')),
  payment_mode text NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank transfer', 'Cheque')),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  period text NOT NULL DEFAULT '' CHECK (char_length(period) <= 30),
  receipt_number text NOT NULL UNIQUE CHECK (char_length(btrim(receipt_number)) BETWEEN 1 AND 30),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 300),
  is_demo boolean NOT NULL DEFAULT false,
  recorded_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
