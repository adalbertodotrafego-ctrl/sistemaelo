import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Splash da Elo OS: aparece uma vez por carregamento do app e some com
 * elegância. Serve de "ponte" entre o login e o sistema. Fica só ~1,1s para
 * não atrapalhar quem já conhece o caminho.
 */
export function Splash() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1100);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              initial={{ scale: 0.6, opacity: 0.25 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative flex flex-col items-center gap-4"
          >
            <div className="font-display text-3xl font-bold tracking-tight">
              Elo Marketing<span className="text-primary"> OS</span>
            </div>
            <div className="h-0.5 w-40 overflow-hidden rounded-full bg-border">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.1, ease: "easeInOut" }}
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
              />
            </div>
            <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">carregando</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
