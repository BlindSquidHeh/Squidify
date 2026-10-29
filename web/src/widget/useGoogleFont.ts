import { useEffect } from "react";
import { googleFontUrl, type WidgetConfig } from "./config";

const loadedFonts = new Set<string>();

export function useGoogleFont(...fonts: (WidgetConfig["text"]["font"] | WidgetConfig["text"]["secondaryFont"])[]) {
  const key = fonts.join("|");
  useEffect(() => {
    for (const font of key.split("|")) {
      const url = googleFontUrl(font as WidgetConfig["text"]["secondaryFont"]);
      if (!url || loadedFonts.has(url)) continue;
      loadedFonts.add(url);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
  }, [key]);
}
