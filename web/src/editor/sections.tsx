import {
  FONTS,
  LAYOUT_LABELS,
  LAYOUTS,
  LINK_TEXTS,
  type WidgetConfig,
} from "../widget/config";
import { ColorInput, Segmented, Select, Slider, Toggle } from "./controls";
import type { TabId } from "./tabs";

type Section = Exclude<keyof WidgetConfig, "schemaVersion" | "layout">;

interface Props {
  tab: TabId;
  config: WidgetConfig;
  onChange: (config: WidgetConfig) => void;
}

const ALIGN_OPTIONS = [
  { value: "start", label: "Начало" },
  { value: "center", label: "Центр" },
  { value: "end", label: "Конец" },
] as const;

export function EditorSections({ tab, config: c, onChange }: Props) {
  function set<S extends Section, K extends keyof WidgetConfig[S]>(section: S, key: K, value: WidgetConfig[S][K]) {
    onChange({ ...c, [section]: { ...c[section], [key]: value } });
  }

  switch (tab) {
    case "layout":
      return (
        <>
          <Select
            label="Расположение"
            value={c.layout}
            options={LAYOUTS.map((l) => ({ value: l, label: LAYOUT_LABELS[l] }))}
            onChange={(v) => onChange({ ...c, layout: v })}
          />
          <Slider label="Ширина" value={c.size.width} min={120} max={1200} onChange={(v) => set("size", "width", v)} />
          <Toggle
            label="Высота по содержимому"
            checked={c.size.height === 0}
            onChange={(auto) => set("size", "height", auto ? 0 : 120)}
          />
          {c.size.height > 0 && (
            <Slider label="Высота" value={c.size.height} min={30} max={800} onChange={(v) => set("size", "height", v)} />
          )}
          <Slider label="Внутренний отступ" value={c.size.padding} min={0} max={60} onChange={(v) => set("size", "padding", v)} />
          <Slider label="Промежуток" value={c.size.gap} min={0} max={48} onChange={(v) => set("size", "gap", v)} />
          <Segmented
            label="По горизонтали"
            value={c.align.horizontal}
            options={[...ALIGN_OPTIONS]}
            onChange={(v) => set("align", "horizontal", v)}
          />
          <Segmented
            label="По вертикали"
            value={c.align.vertical}
            options={[...ALIGN_OPTIONS]}
            onChange={(v) => set("align", "vertical", v)}
          />
          <Slider label="Скругление" value={c.border.radius} min={0} max={60} onChange={(v) => set("border", "radius", v)} />
          <Slider label="Рамка" value={c.border.width} min={0} max={8} onChange={(v) => set("border", "width", v)} />
          {c.border.width > 0 && (
            <ColorInput label="Цвет рамки" value={c.border.color} onChange={(v) => set("border", "color", v)} />
          )}
        </>
      );

    case "elements":
      return (
        <>
          <p className="muted small" style={{ margin: 0 }}>
            Выберите, что показывать в виджете.
          </p>
          <div className="toggle-grid">
            <Toggle label="Обложка" checked={c.elements.cover} onChange={(v) => set("elements", "cover", v)} />
            <Toggle label="Название трека" checked={c.elements.title} onChange={(v) => set("elements", "title", v)} />
            <Toggle label="Исполнители" checked={c.elements.artists} onChange={(v) => set("elements", "artists", v)} />
            <Toggle label="Альбом" checked={c.elements.album} onChange={(v) => set("elements", "album", v)} />
            <Toggle label="Полоса прогресса" checked={c.elements.progress} onChange={(v) => set("elements", "progress", v)} />
            <Toggle label="Прошедшее время" checked={c.elements.elapsed} onChange={(v) => set("elements", "elapsed", v)} />
            <Toggle
              label="Длительность / остаток"
              checked={c.elements.remaining}
              onChange={(v) => set("elements", "remaining", v)}
            />
            <Toggle
              label="Кнопка Spotify"
              checked={c.elements.spotifyLink}
              onChange={(v) => set("elements", "spotifyLink", v)}
            />
          </div>
          {(c.layout === "text" || c.layout === "progress") && c.elements.cover && (
            <div className="alert info small">В макете «{LAYOUT_LABELS[c.layout]}» обложка не показывается.</div>
          )}
        </>
      );

    case "text":
      return (
        <>
          <Select
            label="Шрифт"
            value={c.text.font}
            options={FONTS.map((f) => ({ value: f.id, label: f.label }))}
            onChange={(v) => set("text", "font", v)}
          />
          <Slider label="Название" value={c.text.titleSize} min={8} max={64} onChange={(v) => set("text", "titleSize", v)} />
          <Slider
            label="Толщина названия"
            value={c.text.titleWeight}
            min={300}
            max={900}
            step={100}
            unit=""
            onChange={(v) => set("text", "titleWeight", v)}
          />
          <Slider label="Исполнители" value={c.text.artistSize} min={8} max={48} onChange={(v) => set("text", "artistSize", v)} />
          <Slider label="Альбом" value={c.text.albumSize} min={8} max={48} onChange={(v) => set("text", "albumSize", v)} />
          <Slider label="Время" value={c.text.timeSize} min={8} max={32} onChange={(v) => set("text", "timeSize", v)} />
          <Slider
            label="Межбуквенный"
            value={c.text.letterSpacing}
            min={-5}
            max={20}
            unit=""
            onChange={(v) => set("text", "letterSpacing", v)}
          />
          <ColorInput label="Цвет названия" value={c.colors.title} onChange={(v) => set("colors", "title", v)} />
          <ColorInput label="Цвет исполнителей" value={c.colors.artist} onChange={(v) => set("colors", "artist", v)} />
          <ColorInput label="Цвет альбома" value={c.colors.album} onChange={(v) => set("colors", "album", v)} />
          <ColorInput label="Цвет времени" value={c.colors.time} onChange={(v) => set("colors", "time", v)} />
          <div className="toggle-grid">
            <Toggle label="ЗАГЛАВНЫЕ" checked={c.text.uppercase} onChange={(v) => set("text", "uppercase", v)} />
            <Toggle label="Тень текста" checked={c.text.shadow} onChange={(v) => set("text", "shadow", v)} />
          </div>
        </>
      );

    case "background":
      return (
        <>
          <Segmented
            label="Фон"
            value={c.background.type}
            options={[
              { value: "solid", label: "Цвет" },
              { value: "gradient", label: "Градиент" },
              { value: "none", label: "Нет" },
            ]}
            onChange={(v) => set("background", "type", v)}
          />
          {c.background.type !== "none" && (
            <>
              <ColorInput label="Цвет" value={c.background.color} onChange={(v) => set("background", "color", v)} />
              {c.background.type === "gradient" && (
                <>
                  <ColorInput label="Второй цвет" value={c.background.color2} onChange={(v) => set("background", "color2", v)} />
                  <Slider label="Угол" value={c.background.angle} min={0} max={360} unit="°" onChange={(v) => set("background", "angle", v)} />
                </>
              )}
              <Slider
                label="Непрозрачность"
                value={c.background.opacity}
                min={0}
                max={100}
                unit="%"
                onChange={(v) => set("background", "opacity", v)}
              />
              <Slider
                label="Размытие под фоном"
                value={c.background.blur}
                min={0}
                max={40}
                onChange={(v) => set("background", "blur", v)}
                hint="Размывает то, что находится за виджетом (в OBS работает поверх других источников только в окне браузера)"
              />
            </>
          )}
          <Toggle label="Тень виджета" checked={c.shadow.enabled} onChange={(v) => set("shadow", "enabled", v)} />
          {c.shadow.enabled && (
            <>
              <ColorInput label="Цвет тени" value={c.shadow.color} onChange={(v) => set("shadow", "color", v)} />
              <Slider label="Размытие тени" value={c.shadow.blur} min={0} max={100} onChange={(v) => set("shadow", "blur", v)} />
              <Slider label="Смещение" value={c.shadow.offsetY} min={-40} max={40} onChange={(v) => set("shadow", "offsetY", v)} />
              <Slider
                label="Плотность"
                value={c.shadow.opacity}
                min={0}
                max={100}
                unit="%"
                onChange={(v) => set("shadow", "opacity", v)}
              />
            </>
          )}
        </>
      );

    case "cover":
      return (
        <>
          <Toggle label="Показывать обложку" checked={c.elements.cover} onChange={(v) => set("elements", "cover", v)} />
          <Slider label="Размер" value={c.cover.size} min={24} max={480} onChange={(v) => set("cover", "size", v)} />
          <Slider
            label="Скругление"
            value={c.cover.radius}
            min={0}
            max={8}
            onChange={(v) => set("cover", "radius", v)}
            hint="Spotify рекомендует 4px для небольших обложек и 8px для крупных"
          />
          <Toggle label="Тень обложки" checked={c.cover.shadow} onChange={(v) => set("cover", "shadow", v)} />
          <p className="muted small" style={{ margin: 0 }}>
            По правилам Spotify обложку нельзя обрезать, размывать, анимировать и закрывать другими элементами,
            поэтому эти эффекты недоступны. Скругление ограничено 8px.
          </p>
        </>
      );

    case "progress":
      return (
        <>
          <Toggle label="Показывать прогресс" checked={c.elements.progress} onChange={(v) => set("elements", "progress", v)} />
          <Select
            label="Стиль"
            value={c.progress.style}
            options={[
              { value: "bar", label: "Полоса" },
              { value: "line", label: "Тонкая линия" },
              { value: "glow", label: "Свечение" },
              { value: "segmented", label: "Сегменты" },
            ]}
            onChange={(v) => set("progress", "style", v)}
          />
          <Slider label="Толщина" value={c.progress.height} min={1} max={16} onChange={(v) => set("progress", "height", v)} />
          <Slider label="Скругление" value={c.progress.radius} min={0} max={12} onChange={(v) => set("progress", "radius", v)} />
          <ColorInput label="Фон полосы" value={c.progress.trackColor} onChange={(v) => set("progress", "trackColor", v)} />
          <ColorInput label="Заполнение" value={c.progress.fillColor} onChange={(v) => set("progress", "fillColor", v)} />
          <Toggle label="Градиент заполнения" checked={c.progress.gradient} onChange={(v) => set("progress", "gradient", v)} />
          {c.progress.gradient && (
            <ColorInput label="Второй цвет" value={c.progress.fillColor2} onChange={(v) => set("progress", "fillColor2", v)} />
          )}
          <Toggle label="Маркер позиции" checked={c.progress.knob} onChange={(v) => set("progress", "knob", v)} />
          <Segmented
            label="Справа"
            value={c.progress.timeFormat}
            options={[
              { value: "elapsed-total", label: "Длительность" },
              { value: "elapsed-remaining", label: "Осталось" },
            ]}
            onChange={(v) => set("progress", "timeFormat", v)}
          />
        </>
      );

    case "animation":
      return (
        <>
          <Select
            label="Смена трека"
            value={c.animation.trackChange}
            options={[
              { value: "none", label: "Без анимации" },
              { value: "fade", label: "Появление" },
              { value: "slide-up", label: "Снизу вверх" },
              { value: "slide-left", label: "Справа налево" },
              { value: "scale", label: "Увеличение" },
              { value: "blur", label: "Фокус" },
            ]}
            onChange={(v) => set("animation", "trackChange", v)}
          />
          <Slider
            label="Длительность"
            value={c.animation.durationMs}
            min={0}
            max={2000}
            step={50}
            unit="мс"
            onChange={(v) => set("animation", "durationMs", v)}
          />
          <Toggle
            label="Прокрутка длинных названий"
            checked={c.animation.marquee}
            onChange={(v) => set("animation", "marquee", v)}
          />
          {c.animation.marquee && (
            <Slider
              label="Скорость"
              value={c.animation.marqueeSpeed}
              min={5}
              max={150}
              unit=" px/с"
              onChange={(v) => set("animation", "marqueeSpeed", v)}
            />
          )}
          <p className="muted small" style={{ margin: 0 }}>
            Анимации применяются к тексту. Обложка меняется без эффектов — этого требуют правила Spotify.
          </p>
        </>
      );

    case "behavior":
      return (
        <>
          <Select
            label="Когда ничего не играет"
            value={c.behavior.whenIdle}
            options={[
              { value: "hide", label: "Скрыть виджет" },
              { value: "message", label: "Показать сообщение" },
              { value: "last", label: "Оставить последний трек" },
            ]}
            onChange={(v) => set("behavior", "whenIdle", v)}
          />
          {c.behavior.whenIdle === "message" && (
            <label className="field">
              <span>Текст сообщения</span>
              <input
                className="input"
                maxLength={80}
                value={c.behavior.idleMessage}
                onChange={(e) => set("behavior", "idleMessage", e.target.value)}
              />
            </label>
          )}
          <Toggle
            label="Скрывать на паузе"
            checked={c.behavior.hideWhenPaused}
            onChange={(v) => set("behavior", "hideWhenPaused", v)}
          />
          <Toggle
            label="Метка «Пауза»"
            checked={c.behavior.pausedBadge}
            onChange={(v) => set("behavior", "pausedBadge", v)}
          />
        </>
      );

    case "brand":
      return (
        <>
          <p className="muted small" style={{ margin: 0 }}>
            Правила Spotify требуют показывать значок Spotify рядом с данными о треке, поэтому выключить его нельзя.
            Минимальный размер значка — 21px, его нельзя размещать поверх обложки. Зелёный значок допускается только на
            чёрном или белом фоне, в режиме «Авто» цвет выбирается автоматически.
          </p>
          <Select
            label="Положение значка"
            value={c.attribution.position}
            options={[
              { value: "top-right", label: "Вверху справа" },
              { value: "top-left", label: "Вверху слева" },
              { value: "bottom-right", label: "Внизу справа" },
              { value: "bottom-left", label: "Внизу слева" },
              { value: "inline", label: "Рядом с названием" },
            ]}
            onChange={(v) => set("attribution", "position", v)}
          />
          <Segmented
            label="Цвет значка"
            value={c.attribution.variant}
            options={[
              { value: "auto", label: "Авто" },
              { value: "green", label: "Зелёный" },
              { value: "white", label: "Белый" },
              { value: "black", label: "Чёрный" },
            ]}
            onChange={(v) => set("attribution", "variant", v)}
          />
          <Slider label="Размер значка" value={c.attribution.size} min={21} max={48} onChange={(v) => set("attribution", "size", v)} />
          <Toggle
            label="Кнопка «Открыть в Spotify»"
            checked={c.elements.spotifyLink}
            onChange={(v) => set("elements", "spotifyLink", v)}
          />
          {c.elements.spotifyLink && (
            <>
              <Select
                label="Текст кнопки"
                value={c.link.text}
                options={LINK_TEXTS.map((t) => ({ value: t, label: t }))}
                onChange={(v) => set("link", "text", v)}
              />
              <ColorInput label="Цвет текста" value={c.link.color} onChange={(v) => set("link", "color", v)} />
              <ColorInput label="Цвет кнопки" value={c.link.background} onChange={(v) => set("link", "background", v)} />
            </>
          )}
          <p className="muted small" style={{ margin: 0 }}>
            Название трека, исполнитель и обложка в виджете — ссылки на Spotify. В окне Windows и в браузере по ним
            можно перейти, в OBS ссылки не кликабельны.
          </p>
        </>
      );

    default:
      return null;
  }
}
