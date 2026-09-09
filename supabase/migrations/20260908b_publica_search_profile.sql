-- Persistencia del perfil de búsqueda (filtros) del panel de autoservicio de
-- Pública (/publica-buscador), sobre organization_settings (V1, 0 filas hoy,
-- sin uso en el código — confirmado antes de escribir esto).
--
-- Mismo motivo que provision_self_serve_org() en
-- supabase/migrations/20260908_publica_self_serve_provisioning.sql:
-- `authenticated` tiene 0 privilegios de escritura sobre organization_settings
-- a propósito (V1: revoke insert, update, delete ... from authenticated), así
-- que guardar necesita una función `security definer` con contrato estrecho,
-- no una clave de privilegios elevados ni un grant directo.
--
-- No pisa la columna `settings` entera: la guarda mezclada con `||`, bajo la
-- clave `buscador_perfil`, para no romper otra feature que use otras claves
-- de ese mismo jsonb más adelante.
--
-- Lectura: no necesita esta función. `authenticated` ya tiene `select` sobre
-- esta tabla (policy "organization_settings_select_members" de la V1), así
-- que el endpoint de lectura usa la clave anon + el JWT del propio usuario,
-- igual que getProfile()/getMemberships() en api/auth/_lib/supabase.js.

begin;

create or replace function public.save_publica_search_profile(perfil jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if jsonb_typeof(perfil) is distinct from 'object' then
    raise exception 'perfil debe ser un objeto jsonb' using errcode = '22023';
  end if;

  select uo.organization_id into v_org_id
  from public.user_organizations uo
  where uo.user_id = auth.uid() and uo.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception 'not authenticated or no organization membership' using errcode = '28000';
  end if;

  insert into public.organization_settings (organization_id, settings, updated_at)
  values (v_org_id, jsonb_build_object('buscador_perfil', perfil), now())
  on conflict (organization_id) do update
    set settings = public.organization_settings.settings || jsonb_build_object('buscador_perfil', perfil),
        updated_at = now();
end;
$$;

revoke all on function public.save_publica_search_profile(jsonb) from public, anon;
grant execute on function public.save_publica_search_profile(jsonb) to authenticated;

commit;
