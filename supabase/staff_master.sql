create table if not exists public.staff_master (
  staff_id text primary key,
  platform text,
  group_name text,
  name text,
  role text,
  shift text,
  join_date text,
  status text,
  country text,
  department text
);

create unique index if not exists staff_master_staff_id_key on public.staff_master (staff_id);
alter table public.staff_master enable row level security;
grant select on public.staff_master to anon, authenticated;

drop policy if exists "Public staff read" on public.staff_master;
create policy "Public staff read" on public.staff_master for select to anon, authenticated using (true);
