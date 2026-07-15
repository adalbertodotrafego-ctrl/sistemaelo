-- Add a logo / image URL to clients so each account can have its own brand mark.
alter table public.clients
  add column if not exists logo_url text;
