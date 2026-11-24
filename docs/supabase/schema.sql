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
-- Migration: 20261124053528_htwma_indexes_triggers_and_rpcs
-- HTWMA Indexes, Sequence Triggers, and Transactional PostgreSQL Functions

CREATE INDEX members_status_idx ON public.members (status);
CREATE INDEX members_blood_group_idx ON public.members (blood_group);
CREATE INDEX members_registration_date_idx ON public.members (registration_date DESC);
CREATE INDEX members_created_at_idx ON public.members (created_at DESC);
CREATE INDEX members_mobile_idx ON public.members (mobile);
CREATE INDEX members_whatsapp_idx ON public.members (whatsapp_number);
CREATE INDEX members_full_name_trgm_idx ON public.members USING gin (full_name extensions.gin_trgm_ops);
CREATE INDEX members_garage_name_trgm_idx ON public.members USING gin (garage_name extensions.gin_trgm_ops);
CREATE INDEX members_member_number_trgm_idx ON public.members USING gin (member_number extensions.gin_trgm_ops);
CREATE INDEX members_mobile_trgm_idx ON public.members USING gin (mobile extensions.gin_trgm_ops);

CREATE INDEX committee_members_role_id_idx ON public.committee_members (role_id);
CREATE INDEX committee_members_member_id_idx ON public.committee_members (member_id);
CREATE INDEX committee_members_active_order_idx ON public.committee_members (is_active, display_order);

CREATE INDEX gallery_published_order_idx ON public.gallery (is_published, display_order);
CREATE INDEX gallery_category_idx ON public.gallery (category);
CREATE INDEX gallery_uploaded_at_idx ON public.gallery (uploaded_at DESC);

CREATE INDEX announcements_published_idx ON public.announcements (is_published, is_pinned DESC, published_date DESC);
CREATE INDEX announcements_category_idx ON public.announcements (category);

CREATE INDEX contact_messages_status_created_idx ON public.contact_messages (status, created_at DESC);

CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX activity_logs_entity_type_idx ON public.activity_logs (entity_type);
CREATE INDEX activity_logs_admin_id_idx ON public.activity_logs (admin_id);

CREATE INDEX member_fees_member_id_idx ON public.member_fees (member_id);
CREATE INDEX member_fees_paid_on_idx ON public.member_fees (paid_on DESC);
CREATE INDEX member_fees_type_period_idx ON public.member_fees (fee_type, period);

-- Automatic updated_at triggers
CREATE TRIGGER set_admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_member_sequences_updated_at BEFORE UPDATE ON public.member_sequences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_member_documents_updated_at BEFORE UPDATE ON public.member_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_committee_roles_updated_at BEFORE UPDATE ON public.committee_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_committee_members_updated_at BEFORE UPDATE ON public.committee_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_gallery_updated_at BEFORE UPDATE ON public.gallery FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_contact_messages_updated_at BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_member_fees_updated_at BEFORE UPDATE ON public.member_fees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic sequence allocator for membership numbers & fee receipts
CREATE OR REPLACE FUNCTION public.allocate_sequence_value(
  p_key text,
  p_default_prefix text DEFAULT '',
  p_default_pad integer DEFAULT 3
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq public.member_sequences;
  v_candidate text;
  v_next bigint;
BEGIN
  INSERT INTO public.member_sequences (sequence_key, prefix, current_value, pad_length)
  VALUES (p_key, p_default_prefix, 0, p_default_pad)
  ON CONFLICT (sequence_key) DO NOTHING;

  SELECT * INTO v_seq
  FROM public.member_sequences
  WHERE sequence_key = p_key
  FOR UPDATE;

  v_next := v_seq.current_value;

  LOOP
    v_next := v_next + 1;
    IF v_next::text ~ '^[0-9]+$' AND char_length(v_next::text) >= v_seq.pad_length THEN
      v_candidate := v_seq.prefix || v_next::text;
    ELSE
      v_candidate := v_seq.prefix || lpad(v_next::text, v_seq.pad_length, '0');
    END IF;

    IF p_key = 'member' THEN
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.members
        WHERE normalized_member_number = public.normalize_member_number(v_candidate)
      );
    ELSIF p_key = 'receipt' THEN
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.member_fees
        WHERE upper(receipt_number) = upper(v_candidate)
      );
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE public.member_sequences
  SET current_value = v_next, updated_at = now()
  WHERE sequence_key = p_key;

  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.members_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
BEGIN
  IF NEW.member_number IS NULL OR btrim(NEW.member_number) = '' THEN
    NEW.member_number := public.allocate_sequence_value('member', '', 3);
  ELSE
    NEW.member_number := btrim(NEW.member_number);
  END IF;

  NEW.full_name := btrim(NEW.full_name);
  NEW.garage_name := btrim(COALESCE(NEW.garage_name, ''));
  NEW.registration_number := btrim(COALESCE(NEW.registration_number, ''));
  NEW.address := btrim(COALESCE(NEW.address, ''));
  NEW.residence_address := btrim(COALESCE(NEW.residence_address, ''));
  NEW.nominee_name := btrim(COALESCE(NEW.nominee_name, ''));
  NEW.mobile := btrim(COALESCE(NEW.mobile, ''));
  NEW.whatsapp_number := btrim(COALESCE(NEW.whatsapp_number, ''));
  NEW.emergency_contact := btrim(COALESCE(NEW.emergency_contact, ''));
  NEW.notes := btrim(COALESCE(NEW.notes, ''));

  IF NEW.whatsapp_number = '' AND NEW.mobile <> '' THEN
    NEW.whatsapp_number := NEW.mobile;
  ELSIF NEW.mobile = '' AND NEW.whatsapp_number <> '' THEN
    NEW.mobile := NEW.whatsapp_number;
  END IF;

  IF NEW.registration_number = '' THEN
    NEW.registration_number := 'HTWMA-' || NEW.member_number;
  END IF;

  IF NEW.member_number ~ '^[0-9]+$' THEN
    v_num := NEW.member_number::bigint;
    INSERT INTO public.member_sequences (sequence_key, prefix, current_value, pad_length)
    VALUES ('member', '', v_num, 3)
    ON CONFLICT (sequence_key) DO UPDATE
    SET current_value = GREATEST(public.member_sequences.current_value, EXCLUDED.current_value),
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER members_before_write_trg
BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.members_before_write();

CREATE OR REPLACE FUNCTION public.member_documents_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.aadhaar_number := regexp_replace(COALESCE(NEW.aadhaar_number, ''), '[\s-]+', '', 'g');
  NEW.pan_number := upper(btrim(COALESCE(NEW.pan_number, '')));
  NEW.driving_licence_number := upper(regexp_replace(COALESCE(NEW.driving_licence_number, ''), '\s+', '', 'g'));
  NEW.other_doc_label := btrim(COALESCE(NEW.other_doc_label, ''));
  NEW.notes := btrim(COALESCE(NEW.notes, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER member_documents_before_write_trg
BEFORE INSERT OR UPDATE ON public.member_documents
FOR EACH ROW EXECUTE FUNCTION public.member_documents_before_write();

CREATE OR REPLACE FUNCTION public.sync_member_document_last4()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_dl text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.members
    SET aadhaar_last4 = '', pan_last4 = '', dl_last4 = ''
    WHERE id = OLD.member_id;
    RETURN OLD;
  END IF;

  v_clean_dl := regexp_replace(COALESCE(NEW.driving_licence_number, ''), '[\s-]+', '', 'g');
  UPDATE public.members
  SET
    aadhaar_last4 = CASE WHEN NEW.aadhaar_number <> '' THEN right(NEW.aadhaar_number, 4) ELSE '' END,
    pan_last4 = CASE WHEN NEW.pan_number <> '' THEN right(NEW.pan_number, 4) ELSE '' END,
    dl_last4 = CASE WHEN v_clean_dl <> '' THEN right(v_clean_dl, 4) ELSE '' END
  WHERE id = NEW.member_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_member_document_last4_trg
AFTER INSERT OR UPDATE OR DELETE ON public.member_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_member_document_last4();

CREATE OR REPLACE FUNCTION public.member_fees_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match text[];
  v_num bigint;
BEGIN
  IF NEW.receipt_number IS NULL OR btrim(NEW.receipt_number) = '' THEN
    NEW.receipt_number := public.allocate_sequence_value('receipt', 'R-', 4);
  ELSE
    NEW.receipt_number := btrim(NEW.receipt_number);
  END IF;

  v_match := regexp_match(upper(NEW.receipt_number), '^R-([0-9]+)$');
  IF v_match IS NOT NULL THEN
    v_num := v_match[1]::bigint;
    INSERT INTO public.member_sequences (sequence_key, prefix, current_value, pad_length)
    VALUES ('receipt', 'R-', v_num, 4)
    ON CONFLICT (sequence_key) DO UPDATE
    SET current_value = GREATEST(public.member_sequences.current_value, EXCLUDED.current_value),
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER member_fees_before_write_trg
BEFORE INSERT OR UPDATE ON public.member_fees
FOR EACH ROW EXECUTE FUNCTION public.member_fees_before_write();

CREATE OR REPLACE FUNCTION public.enforce_committee_role_cardinality()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role public.committee_roles;
BEGIN
  IF NEW.is_active THEN
    SELECT * INTO v_role FROM public.committee_roles WHERE id = NEW.role_id;
    IF v_role.id IS NULL THEN
      RAISE EXCEPTION 'Choose a valid committee role.' USING ERRCODE = '23503';
    END IF;
    IF NOT v_role.is_multiple_allowed AND EXISTS (
      SELECT 1 FROM public.committee_members
      WHERE role_id = NEW.role_id AND is_active = true AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION '% already has an active office-bearer. Deactivate them first.', v_role.role_name
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_committee_role_cardinality_trg
BEFORE INSERT OR UPDATE ON public.committee_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_committee_role_cardinality();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND auth.uid() = _user_id
    AND EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE id = _user_id
        AND is_active = true
        AND (_role = 'admin' OR role = _role OR role = 'super_admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS public.admin_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin public.admin_users;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_admin FROM public.admin_users WHERE id = auth.uid() AND is_active = true;
  IF v_admin.id IS NULL THEN
    RAISE EXCEPTION 'This account is not an authorised HTWMA administrator.' USING ERRCODE = '42501';
  END IF;
  RETURN v_admin;
END;
$$;

CREATE OR REPLACE FUNCTION public.peek_next_member_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq public.member_sequences;
  v_next bigint;
  v_candidate text;
BEGIN
  PERFORM public.require_admin();
  SELECT * INTO v_seq FROM public.member_sequences WHERE sequence_key = 'member';
  v_next := COALESCE(v_seq.current_value, 0);
  LOOP
    v_next := v_next + 1;
    IF char_length(v_next::text) >= COALESCE(v_seq.pad_length, 3) THEN
      v_candidate := COALESCE(v_seq.prefix, '') || v_next::text;
    ELSE
      v_candidate := COALESCE(v_seq.prefix, '') || lpad(v_next::text, COALESCE(v_seq.pad_length, 3), '0');
    END IF;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.members
      WHERE normalized_member_number = public.normalize_member_number(v_candidate)
    );
  END LOOP;
  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_member_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN public.allocate_sequence_value('member', '', 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_member_with_documents(
  p_member_id uuid,
  p_payload jsonb
)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin public.admin_users;
  v_member public.members;
  v_docs jsonb;
  v_fee jsonb;
BEGIN
  v_admin := public.require_admin();
  v_docs := COALESCE(p_payload->'documents', '{}'::jsonb);

  IF p_member_id IS NULL THEN
    INSERT INTO public.members (
      member_number,
      registration_number,
      full_name,
      garage_name,
      photo_path,
      signature_path,
      address,
      residence_address,
      date_of_birth,
      blood_group,
      nominee_name,
      nominee_age,
      mobile,
      whatsapp_number,
      emergency_contact,
      status,
      registration_date,
      consent_given,
      notes,
      created_by
    ) VALUES (
      COALESCE(p_payload->>'member_number', ''),
      COALESCE(p_payload->>'registration_number', ''),
      COALESCE(p_payload->>'full_name', ''),
      COALESCE(p_payload->>'garage_name', ''),
      NULLIF(p_payload->>'photo_path', ''),
      NULLIF(p_payload->>'signature_path', ''),
      COALESCE(p_payload->>'address', ''),
      COALESCE(p_payload->>'residence_address', ''),
      NULLIF(p_payload->>'date_of_birth', '')::date,
      COALESCE(p_payload->>'blood_group', ''),
      COALESCE(p_payload->>'nominee_name', ''),
      CASE WHEN NULLIF(p_payload->>'nominee_age', '') IS NOT NULL THEN (p_payload->>'nominee_age')::integer ELSE NULL END,
      COALESCE(p_payload->>'mobile', ''),
      COALESCE(p_payload->>'whatsapp_number', COALESCE(p_payload->>'mobile', '')),
      COALESCE(p_payload->>'emergency_contact', ''),
      COALESCE(NULLIF(p_payload->>'status', ''), 'active'),
      COALESCE(NULLIF(p_payload->>'registration_date', '')::date, CURRENT_DATE),
      COALESCE((p_payload->>'consent_given')::boolean, false),
      COALESCE(p_payload->>'notes', ''),
      v_admin.id
    )
    RETURNING * INTO v_member;
  ELSE
    UPDATE public.members
    SET
      member_number = COALESCE(p_payload->>'member_number', member_number),
      registration_number = COALESCE(p_payload->>'registration_number', registration_number),
      full_name = COALESCE(p_payload->>'full_name', full_name),
      garage_name = COALESCE(p_payload->>'garage_name', garage_name),
      photo_path = CASE WHEN p_payload ? 'photo_path' THEN NULLIF(p_payload->>'photo_path', '') ELSE photo_path END,
      signature_path = CASE WHEN p_payload ? 'signature_path' THEN NULLIF(p_payload->>'signature_path', '') ELSE signature_path END,
      address = COALESCE(p_payload->>'address', address),
      residence_address = COALESCE(p_payload->>'residence_address', residence_address),
      date_of_birth = CASE WHEN p_payload ? 'date_of_birth' THEN NULLIF(p_payload->>'date_of_birth', '')::date ELSE date_of_birth END,
      blood_group = COALESCE(p_payload->>'blood_group', blood_group),
      nominee_name = COALESCE(p_payload->>'nominee_name', nominee_name),
      nominee_age = CASE WHEN p_payload ? 'nominee_age' THEN (CASE WHEN NULLIF(p_payload->>'nominee_age', '') IS NOT NULL THEN (p_payload->>'nominee_age')::integer ELSE NULL END) ELSE nominee_age END,
      mobile = COALESCE(p_payload->>'mobile', mobile),
      whatsapp_number = COALESCE(p_payload->>'whatsapp_number', COALESCE(p_payload->>'mobile', whatsapp_number)),
      emergency_contact = COALESCE(p_payload->>'emergency_contact', emergency_contact),
      status = COALESCE(NULLIF(p_payload->>'status', ''), status),
      registration_date = CASE WHEN p_payload ? 'registration_date' THEN NULLIF(p_payload->>'registration_date', '')::date ELSE registration_date END,
      consent_given = COALESCE((p_payload->>'consent_given')::boolean, consent_given),
      notes = COALESCE(p_payload->>'notes', notes)
    WHERE id = p_member_id
    RETURNING * INTO v_member;

    IF v_member.id IS NULL THEN
      RAISE EXCEPTION 'Member not found.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.member_documents (
    member_id,
    aadhaar_number,
    pan_number,
    driving_licence_number,
    aadhaar_doc_path,
    pan_doc_path,
    dl_doc_path,
    other_doc_path,
    other_doc_label,
    notes,
    updated_by
  ) VALUES (
    v_member.id,
    COALESCE(v_docs->>'aadhaar_number', ''),
    COALESCE(v_docs->>'pan_number', ''),
    COALESCE(v_docs->>'driving_licence_number', ''),
    NULLIF(v_docs->>'aadhaar_doc_path', ''),
    NULLIF(v_docs->>'pan_doc_path', ''),
    NULLIF(v_docs->>'dl_doc_path', ''),
    NULLIF(v_docs->>'other_doc_path', ''),
    COALESCE(v_docs->>'other_doc_label', ''),
    COALESCE(v_docs->>'notes', ''),
    v_admin.id
  )
  ON CONFLICT (member_id) DO UPDATE
  SET
    aadhaar_number = EXCLUDED.aadhaar_number,
    pan_number = EXCLUDED.pan_number,
    driving_licence_number = EXCLUDED.driving_licence_number,
    aadhaar_doc_path = CASE WHEN v_docs ? 'aadhaar_doc_path' THEN EXCLUDED.aadhaar_doc_path ELSE public.member_documents.aadhaar_doc_path END,
    pan_doc_path = CASE WHEN v_docs ? 'pan_doc_path' THEN EXCLUDED.pan_doc_path ELSE public.member_documents.pan_doc_path END,
    dl_doc_path = CASE WHEN v_docs ? 'dl_doc_path' THEN EXCLUDED.dl_doc_path ELSE public.member_documents.dl_doc_path END,
    other_doc_path = CASE WHEN v_docs ? 'other_doc_path' THEN EXCLUDED.other_doc_path ELSE public.member_documents.other_doc_path END,
    other_doc_label = CASE WHEN v_docs ? 'other_doc_label' THEN EXCLUDED.other_doc_label ELSE public.member_documents.other_doc_label END,
    notes = CASE WHEN v_docs ? 'notes' THEN EXCLUDED.notes ELSE public.member_documents.notes END,
    updated_by = v_admin.id;

  IF p_member_id IS NULL AND jsonb_typeof(p_payload->'initial_fees') = 'array' THEN
    FOR v_fee IN SELECT * FROM jsonb_array_elements(p_payload->'initial_fees')
    LOOP
      INSERT INTO public.member_fees (
        member_id,
        amount,
        fee_type,
        payment_mode,
        paid_on,
        period,
        receipt_number,
        notes,
        recorded_by
      ) VALUES (
        v_member.id,
        (v_fee->>'amount')::integer,
        v_fee->>'fee_type',
        COALESCE(NULLIF(v_fee->>'payment_mode', ''), 'Cash'),
        COALESCE(NULLIF(v_fee->>'paid_on', '')::date, CURRENT_DATE),
        COALESCE(v_fee->>'period', ''),
        COALESCE(v_fee->>'receipt_number', ''),
        COALESCE(v_fee->>'notes', 'Collected at registration'),
        v_admin.id
      );
    END LOOP;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_member.id;

  INSERT INTO public.activity_logs (admin_id, admin_email, action, entity_type, entity_id, summary)
  VALUES (
    v_admin.id,
    v_admin.email,
    CASE WHEN p_member_id IS NULL THEN 'create' ELSE 'update' END,
    'member',
    v_member.id::text,
    CASE WHEN p_member_id IS NULL
      THEN 'Added member #' || v_member.member_number || ' (' || v_member.full_name || ')'
      ELSE 'Updated member #' || v_member.member_number || ' (' || v_member.full_name || ')'
    END
  );

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_import_members(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin public.admin_users;
  v_item jsonb;
  v_docs jsonb;
  v_norm text;
  v_member public.members;
  v_added integer := 0;
BEGIN
  v_admin := public.require_admin();
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Import payload must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_norm := public.normalize_member_number(COALESCE(v_item->>'member_number', ''));
    IF v_norm = '' OR EXISTS (SELECT 1 FROM public.members WHERE normalized_member_number = v_norm) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.members (
      member_number,
      registration_number,
      full_name,
      garage_name,
      address,
      residence_address,
      date_of_birth,
      blood_group,
      nominee_name,
      nominee_age,
      mobile,
      whatsapp_number,
      emergency_contact,
      status,
      registration_date,
      consent_given,
      notes,
      created_by
    ) VALUES (
      COALESCE(v_item->>'member_number', ''),
      COALESCE(v_item->>'registration_number', ''),
      COALESCE(v_item->>'full_name', ''),
      COALESCE(v_item->>'garage_name', ''),
      COALESCE(v_item->>'address', ''),
      COALESCE(v_item->>'residence_address', ''),
      NULLIF(v_item->>'date_of_birth', '')::date,
      COALESCE(v_item->>'blood_group', ''),
      COALESCE(v_item->>'nominee_name', ''),
      CASE WHEN NULLIF(v_item->>'nominee_age', '') IS NOT NULL THEN (v_item->>'nominee_age')::integer ELSE NULL END,
      COALESCE(v_item->>'mobile', ''),
      COALESCE(v_item->>'whatsapp_number', COALESCE(v_item->>'mobile', '')),
      COALESCE(v_item->>'emergency_contact', ''),
      COALESCE(NULLIF(v_item->>'status', ''), 'active'),
      COALESCE(NULLIF(v_item->>'registration_date', '')::date, CURRENT_DATE),
      COALESCE((v_item->>'consent_given')::boolean, false),
      COALESCE(v_item->>'notes', ''),
      v_admin.id
    )
    RETURNING * INTO v_member;

    v_docs := COALESCE(v_item->'documents', '{}'::jsonb);
    INSERT INTO public.member_documents (
      member_id,
      aadhaar_number,
      pan_number,
      driving_licence_number,
      updated_by
    ) VALUES (
      v_member.id,
      COALESCE(v_docs->>'aadhaar_number', ''),
      COALESCE(v_docs->>'pan_number', ''),
      COALESCE(v_docs->>'driving_licence_number', ''),
      v_admin.id
    );

    v_added := v_added + 1;
  END LOOP;

  INSERT INTO public.activity_logs (admin_id, admin_email, action, entity_type, entity_id, summary)
  VALUES (v_admin.id, v_admin.email, 'import', 'member', '-', 'Imported ' || v_added || ' member(s)');

  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_member_permanently(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin public.admin_users;
  v_member public.members;
  v_docs public.member_documents;
  v_paths jsonb;
BEGIN
  v_admin := public.require_admin();
  SELECT * INTO v_member FROM public.members WHERE id = p_member_id;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Member not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_member.status <> 'archived' THEN
    RAISE EXCEPTION 'Archive the member before permanently deleting their record.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_docs FROM public.member_documents WHERE member_id = p_member_id;

  v_paths := jsonb_build_object(
    'photo_path', v_member.photo_path,
    'signature_path', v_member.signature_path,
    'aadhaar_doc_path', v_docs.aadhaar_doc_path,
    'pan_doc_path', v_docs.pan_doc_path,
    'dl_doc_path', v_docs.dl_doc_path,
    'other_doc_path', v_docs.other_doc_path
  );

  DELETE FROM public.members WHERE id = p_member_id;

  INSERT INTO public.activity_logs (admin_id, admin_email, action, entity_type, entity_id, summary)
  VALUES (
    v_admin.id,
    v_admin.email,
    'delete',
    'member',
    p_member_id::text,
    'Permanently deleted member #' || v_member.member_number || ' (' || v_member.full_name || ')'
  );

  RETURN v_paths;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_committee()
RETURNS TABLE (
  id uuid,
  name text,
  role_name text,
  role_order integer,
  display_order integer,
  phone text,
  photo_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.id,
    m.full_name AS name,
    cr.role_name,
    cr.display_order AS role_order,
    cm.display_order,
    CASE WHEN cm.show_phone AND cm.public_phone <> '' THEN cm.public_phone ELSE NULL END AS phone,
    cm.public_photo_path AS photo_path
  FROM public.committee_members cm
  JOIN public.committee_roles cr ON cr.id = cm.role_id
  JOIN public.members m ON m.id = cm.member_id
  WHERE cm.is_active = true
    AND m.status <> 'archived'
  ORDER BY cr.display_order ASC, cm.display_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.submit_contact_message(
  p_sender_name text,
  p_sender_phone text DEFAULT '',
  p_sender_email text DEFAULT '',
  p_subject text DEFAULT '',
  p_message text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_phone text;
BEGIN
  v_phone := regexp_replace(btrim(COALESCE(p_sender_phone, '')), '[\s\-().]+', '', 'g');
  IF v_phone LIKE '+91%' THEN
    v_phone := substr(v_phone, 4);
  ELSIF char_length(v_phone) = 12 AND v_phone LIKE '91%' THEN
    v_phone := substr(v_phone, 3);
  ELSIF char_length(v_phone) = 11 AND v_phone LIKE '0%' THEN
    v_phone := substr(v_phone, 2);
  END IF;

  INSERT INTO public.contact_messages (
    sender_name,
    sender_phone,
    sender_email,
    subject,
    message
  ) VALUES (
    btrim(COALESCE(p_sender_name, '')),
    v_phone,
    lower(btrim(COALESCE(p_sender_email, ''))),
    btrim(COALESCE(p_subject, '')),
    btrim(COALESCE(p_message, ''))
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
-- Migration: 20261124053636_htwma_rls_storage_and_bootstrap
-- HTWMA Row Level Security, Least-Privilege Grants, Storage Buckets, and Initial Bootstrap

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.member_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_sequences FORCE ROW LEVEL SECURITY;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.committee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery FORCE ROW LEVEL SECURITY;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements FORCE ROW LEVEL SECURITY;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.member_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_fees FORCE ROW LEVEL SECURITY;

-- Least-privilege table and function grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.gallery, public.announcements, public.site_settings, public.committee_roles TO anon;
GRANT INSERT (sender_name, sender_phone, sender_email, subject, message) ON public.contact_messages TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_committee() TO anon;
GRANT EXECUTE ON FUNCTION public.submit_contact_message(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.normalize_member_number(text) TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.members,
  public.member_documents,
  public.committee_roles,
  public.committee_members,
  public.gallery,
  public.announcements,
  public.contact_messages,
  public.member_fees
TO authenticated;

GRANT SELECT, INSERT, UPDATE ON
  public.site_settings,
  public.member_sequences,
  public.admin_users
TO authenticated;

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.is_admin(),
  public.has_role(uuid, text),
  public.require_admin(),
  public.peek_next_member_number(),
  public.next_member_number(),
  public.upsert_member_with_documents(uuid, jsonb),
  public.bulk_import_members(jsonb),
  public.delete_member_permanently(uuid),
  public.get_public_committee(),
  public.submit_contact_message(text, text, text, text, text),
  public.normalize_member_number(text)
TO authenticated;

-- RLS Policies
CREATE POLICY admin_users_select_admin
  ON public.admin_users FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY admin_users_update_self_or_super
  ON public.admin_users FOR UPDATE TO authenticated
  USING (public.is_admin() AND (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')))
  WITH CHECK (public.is_admin() AND (public.has_role(auth.uid(), 'super_admin') OR (id = auth.uid() AND is_active = true)));

CREATE POLICY admin_users_insert_super
  ON public.admin_users FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY member_sequences_admin_all
  ON public.member_sequences FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY members_admin_all
  ON public.members FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY member_documents_admin_all
  ON public.member_documents FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY committee_roles_public_select
  ON public.committee_roles FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY committee_roles_admin_write
  ON public.committee_roles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY committee_members_admin_all
  ON public.committee_members FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY gallery_public_published_select
  ON public.gallery FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE POLICY gallery_admin_all
  ON public.gallery FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY announcements_public_published_select
  ON public.announcements FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE POLICY announcements_admin_all
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY contact_messages_public_insert
  ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'unread' AND admin_notes = '' AND replied_by IS NULL);

CREATE POLICY contact_messages_admin_select
  ON public.contact_messages FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY contact_messages_admin_update
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY contact_messages_admin_delete
  ON public.contact_messages FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY site_settings_public_select
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY site_settings_admin_write
  ON public.site_settings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY activity_logs_admin_select
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY activity_logs_admin_insert
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND (admin_id IS NULL OR admin_id = auth.uid()));

CREATE POLICY member_fees_admin_all
  ON public.member_fees FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supabase Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('member-photos', 'member-photos', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('member-documents', 'member-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('member-signatures', 'member-signatures', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('public-media', 'public-media', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies
CREATE POLICY public_media_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'public-media');

CREATE POLICY public_media_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-media' AND public.is_admin());

CREATE POLICY public_media_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'public-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'public-media' AND public.is_admin());

CREATE POLICY public_media_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'public-media' AND public.is_admin());

CREATE POLICY private_member_buckets_admin_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('member-photos', 'member-documents', 'member-signatures') AND public.is_admin());

CREATE POLICY private_member_buckets_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('member-photos', 'member-documents', 'member-signatures') AND public.is_admin());

CREATE POLICY private_member_buckets_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('member-photos', 'member-documents', 'member-signatures') AND public.is_admin())
  WITH CHECK (bucket_id IN ('member-photos', 'member-documents', 'member-signatures') AND public.is_admin());

CREATE POLICY private_member_buckets_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('member-photos', 'member-documents', 'member-signatures') AND public.is_admin());

-- Initial structural seed rows
INSERT INTO public.member_sequences (sequence_key, prefix, current_value, pad_length)
VALUES
  ('member', '', 0, 3),
  ('receipt', 'R-', 0, 4)
ON CONFLICT (sequence_key) DO NOTHING;

INSERT INTO public.committee_roles (role_name, display_order, is_multiple_allowed)
VALUES
  ('President', 1, false),
  ('Vice President', 2, false),
  ('General Secretary', 3, false),
  ('Secretary', 4, false),
  ('Treasurer', 5, false),
  ('Executive Committee Member', 6, true)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO public.site_settings (
  id,
  association_name,
  short_name,
  tagline,
  location_label,
  address,
  phone,
  whatsapp,
  email,
  office_hours,
  map_url,
  home_intro,
  about_intro,
  mission,
  vision,
  history,
  activities,
  form_code,
  required_fields,
  fee_defaults
) VALUES (
  'default',
  'Hindupur Two Wheelers Mechanic & Owners Association',
  'HTWMA',
  'Together for a Stronger Two Wheeler Community',
  'Hindupur, Andhra Pradesh',
  '#17-8-146, Ward No.17, Parigi Road, Hindupur-515201, Sri Sathya Sai Dist., Andhra Pradesh',
  '7386557855',
  '7386557855',
  '',
  '[Placeholder] Office hours to be confirmed',
  'https://www.google.com/maps/search/?api=1&query=Parigi+Road+Hindupur+515201',
  'HTWMA is a dedicated association of Two Wheeler Mechanics and Owners in Hindupur, working together for the welfare, skill development and growth of our community.',
  'The Hindupur Two Wheelers Mechanic & Owners Association (HTWMA) brings together two-wheeler mechanics and workshop owners of Hindupur under one united platform.',
  'To support the welfare of our members, encourage fair and skilled service, and speak with one voice for the two-wheeler service community of Hindupur.',
  'A respected, skilled and united two-wheeler mechanic community that every vehicle owner in Hindupur can trust.',
  '[Placeholder] The association''s history, founding year and milestones will be added here once approved by the committee.',
  E'Regular members'' meetings and discussions\nWelfare support for members and their families\nSkill development and new-technology awareness\nRepresentation of members'' common concerns\nCommunity and social service activities',
  'REGISTRATION FORM F-140/2020, HINDUPUR',
  '["mobile"]'::jsonb,
  '{"Registration": 199, "Annual": 199}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.announcements (title, body, category, published_date, is_published, is_pinned)
VALUES (
  'Member records are going digital',
  'The association is moving its paper registration records to a secure digital system. Members may be contacted to confirm their details.',
  'Notice',
  CURRENT_DATE,
  true,
  true
);

-- Note: Create admin users via Supabase Auth Dashboard (Authentication → Users)
-- and insert their UUID + email into public.admin_users. Never store passwords in public tables.
