-- Live CRM pipeline: turns on Realtime for crm_leads so any add/edit/move by anyone
-- on the team pushes to every open board instantly, with no page reload.
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;

-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the full old row (needed for
-- the client to react to stage moves and deletions, not just inserts).
ALTER TABLE public.crm_leads REPLICA IDENTITY FULL;
