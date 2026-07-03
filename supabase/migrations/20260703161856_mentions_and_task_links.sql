-- Multi-collaborator support via @mentions on tasks and calendar events,
-- link chips on tasks, and a completed/not-completed flag on events.

CREATE TABLE public.task_assignees (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_assignees all auth" ON public.task_assignees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_task_assignees_user ON public.task_assignees(user_id);

ALTER TABLE public.tasks ADD COLUMN links JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.events ADD COLUMN completed BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_event_participants_user ON public.event_participants(user_id);
