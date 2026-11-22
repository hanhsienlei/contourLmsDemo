-- Postgres grants EXECUTE on new functions to PUBLIC by default. A revoke
-- scoped "in schema public" cannot remove that global default, so revoke it
-- globally for functions created by postgres (what migrations run as).
alter default privileges for role postgres
  revoke execute on functions from public;

-- Keep the explicit per-role revokes too, so the intent is readable.
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
