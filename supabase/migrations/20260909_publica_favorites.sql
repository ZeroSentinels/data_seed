-- Licitaciones favoritas del panel de autoservicio de Pública
-- (/publica-buscador, sección "Favoritas"), sobre organization_settings —
-- misma tabla y mecanismo que supabase/migrations/20260908b (filtros) y
-- 20260908c (certificaciones).
--
-- Clave nueva, HERMANA de "buscador_perfil" y "certificaciones" dentro del
-- mismo jsonb `settings`: "favoritos". Mezclada con `||`, no pisa ninguna
-- de las otras dos.
--
-- Se guarda un snapshot liviano por licitación (codigo, nombre, organismo,
-- región, fecha de cierre, monto) en vez de solo el código: así la sección
-- "Favoritas" puede listarlas sin depender de una búsqueda activa ni de un
-- endpoint nuevo que las vuelva a traer de mp-api. `favoritos` es un ARRAY
-- jsonb completo (no un objeto por código): se reemplaza entero en cada
-- guardado, la lista la arma el cliente (agregar/quitar un favorito envía
-- la lista completa ya actualizada).
--
-- Lectura: no necesita esta función, mismo motivo que 20260908b/c —
-- `authenticated` ya tiene `select` sobre esta tabla (V1).

begin;

create or replace function public.save_publica_favorites(favoritos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if jsonb_typeof(favoritos) is distinct from 'array' then
    raise exception 'favoritos debe ser un array jsonb' using errcode = '22023';
  end if;

  select uo.organization_id into v_org_id
  from public.user_organizations uo
  where uo.user_id = auth.uid() and uo.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception 'not authenticated or no organization membership' using errcode = '28000';
  end if;

  insert into public.organization_settings (organization_id, settings, updated_at)
  values (v_org_id, jsonb_build_object('favoritos', favoritos), now())
  on conflict (organization_id) do update
    set settings = public.organization_settings.settings || jsonb_build_object('favoritos', favoritos),
        updated_at = now();
end;
$$;

revoke all on function public.save_publica_favorites(jsonb) from public, anon;
grant execute on function public.save_publica_favorites(jsonb) to authenticated;

commit;
