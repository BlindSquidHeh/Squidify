import type { WidgetRecord } from "./api";
import { encodeDemoConfig } from "./demoLink";
import { config } from "./env";
import { demoWidgetUrl, widgetUrl } from "./urls";

/** Ссылка на виджет для OBS и окна Windows. В демо-режиме конфигурация вшивается в ссылку. */
export function widgetLink(widget: WidgetRecord): string {
  return config.demo ? demoWidgetUrl(encodeDemoConfig(widget.config)) : widgetUrl(widget.publicToken);
}
