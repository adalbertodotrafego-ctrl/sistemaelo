import { useEffect, useRef } from "react";

/**
 * Luz suave que segue o cursor pela tela inteira — dá o toque "vivo" no login
 * e no sistema. Usa uma ref + requestAnimationFrame (sem re-render por pixel) e
 * respeita quem pediu menos animação (prefers-reduced-motion). No toque, some.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return; // celular/tablet: sem glow

    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.style.opacity = "1";
    };
    const onLeave = () => { el.style.opacity = "0"; };

    const tick = () => {
      // Interpolação: a luz "persegue" o mouse com um atraso gostoso.
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[1] h-[500px] w-[500px] rounded-full opacity-0 transition-opacity duration-500 mix-blend-screen"
      style={{
        background: "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0.07) 35%, transparent 70%)",
        filter: "blur(8px)",
      }}
    />
  );
}
