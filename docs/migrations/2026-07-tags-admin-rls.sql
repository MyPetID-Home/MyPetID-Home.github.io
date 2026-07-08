-- Restore/ensure admin tag inventory RLS policies for live card generation.
-- Admin profile means public.profiles.is_admin=true or tier='admin'.

alter table public.tags enable row level security;

drop policy if exists "tags admin insert" on public.tags;
create policy "tags admin insert"
on public.tags for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.is_admin or p.tier = 'admin')
  )
);

drop policy if exists "tags owner claim or admin update" on public.tags;
create policy "tags owner claim or admin update"
on public.tags for update to authenticated
using (
  pet_id is null
  or created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.is_admin or p.tier = 'admin')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.is_admin or p.tier = 'admin')
  )
);

drop policy if exists "tags admin delete" on public.tags;
create policy "tags admin delete"
on public.tags for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.is_admin or p.tier = 'admin')
  )
);
