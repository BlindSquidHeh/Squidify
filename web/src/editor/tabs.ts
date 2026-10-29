export const TABS = [
  { id: "presets", label: "Пресеты" },
  { id: "layout", label: "Макет" },
  { id: "elements", label: "Элементы" },
  { id: "text", label: "Текст" },
  { id: "background", label: "Фон" },
  { id: "cover", label: "Обложка" },
  { id: "progress", label: "Прогресс" },
  { id: "animation", label: "Анимация" },
  { id: "behavior", label: "Поведение" },
  { id: "brand", label: "Spotify" },
] as const;
export type TabId = (typeof TABS)[number]["id"];
