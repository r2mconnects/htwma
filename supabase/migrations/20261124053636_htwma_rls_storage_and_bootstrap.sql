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
