import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { X } from "lucide-react";

type Profile = { id: string; full_name: string | null; email: string | null; avatar_url?: string | null };

const MENTION_RE = /(?:^|\s)@([^\s@]*)$/;

// Textarea with @name autocomplete. Typing "@" opens a picker of team members;
// picking one inserts "@Full Name " and adds their id to mentionedIds. Mentioned
// people also show as removable chips below, since editing the text alone can't
// reliably signal an intentional "un-mention".
export function MentionTextarea({
  value, onChange, mentionedIds, onMentionedIdsChange, profiles, rows = 3, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  mentionedIds: string[];
  onMentionedIdsChange: (ids: string[]) => void;
  profiles: Profile[];
  rows?: number;
  placeholder?: string;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const updateFromCaret = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const match = before.match(MENTION_RE);
    setQuery(match ? match[1] : null);
  };

  const matches =
    query === null
      ? []
      : profiles
          .filter((p) => {
            const q = query.toLowerCase();
            return (p.full_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
          })
          .slice(0, 6);

  const pick = (p: Profile) => {
    const el = taRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(MENTION_RE, (m) => {
      const lead = m.startsWith(" ") ? " " : "";
      return `${lead}@${p.full_name ?? p.email ?? "usuário"} `;
    });
    onChange(replaced + after);
    setQuery(null);
    if (!mentionedIds.includes(p.id)) onMentionedIdsChange([...mentionedIds, p.id]);
    requestAnimationFrame(() => el?.focus());
  };

  const mentionedProfiles = mentionedIds.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[];

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        rows={rows}
        value={value}
        placeholder={placeholder ?? "Escreva… use @ para mencionar alguém do time"}
        onChange={(e) => { onChange(e.target.value); updateFromCaret(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onKeyUp={(e) => { const el = e.currentTarget; updateFromCaret(el.value, el.selectionStart ?? el.value.length); }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {query !== null && matches.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-w-xs overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-[9px] text-primary">{initials(p.full_name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{p.full_name ?? p.email}</span>
            </button>
          ))}
        </div>
      )}
      {mentionedProfiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mentionedProfiles.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-1 pr-2 text-xs text-primary">
              <Avatar className="h-4 w-4">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-[8px]">{initials(p.full_name)}</AvatarFallback>
              </Avatar>
              {p.full_name ?? p.email}
              <button type="button" onClick={() => onMentionedIdsChange(mentionedIds.filter((m) => m !== p.id))} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
