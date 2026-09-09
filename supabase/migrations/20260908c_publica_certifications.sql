-- Certificaciones autodeclaradas (OS10, ISO 9001, ISO 45001) para el fit
-- score del panel de autoservicio de Pública (/publica-buscador), sobre
-- organization_settings — misma tabla y mismo mecanismo que
-- supabase/migrations/20260908b_publica_search_profile.sql.
--
-- Inspeccionado antes de escribir esto: la clave existente en
-- organization_settings.settings es "buscador_perfil" (filtros de búsqueda).
-- Esta función agrega "certificaciones" como clave HERMANA, mezclada con `||`
-- — no toca ni pisa "buscador_perfil" ni ninguna otra clave futura.
--
-- Lectura: no necesita esta función, mismo motivo que en
-- 20260908b — `authenticated` ya tiene `select` sobre esta tabla.

begin;

create or replace function public.save_publica_certifications(certs jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if jsonb_typeof(certs) is distinct from 'object' then
    raise exception 'certs debe ser un objeto jsonb' using errcode = '22023';
  end if;

  select uo.organization_id into v_org_id
  from public.user_organizations uo
  where uo.user_id = auth.uid() and uo.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception 'not authenticated or no organization membership' using errcode = '28000';
  end if;

  insert into public.organization_settings (organization_id, settings, updated_at)
  values (v_org_id, jsonb_build_object('certificaciones', certs), now())
  on conflict (organization_id) do update
    set settings = public.organization_settings.settings || jsonb_build_object('certificaciones', certs),
        updated_at = now();
end;
$$;

revoke all on function public.save_publica_certifications(jsonb) from public, anon;
grant execute on function public.save_publica_certifications(jsonb) to authenticated;

commit;
