-- Demo users and bookings for the LOCAL emulator only (dev/local-supabase.mjs).
-- All demo users have the password: ferie2026
-- Dates are relative to today, so the calendar always looks alive.
-- Martin has an invitation but no account yet (shows the invite flow).

insert into public.invitations (email, full_name, role, token) values
  ('janne@familien.dk',     'Janne',     'admin',  'local-invite-janne-000000'),
  ('henrik@familien.dk',    'Henrik',    'admin',  'local-invite-henrik-00000'),
  ('maurits@familien.dk',   'Maurits',   'member', 'local-invite-maurits-0000'),
  ('majka@familien.dk',     'Majka',     'member', 'local-invite-majka-000000'),
  ('alicia@familien.dk',    'Alicia',    'member', 'local-invite-alicia-00000'),
  ('emil@familien.dk',      'Emil',      'member', 'local-invite-emil-0000000'),
  ('christian@familien.dk', 'Christian', 'member', 'local-invite-christian-00'),
  ('jorgen@familien.dk',    'Jørgen',    'member', 'local-invite-jorgen-00000'),
  ('martin@familien.dk',    'Martin',    'member', 'local-invite-martin-00000')
on conflict do nothing;

insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
select i.email, extensions.crypt('ferie2026', extensions.gen_salt('bf', 8)), now(),
       jsonb_build_object('invite_token', i.token)
from public.invitations i
where i.email <> 'martin@familien.dk'
  and not exists (select 1 from auth.users u where u.email = i.email)
order by i.created_at;

do $$
declare
  d date := (now() at time zone 'Europe/Copenhagen')::date;
  janne uuid := (select id from public.profiles where email = 'janne@familien.dk');
  henrik uuid := (select id from public.profiles where email = 'henrik@familien.dk');
  maurits uuid := (select id from public.profiles where email = 'maurits@familien.dk');
  majka uuid := (select id from public.profiles where email = 'majka@familien.dk');
  alicia uuid := (select id from public.profiles where email = 'alicia@familien.dk');
  emil uuid := (select id from public.profiles where email = 'emil@familien.dk');
  christian uuid := (select id from public.profiles where email = 'christian@familien.dk');
  jorgen uuid := (select id from public.profiles where email = 'jorgen@familien.dk');
  link uuid;
  b uuid;
begin
  if exists (select 1 from public.bookings) then
    return;
  end if;

  update public.profiles set phone = '+45 20 11 22 33' where id = maurits;

  insert into public.guest_links (label, property_id, created_by, token)
  values ('Peter og Anne', null, emil, 'local-guest-link-peter-000')
  returning id into link;

  -- Mallorca
  insert into public.bookings (property_id, kind, status, start_date, end_date, guests, user_id, person_name, comment, source, created_by, decided_by, decided_at, decision_note)
  values
    ('mallorca', 'stay', 'approved', d - 58, d - 51, 2, maurits,   'Maurits',   'Sommerferie', 'member', maurits, janne, now() - interval '90 days', null),
    ('mallorca', 'stay', 'approved', d + 11, d + 18, 4, maurits,   'Maurits',   'Os fire, efterårsferie', 'member', maurits, janne, now() - interval '5 days', 'Nøglen ligger hos Pep ved siden af. God tur!'),
    ('mallorca', 'stay', 'rejected', d + 13, d + 16, 2, majka,     'Majka',     null, 'member', majka, henrik, now() - interval '4 days', 'Desværre, Maurits har huset den uge. Hvad med i november?'),
    ('mallorca', 'stay', 'pending',  d + 45, d + 48, 3, alicia,    'Alicia',    'Forlænget weekend med veninderne', 'member', alicia, null, null, null),
    ('mallorca', 'stay', 'approved', d + 70, d + 77, 2, christian, 'Christian', 'Vandretur i bjergene', 'member', christian, janne, now() - interval '12 days', null),
    ('mallorca', 'stay', 'cancelled', d + 80, d + 84, 2, christian, 'Christian', null, 'member', christian, christian, now() - interval '2 days', 'Planerne er ændret');
  insert into public.bookings (property_id, kind, status, start_date, end_date, title, source, created_by, decided_by, decided_at)
  values
    ('mallorca', 'owner',   'approved', d + 25, d + 39, 'Janne & Henrik', 'admin', janne, janne, now()),
    ('mallorca', 'blocked', 'approved', d + 63, d + 67, 'Maler skodder', 'admin', henrik, henrik, now());
  insert into public.bookings (property_id, kind, status, start_date, end_date, guests, person_name, guest_email, guest_phone, guest_link_id, status_token, comment, source)
  values ('mallorca', 'stay', 'pending', d + 52, d + 56, 2, 'Peter Holm', 'peter@example.com', '+45 22 33 44 55', link,
          'local-status-token-peter-0001', 'Vi er venner af Emil og vil meget gerne låne huset et par dage.', 'guest');

  -- Sjællands Odde
  insert into public.bookings (property_id, kind, status, start_date, end_date, guests, user_id, person_name, comment, source, created_by, decided_by, decided_at)
  values
    ('odde', 'stay', 'approved', d - 79, d - 72, 5, emil,    'Emil',    null, 'member', emil, henrik, now() - interval '120 days'),
    ('odde', 'stay', 'approved', d + 4,  d + 6,  3, majka,   'Majka',   'Weekend med veninderne', 'member', majka, janne, now() - interval '10 days'),
    ('odde', 'stay', 'pending',  d + 18, d + 20, 2, maurits, 'Maurits', 'Hyggeweekend', 'member', maurits, null, null),
    ('odde', 'stay', 'approved', d + 25, d + 27, 4, jorgen,  'Jørgen',  'Fisketur med drengene', 'member', jorgen, henrik, now() - interval '3 days'),
    ('odde', 'stay', 'pending',  d + 44, d + 47, 6, emil,    'Emil',    'Fødselsdagsweekend', 'member', emil, null, null);
  insert into public.bookings (property_id, kind, status, start_date, end_date, title, source, created_by, decided_by, decided_at)
  values
    ('odde', 'owner',   'approved', d - 3,  d + 2,  'Janne & Henrik', 'admin', henrik, henrik, now() - interval '20 days'),
    ('odde', 'blocked', 'approved', d + 35, d + 39, 'Vinterklargøring', 'admin', henrik, henrik, now()),
    ('odde', 'owner',   'approved', (date_trunc('year', d) + interval '11 months 22 days')::date,
                                    (date_trunc('year', d) + interval '11 months 27 days')::date, 'Jul på Odden', 'admin', janne, janne, now());

  select id into b from public.bookings where person_name = 'Peter Holm';
  insert into public.booking_notes (booking_id, note, updated_by) values (b, 'Emil siger god for dem.', janne);

  update public.property_access set wifi_name = 'CasaSoller', wifi_password = 'naranjas2026',
    access_info = 'Nøgle hos naboen Pep (nr. 25). Ring på +34 600 000 000.' where property_id = 'mallorca';
  update public.property_access set wifi_name = 'Odden-Net', wifi_password = 'fyrretrae',
    access_info = 'Nøgleboks til venstre for hoveddøren. Kode: 1975.' where property_id = 'odde';
  update public.properties set contact_phone = '+45 20 00 00 01' where id = 'mallorca';
  update public.properties set contact_phone = '+45 20 00 00 02' where id = 'odde';
end $$;
