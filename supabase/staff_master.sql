alter table public.staff_master add column if not exists platform text;
alter table public.staff_master add column if not exists group_name text;
alter table public.staff_master add column if not exists status text;
create unique index if not exists staff_master_employee_id_key on public.staff_master (employee_id);
alter table public.staff_master enable row level security;
grant select on public.staff_master to anon, authenticated;

drop policy if exists "Public staff read" on public.staff_master;
create policy "Public staff read" on public.staff_master for select to anon, authenticated using (true);
