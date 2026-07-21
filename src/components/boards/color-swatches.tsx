import { cn } from "@/lib/utils";

/** Grade de bolinhas de cor — usada em grupos, status e quadros. */
export function ColorSwatches({ colors, value, onPick, size = 22 }: {
  colors: string[];
  value?: string | null;
  onPick: (color: string) => void;
  size?: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          title={c}
          style={{ backgroundColor: c, width: size, height: size }}
          className={cn(
            "rounded-full transition",
            value?.toLowerCase() === c.toLowerCase()
              ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
              : "opacity-80 hover:opacity-100",
          )}
        />
      ))}
    </div>
  );
}
