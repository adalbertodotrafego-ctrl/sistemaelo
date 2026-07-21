// Avatar de iniciais com cor determinística — usado em People, updates e cards.
// Cores fixas (texto branco sobre cor forte) funcionam nos dois temas.
const AVATAR_COLORS = ["#ff642e", "#00c875", "#579bfc", "#a25ddc", "#fdab3d", "#e2445c", "#66ccff", "#037f4c"];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function BoardAvatar({ name, id, size = 24 }: { name: string; id: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: colorFor(id) }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}
