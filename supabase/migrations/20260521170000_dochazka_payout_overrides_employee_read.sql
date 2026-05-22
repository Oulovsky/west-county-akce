-- Zaměstnanec vidí vlastní korekci částky v /moje (jen SELECT).

drop policy if exists "Zamestnanec cte vlastni korekci proplaceni" on public.dochazka_payout_overrides;

create policy "Zamestnanec cte vlastni korekci proplaceni"
on public.dochazka_payout_overrides
for select
to authenticated
using (user_id = auth.uid());
