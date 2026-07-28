import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AppFooter } from "./footer";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "1";
  });
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("sidebar-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        mobileOpen={open}
        onMobileClose={() => setOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className={"flex min-w-0 flex-1 flex-col transition-[padding] duration-300 " + (collapsed ? "lg:pl-[68px]" : "lg:pl-64")}>
        <Topbar onMenu={() => setOpen(true)} />
        <main className="flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="mx-auto max-w-[1400px]"
          >
            {children}
          </motion.div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
