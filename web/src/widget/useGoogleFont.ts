import { useEffect } from "react";
import { googleFontUrl, type WidgetConfig } from "./config";

const loadedFonts = new Set<string>();

export function useGoogleFont(font: WidgetConfig["text"]["font"]) {
  useEffect(() => {
    const url = googleFontUrl(font);
    if (!url || loadedFonts.has(url)) return;
    loadedFonts.add(url);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }, [font]);
}
