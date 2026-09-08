-- Aprovisionamiento self-serve para Pública.
--
-- Reemplaza el plan original de usar SUPABASE_SERVICE_ROLE_KEY desde Node
-- (ver docs/security/service-role-key-decision.md — se descartó por exponer
-- una clave que ignora RLS al env compartido de Vercel, incluido el endpoint
-- anónimo api/demo-chat.js).
--
-- Mismo patrón que public.is_org_member() en la V1
-- (supabase/migrations/20260723_secure_multitenant_auth.sql):
--   - security definer: corre como su dueño, así que puede escribir aunque
--     `authenticated` tenga 0 privilegios de escritura sobre estas tablas.
--   - se otorga SOLO a `authenticated`: quien la llama ya tiene un JWT válido
--     (el signup/login se hizo antes con la clave anon).
--   - auth.uid() identifica al llamador; no recibe ningún id como parámetro,
--     así que no puede aprovisionar organizaciones para otra persona.
--   - idempotente: si el llamador ya tiene una membresía activa, la devuelve
--     tal cual y no crea nada nuevo.
--   - crea EXACTAMENTE una organización + una membresía, y activa el perfil
--     (perfil que handle_new_user ya insertó con is_active=false).
--   - deja rastro en audit_log.
--
-- Recomendado antes de aplicar en el proyecto real: correr este mismo bloque
-- dentro de `begin; ... rollback;` con un JWT simulado (mismo patrón dry-run
-- que documenta docs/TRASPASO-auth-supabase-20260908.md) para confirmar que
-- funciona antes del `commit`.

begin;

create or replace function public.provision_self_serve_org(org_name text default null)
returns table (organization_id uuid, organization_name text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org_id uuid;
  v_org_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Idempotencia: si ya tiene una organización activa, se devuelve tal cual.
  select o.id, o.name into v_org_id, v_org_name
  from public.user_organizations uo
  join public.organizations o on o.id = uo.organization_id
  where uo.user_id = v_uid and uo.is_active = true
  limit 1;

  if v_org_id is not null then
    return query select v_org_id, v_org_name, false;
    return;
  end if;

  select email into v_email from public.profiles where id = v_uid;
  if v_email is null then
    raise exception 'profile not found for %', v_uid using errcode = 'P0002';
  end if;

  v_org_name := coalesce(nullif(trim(org_name), ''), split_part(v_email, '@', 2), 'Organización');

  insert into public.organizations (name, type, plan, is_active)
  values (left(v_org_name, 200), 'client', 'free', true)
  returning id, name into v_org_id, v_org_name;

  insert into public.user_organizations (user_id, organization_id, role, is_active)
  values (v_uid, v_org_id, 'admin', true);

  update public.profiles
  set is_active = true, updated_at = now()
  where id = v_uid;

  insert into public.audit_log (user_id, organization_id, action, table_name, record_id, metadata)
  values (
    v_uid, v_org_id, 'publica_self_serve_provision', 'organizations', v_org_id,
    jsonb_build_object('org_name', v_org_name)
  );

  return query select v_org_id, v_org_name, true;
end;
$$;

revoke all on function public.provision_self_serve_org(text) from public, anon;
grant execute on function public.provision_self_serve_org(text) to authenticated;

commit;
