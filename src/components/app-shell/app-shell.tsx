import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full">
      {/* No desktop a barra fica recolhida (rail) e expande sozinha ao passar o
          mouse — como ela é fixa, a expansão sobrepõe sem empurrar o conteúdo. */}
      <Sidebar mobileOpen={open} onMobileClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[72px]">
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
      </div>
    </div>
  );
}
