import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Splash da Elo OS — aparece uma vez por carregamento do app e some com
 * elegância. Anéis giratórios + a marca "elomkt" pulsando + logotipo.
 */
export function Splash() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1300);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#07070a]"
        >
          {/* malha de luz de fundo */}
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              initial={{ opacity: 0.2, scale: 0.7 }}
              animate={{ opacity: [0.2, 0.45, 0.2], scale: 1.5 }}
              transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
              className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[120px]"
            />
          </div>

          <div className="relative flex flex-col items-center gap-6">
            {/* Monograma com anel giratório */}
            <div className="relative flex h-24 w-24 items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-transparent"
                style={{
                  borderTopColor: "var(--color-primary)",
                  borderRightColor: "color-mix(in oklch, var(--color-primary) 40%, transparent)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, ease: "linear", repeat: Infinity }}
              />
              <motion.span
                className="absolute inset-2 rounded-full border border-white/5"
                animate={{ rotate: -360 }}
                transition={{ duration: 3, ease: "linear", repeat: Infinity }}
              />
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.85, 1, 0.85], opacity: 1 }}
                transition={{ scale: { duration: 1.6, ease: "easeInOut", repeat: Infinity }, opacity: { duration: 0.6, ease: "easeOut" } }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-2.5 shadow-lg shadow-primary/30"
              >
                <img src="/logo-mark.png" alt="" className="h-full w-full object-contain" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="text-center"
            >
              <div className="font-display text-2xl font-bold tracking-tight text-white">
                Elo Marketing<span className="text-primary"> OS</span>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.4em] text-white/40">Agência de Marketing</div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
