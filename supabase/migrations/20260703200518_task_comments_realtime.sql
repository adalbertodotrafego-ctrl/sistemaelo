-- Live chat on tasks: task_comments already existed in the schema but had no UI.
-- This just turns on Realtime for it so new messages push to open chats instantly.
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
