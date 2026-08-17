import { Link } from "@tanstack/react-router";
import { usePermissions } from "@/hooks/use-permissions";
import { PAGE_META } from "@/lib/nav-meta";

export function Footer() {
  const { can } = usePermissions();
  const links = PAGE_META.filter((p) => can(p.key));

  return (
    <footer className="border-t border-border/60 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="Elo Marketing" className="h-8 w-auto invert dark:invert-0" />
            <div>
              <div className="font-display text-sm font-bold tracking-tight">
                Elo Marketing<span className="text-primary"> OS</span>
              </div>
              <p className="max-w-md text-xs text-muted-foreground">
                Sistema interno da Elo Marketing — clientes, tarefas, campanhas e financeiro em um só lugar.
              </p>
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((p) => (
            <Link key={p.path} to={p.path} className="text-xs text-muted-foreground transition hover:text-foreground">
              {p.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col items-start gap-1 border-t border-border/60 pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Elo Marketing OS · Todos os direitos reservados</span>
          <span>
            Created by{" "}
            <a
              href="https://www.instagram.com/gabrielstobar"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground transition hover:text-primary"
            >
              Gabriel Tobar
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
