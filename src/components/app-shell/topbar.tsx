import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Menu, Bell, LogOut, User as UserIcon, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";
import { MessagesButton } from "./messages";
import { InviteButton } from "./invite";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <button onClick={onMenu} className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative flex max-w-xl flex-1 items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          id="global-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar clientes, projetos, tarefas…"
          className="w-full rounded-lg border border-border/60 bg-surface/60 py-2 pl-9 pr-12 text-sm placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <kbd className="absolute right-3 hidden rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">⌘K</kbd>
      </div>

      <button onClick={toggle} className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Alternar tema">
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <InviteButton />

      <MessagesButton />

      <Link to="/notifications" className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
        <Bell className="h-5 w-5" />
        {!!unread && unread > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[9px]">{unread}</Badge>
        )}
      </Link>

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
          <DropdownMenuItem onSelect={signOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
