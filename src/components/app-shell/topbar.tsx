import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, Menu, LogOut, User as UserIcon, Settings, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";
import { InviteButton } from "./invite";
import { NotificationsBell } from "./notifications-bell";
import { pageMetaFor } from "@/lib/nav-meta";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pageLabel = pageMetaFor(pathname)?.label;

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="fixed inset-x-4 top-4 z-30 flex h-16 items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 shadow-lg shadow-black/10 backdrop-blur-xl sm:inset-x-6 sm:px-4 lg:left-[336px] lg:right-6 lg:px-5">
      <button onClick={onMenu} className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
        {pageLabel}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="relative hidden items-center sm:flex">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            id="global-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-40 rounded-lg border border-border/60 bg-surface/60 py-2 pl-9 pr-10 text-sm placeholder:text-muted-foreground/70 focus:w-56 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 lg:w-56"
          />
          <kbd className="absolute right-2.5 hidden rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">⌘K</kbd>
        </div>

        <button onClick={toggle} className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Alternar tema">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <InviteButton />

        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="h-9 w-9 ring-2 ring-border/60 transition hover:ring-primary/50">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {initials(profile?.full_name ?? user?.email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <div className="truncate text-sm font-medium">{profile?.full_name ?? "Usuário"}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
              <UserIcon className="mr-2 h-4 w-4" /> Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
