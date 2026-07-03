import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { getTaskFileUrl, type Attachment } from "@/lib/storage";

export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = attachment.type?.startsWith("image/");

  useEffect(() => {
    let alive = true;
    getTaskFileUrl(attachment.path)
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => {});
    return () => { alive = false; };
  }, [attachment.path]);

  if (isImage) {
    return (
      <div className="group/att relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-surface-2">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={attachment.name} className="h-full w-full object-cover" />
          </a>
        ) : (
          <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 opacity-0 transition group-hover/att:opacity-100">
            <X className="h-3 w-3 text-white" />
          </button>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary">
      <FileText className="h-3 w-3 shrink-0" />
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="max-w-[140px] truncate hover:underline">{attachment.name}</a>
      ) : (
        <span className="max-w-[140px] truncate">{attachment.name}</span>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 shrink-0 hover:text-destructive"><X className="h-3 w-3" /></button>
      )}
    </span>
  );
}
