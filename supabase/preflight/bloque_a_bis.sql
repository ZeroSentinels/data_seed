-- BLOQUE A-bis — cierra los 4 huecos que dejó el Bloque A.
-- SOLO LECTURA. No cambia nada. Devuelve UNA fila, UNA columna.
select jsonb_pretty(jsonb_build_object(

  'B1_expresiones_policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tabla',   p.polrelid::regclass::text,
      'policy',  p.polname,
      'comando', case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                               when 'w' then 'UPDATE' when 'd' then 'DELETE'
                               else 'ALL' end,
      'permisiva', p.polpermissive,
      'roles',   coalesce((select string_agg(r.rolname, ',' order by r.rolname)
                           from pg_roles r where r.oid = any(p.polroles)), 'PUBLIC'),
      'using',      pg_get_expr(p.polqual,       p.polrelid),
      'with_check', pg_get_expr(p.polwithcheck,  p.polrelid)
    ) order by p.polrelid::regclass::text, p.polname), '[]'::jsonb)
    from pg_policy p
    where p.polrelid in (to_regclass('public.profiles'), to_regclass('public.organizations'),
                         to_regclass('public.user_organizations'), to_regclass('public.reports'))
  ),

  'B2_columnas', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tabla', c.relname, 'columna', a.attname,
      'tipo', format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid)
    ) order by c.relname, a.attnum), '[]'::jsonb)
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid in (to_regclass('public.organizations'),
                         to_regclass('public.user_organizations'),
                         to_regclass('public.reports'))
      and a.attnum > 0 and not a.attisdropped
  ),

  'B3_conteos', jsonb_build_object(
    'auth_users',         (select count(*) from auth.users),
    'profiles',           (select count(*) from public.profiles),
    'organizations',      (select count(*) from public.organizations),
    'user_organizations', (select count(*) from public.user_organizations),
    'reports',            (select count(*) from public.reports)
  ),

  'B4_funciones_public', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'funcion', p.proname,
      'seguridad', case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end,
      'definicion', pg_get_functiondef(p.oid)
    ) order by p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user','touch_updated_at','is_org_member','is_admin')
  ),

  'B5_constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tabla', con.conrelid::regclass::text,
      'nombre', con.conname,
      'tipo', con.contype::text,
      'definicion', pg_get_constraintdef(con.oid)
    ) order by con.conrelid::regclass::text, con.conname), '[]'::jsonb)
    from pg_constraint con
    where con.conrelid in (to_regclass('public.profiles'), to_regclass('public.organizations'),
                           to_regclass('public.user_organizations'), to_regclass('public.reports'))
  )
)) as resultado_completo;
