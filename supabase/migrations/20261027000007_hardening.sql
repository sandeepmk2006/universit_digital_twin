-- Resolve Supabase security advisor warnings.

alter function private.touch_updated_at() set search_path = '';

alter extension citext set schema extensions;
alter extension btree_gist set schema extensions;
