-- Pastas essenciais de agência em Arquivos, criadas uma única vez, e
-- realocação de qualquer arquivo hoje solto na raiz para dentro de "Contratos".
-- Idempotente: só insere pastas que ainda não existem pelo nome na raiz.

INSERT INTO public.folders (name)
SELECT name FROM (VALUES
  ('Contratos'),
  ('Propostas & Orçamentos'),
  ('Financeiro'),
  ('Criativos & Design'),
  ('Marca da Elo'),
  ('Reuniões & Atas'),
  ('Jurídico')
) AS defaults(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.folders f WHERE f.name = defaults.name AND f.parent_id IS NULL
);

UPDATE public.files
SET folder_id = (SELECT id FROM public.folders WHERE name = 'Contratos' AND parent_id IS NULL LIMIT 1)
WHERE folder_id IS NULL;
