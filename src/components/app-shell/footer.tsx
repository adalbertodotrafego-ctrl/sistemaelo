const YEAR = new Date().getFullYear();

export function AppFooter() {
  return (
    <footer className="border-t border-border/60 px-4 py-4 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
        <span>© {YEAR} Elo Marketing OS · Todos os direitos reservados</span>
        <span className="flex items-center gap-1">
          Criado por
          <span className="font-medium text-foreground">Gabriel Tobar</span>
        </span>
      </div>
    </footer>
  );
}
