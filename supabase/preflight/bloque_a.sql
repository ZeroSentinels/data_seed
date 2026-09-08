-- Mismo BLOQUE A, pero devuelve UNA fila, UNA columna, como texto JSON.
-- Pensado para copiar fácil desde un panel chico.

select jsonb_pretty(
  jsonb_build_object(
    'A1_tablas', (
      select jsonb_agg(jsonb_build_object(
        'tabla', r.tabla,
        'existe', r.oid is not null,
        'rls', coalesce(c.relrowsecurity, false),
        'rls_forzada', coalesce(c.relforcerowsecurity, false),
        'policies', (select count(*) from pg_policy p where p.polrelid = r.oid)
      ) order by r.tabla)
      from (
        select tabla, to_regclass('public.' || tabla) as oid
        from (values ('profiles'), ('organizations'), ('user_organizations'),
                     ('reports'), ('agents'), ('conversations'), ('files'),
                     ('connectors'), ('organization_settings'), ('audit_log')) as t(tabla)
      ) r
      left join pg_class c on c.oid = r.oid
    ),
    'A2_policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tabla', p.polrelid::regclass::text,
        'policy', p.polname,
        'comando', p.polcmd::text,
        'colisiona_v1', p.polname in (
          'profiles_select_self','profiles_update_safe_self',
          'organizations_select_members','user_organizations_select_self',
          'reports_select_members','agents_select_members',
          'conversations_select_members','files_select_members',
          'connectors_select_members','organization_settings_select_members'
        )
      )), '[]'::jsonb)
      from pg_policy p
      where p.polrelid in (
        select to_regclass('public.' || t.tabla)
        from (values ('profiles'), ('organizations'), ('user_organizations'),
                     ('reports'), ('agents'), ('conversations'), ('files'),
                     ('connectors'), ('organization_settings'), ('audit_log')) as t(tabla)
      )
    ),
    'A3_columnas_profiles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'columna', a.attname,
        'tipo', format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull,
        'default', pg_get_expr(d.adbin, d.adrelid)
      )), '[]'::jsonb)
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = to_regclass('public.profiles')
        and a.attnum > 0 and not a.attisdropped
    ),
    'A4_trigger_auth_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'trigger', t.tgname,
        'estado', case t.tgenabled when 'D' then 'deshabilitado' else 'activo' end,
        'definicion', pg_get_triggerdef(t.oid)
      )), '[]'::jsonb)
      from pg_trigger t
      where t.tgrelid = to_regclass('auth.users')
        and not t.tgisinternal
    ),
    'A5_grants', (
      select coalesce(jsonb_agg(x), '[]'::jsonb)
      from (
        select g.table_name as tabla, g.grantee as rol,
               string_agg(g.privilege_type, ',' order by g.privilege_type) as privilegios
        from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.grantee in ('anon', 'authenticated')
          and g.table_name in ('profiles','organizations','user_organizations','reports',
                                'agents','conversations','files','connectors',
                                'organization_settings','audit_log')
        group by g.table_name, g.grantee
      ) x
    )
  )
) as resultado_completo;
