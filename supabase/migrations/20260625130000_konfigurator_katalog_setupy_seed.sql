-- Katalogové setupy pro klientský konfigurátor sestavy (idempotentní seed podle názvu).
-- Tabulka: public.setupy (stejná jako /sklad/setupy).

do $$
declare
  row record;
begin
  for row in
    select *
    from (
      values
        -- Střešení (oblast stage)
        ('Zastřešení 8 × 3 m', 'stage'::text, 10, 'Katalogový setup — zastřešení z konfigurátoru'),
        ('Zastřešení 8 × 4 m', 'stage', 11, 'Katalogový setup — zastřešení z konfigurátoru'),
        ('Zastřešení 8 × 6 m', 'stage', 12, 'Katalogový setup — zastřešení z konfigurátoru'),
        ('Zastřešení 8 × 7 m', 'stage', 13, 'Katalogový setup — zastřešení z konfigurátoru'),
        ('Zastřešení 10 × 8 m', 'stage', 14, 'Katalogový setup — zastřešení z konfigurátoru'),
        -- Pódium (oblast stage)
        ('Pódium 6 × 2', 'stage', 20, 'Katalogový setup — pódium navázané na střešení'),
        ('Pódium 6 × 3', 'stage', 21, 'Katalogový setup — pódium navázané na střešení'),
        ('Pódium 6 × 4', 'stage', 22, 'Katalogový setup — pódium navázané na střešení'),
        ('Pódium 6 × 6', 'stage', 23, 'Katalogový setup — pódium navázané na střešení'),
        ('Pódium 8 × 5', 'stage', 24, 'Katalogový setup — pódium navázané na střešení'),
        ('Pódium 8 × 6', 'stage', 25, 'Katalogový setup — pódium navázané na střešení'),
        ('Pódium 8 × 8', 'stage', 26, 'Katalogový setup — pódium navázané na střešení'),
        -- Praktikábl (oblast stage)
        ('Praktikábl 2 × 1', 'stage', 30, 'Katalogový setup — praktikábl z konfigurátoru'),
        ('Praktikábl 2 × 2', 'stage', 31, 'Katalogový setup — praktikábl z konfigurátoru'),
        ('Praktikábl 2 × 3', 'stage', 32, 'Katalogový setup — praktikábl z konfigurátoru'),
        -- Ostatní stage
        ('Mobilní stage', 'stage', 5, 'Katalogový setup — mobilní stage z konfigurátoru'),
        ('Branka', 'stage', 40, 'Katalogový setup — konstrukce branky (strana = parametr instance)'),
        -- Zvuk
        ('Malý PA systém', 'sound', 50, 'Katalogový setup — zvuková sestava z konfigurátoru'),
        ('Střední PA systém', 'sound', 51, 'Katalogový setup — zvuková sestava z konfigurátoru'),
        ('Velký PA systém', 'sound', 52, 'Katalogový setup — zvuková sestava z konfigurátoru'),
        -- Světla
        ('Malá světelná sestava', 'lights', 60, 'Katalogový setup — světelná sestava z konfigurátoru'),
        ('Střední světelná sestava', 'lights', 61, 'Katalogový setup — světelná sestava z konfigurátoru'),
        ('Velká světelná sestava', 'lights', 62, 'Katalogový setup — světelná sestava z konfigurátoru'),
        -- Dron
        ('Dron', 'dron', 70, 'Katalogový setup — dron ze skladu (bez obsluhy)')
    ) as v(nazev, oblast, poradi, popis)
  loop
    if not exists (
      select 1
      from public.setupy s
      where lower(trim(s.nazev)) = lower(trim(row.nazev))
    ) then
      insert into public.setupy (
        nazev,
        popis,
        aktivni,
        poradi,
        oblast,
        dostupne_v_portalu
      )
      values (
        row.nazev,
        row.popis,
        true,
        row.poradi,
        row.oblast,
        true
      );
    else
      -- Sjednotit metadata u existujícího záznamu (bez přepisování názvu).
      update public.setupy s
      set
        oblast = row.oblast,
        poradi = row.poradi,
        popis = coalesce(s.popis, row.popis),
        aktivni = true,
        dostupne_v_portalu = true
      where lower(trim(s.nazev)) = lower(trim(row.nazev));
    end if;
  end loop;
end
$$;
