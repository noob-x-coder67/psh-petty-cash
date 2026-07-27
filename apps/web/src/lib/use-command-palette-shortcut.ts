"use client";

import { useEffect } from "react";

export function useCommandPaletteShortcut(onTrigger: () => void): void {
  useEffect(() => {
    function handler(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onTrigger();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onTrigger]);
}
