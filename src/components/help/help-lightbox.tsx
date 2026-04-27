import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

interface LightboxContextValue {
  register: (img: LightboxImage) => void;
  open: (src: string) => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

export function useLightbox() {
  return useContext(LightboxContext);
}

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const imagesRef = useRef<LightboxImage[]>([]);
  const [active, setActive] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const register = useCallback((img: LightboxImage) => {
    if (img.src && !imagesRef.current.some((i) => i.src === img.src)) {
      imagesRef.current.push(img);
    }
  }, []);

  const open = useCallback((src: string) => {
    const index = imagesRef.current.findIndex((i) => i.src === src);
    if (index >= 0) setActive({ images: [...imagesRef.current], index });
  }, []);

  const close = useCallback(() => setActive(null), []);

  const nav = useCallback((dir: 1 | -1) => {
    setActive((prev) => {
      if (!prev) return null;
      const next = (prev.index + dir + prev.images.length) % prev.images.length;
      return { ...prev, index: next };
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") nav(-1);
      else if (e.key === "ArrowRight") nav(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, nav]);

  const current = active ? active.images[active.index] : null;

  return (
    <LightboxContext.Provider value={{ register, open }}>
      {children}
      {active && current && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={close}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={close}
          >
            <X className="h-5 w-5" />
          </button>

          {active.images.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); nav(-1); }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div
            className="flex flex-col items-center gap-3 max-w-[85vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.src}
              alt={current.alt}
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
            />
            <div className="flex items-center gap-4">
              {current.caption && (
                <p className="text-sm text-white/70 text-center">{current.caption}</p>
              )}
              {active.images.length > 1 && (
                <p className="text-xs text-white/40 shrink-0">
                  {active.index + 1} / {active.images.length}
                </p>
              )}
            </div>
          </div>

          {active.images.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); nav(1); }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>,
        document.body,
      )}
    </LightboxContext.Provider>
  );
}
