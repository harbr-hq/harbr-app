import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => window.innerWidth < MOBILE_BREAKPOINT
  )

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", check)
    // Tauri on Linux can report stale dimensions during initial window placement
    // by the window manager. Re-check after first paint and on every resize as a
    // fallback — matchMedia change events are unreliable for WM-driven resizes in WebKit.
    window.addEventListener("resize", check)
    const raf = requestAnimationFrame(check)

    return () => {
      mql.removeEventListener("change", check)
      window.removeEventListener("resize", check)
      cancelAnimationFrame(raf)
    }
  }, [])

  return isMobile
}
