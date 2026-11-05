-- Users that exist BEFORE the multi-company migration (profiles are created by the auth trigger).
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'staff@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'client@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'inactive@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'approved-client@test.local');
UPDATE public.profiles SET role = 'super_admin', is_admin = true WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'staff' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';
UPDATE public.profiles SET role = 'staff', is_active = false WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004';
UPDATE public.profiles SET permissions = '{"journal": ["view"]}' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000006';
