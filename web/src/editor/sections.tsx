import { useState } from "react";
import {
  FONTS,
  imageUrl,
  type Decoration,
  LAYOUT_LABELS,
  LAYOUTS,
  LINK_TEXTS,
  type WidgetConfig,
} from "../widget/config";
import { ColorInput, Segmented, Select, Slider, Toggle } from "./controls";
import type { TabId } from "./tabs";

type Section = Exclude<keyof WidgetConfig, "schemaVersion" | "layout" | "decorations">;

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

/** Поле для ссылки на картинку: невалидный ввод не сохраняется, пока не станет корректной ссылкой. */
function UrlInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const invalid = shown.trim() !== "" && imageUrl(shown) === "";
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        value={shown}
        maxLength={600}
        spellCheck={false}
        placeholder="https://…/картинка.gif"
        onChange={(e) => {
          setDraft(e.target.value);
          const clean = imageUrl(e.target.value);
          if (clean !== "" || e.target.value.trim() === "") onChange(clean);
        }}
        onBlur={() => setDraft(null)}
      />
      {invalid && <small className="muted">Нужна прямая ссылка, которая начинается с https://</small>}
    </label>
  );
}

function DecorationEditor({ d, onChange }: { d: Decoration; onChange: (d: Decoration) => void }) {
  const set = <K extends keyof Decoration>(key: K, value: Decoration[K]) => onChange({ ...d, [key]: value });
  return (
    <>
      <Toggle label="Показывать" checked={d.enabled} onChange={(v) => set("enabled", v)} />
      <UrlInput label="Ссылка на картинку или GIF" value={d.url} onChange={(v) => set("url", v)} />
      <Select
        label="Где показывать"
        value={d.placement}
        options={[
          { value: "before", label: "Перед текстом" },
          { value: "after", label: "После текста" },
          { value: "background", label: "На заднем плане" },
          { value: "free", label: "Свободно (в углу)" },
        ]}
        onChange={(v) => set("placement", v)}
      />
      {d.placement === "free" && (
        <>
          <Select
            label="Угол"
            value={d.anchor}
            options={[
              { value: "top-left", label: "Вверху слева" },
              { value: "top-right", label: "Вверху справа" },
              { value: "bottom-left", label: "Внизу слева" },
              { value: "bottom-right", label: "Внизу справа" },
              { value: "center", label: "По центру" },
            ]}
            onChange={(v) => set("anchor", v)}
          />
          <Slider label="Сдвиг по X" value={d.offsetX} min={-200} max={200} onChange={(v) => set("offsetX", v)} />
          <Slider label="Сдвиг по Y" value={d.offsetY} min={-200} max={200} onChange={(v) => set("offsetY", v)} />
        </>
      )}
      {d.placement !== "background" && (
        <>
          <Slider label="Ширина" value={d.width} min={8} max={600} onChange={(v) => set("width", v)} />
          <Toggle label="Высота по пропорциям" checked={d.height === 0} onChange={(auto) => set("height", auto ? 0 : d.width)} />
          {d.height > 0 && <Slider label="Высота" value={d.height} min={8} max={600} onChange={(v) => set("height", v)} />}
        </>
      )}
      <Segmented
        label="Вписывание"
        value={d.fit}
        options={[
          { value: "contain", label: "Целиком" },
          { value: "cover", label: "С обрезкой" },
          { value: "fill", label: "Растянуть" },
        ]}
        onChange={(v) => set("fit", v)}
      />
      <Slider label="Непрозрачность" value={d.opacity} min={0} max={100} unit="%" onChange={(v) => set("opacity", v)} />
      <Slider label="Скругление" value={d.radius} min={0} max={200} onChange={(v) => set("radius", v)} />
      <Segmented
        label="Когда видна"
        value={d.show}
        options={[
          { value: "always", label: "Всегда" },
          { value: "playing", label: "Играет" },
          { value: "paused", label: "Пауза / тишина" },
        ]}
        onChange={(v) => set("show", v)}
      />
      <Toggle label="Отразить по горизонтали" checked={d.flip} onChange={(v) => set("flip", v)} />
    </>
  );
}

export function EditorSections({ tab, config: c, onChange }: Props) {
  function set<S extends Section, K extends keyof WidgetConfig[S]>(section: S, key: K, value: WidgetConfig[S][K]) {
    onChange({ ...c, [section]: { ...c[section], [key]: value } });
  }
  const [decoSlot, setDecoSlot] = useState<0 | 1>(0);

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
          <Slider
            label="Масштаб всего виджета"
            value={c.size.scale}
            min={25}
            max={400}
            unit="%"
            onChange={(v) => set("size", "scale", v)}
            hint="Увеличивает или уменьшает виджет целиком: текст, обложку, отступы. Размер окна в OBS и в приложении подстроится сам."
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
            <>
              <ColorInput label="Цвет рамки" value={c.border.color} onChange={(v) => set("border", "color", v)} />
              <Select
                label="Линия рамки"
                value={c.border.style}
                options={[
                  { value: "solid", label: "Сплошная" },
                  { value: "dashed", label: "Пунктир" },
                  { value: "dotted", label: "Точки" },
                  { value: "double", label: "Двойная" },
                ]}
                onChange={(v) => set("border", "style", v)}
              />
              <Select
                label="Эффект рамки"
                value={c.border.effect}
                options={[
                  { value: "none", label: "Нет" },
                  { value: "pulse", label: "Пульсирующее свечение" },
                  { value: "rainbow", label: "Бегущая радуга" },
                ]}
                onChange={(v) => set("border", "effect", v)}
              />
              {c.border.effect !== "none" && (
                <ColorInput
                  label="Цвет эффекта"
                  value={c.border.effectColor}
                  onChange={(v) => set("border", "effectColor", v)}
                />
              )}
            </>
          )}
          {c.border.width === 0 && <p className="muted small" style={{ margin: 0 }}>Эффекты рамки работают, когда толщина рамки больше 0.</p>}
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
          <Toggle label="Своя подпись над названием" checked={c.label.enabled} onChange={(v) => set("label", "enabled", v)} />
          {c.label.enabled && (
            <>
              <label className="field">
                <span>Текст подписи</span>
                <input
                  className="input"
                  maxLength={40}
                  value={c.label.text}
                  onChange={(e) => set("label", "text", e.target.value)}
                />
              </label>
              <Slider label="Размер подписи" value={c.label.size} min={7} max={32} onChange={(v) => set("label", "size", v)} />
              <Slider
                label="Разрядка"
                value={c.label.letterSpacing}
                min={0}
                max={40}
                unit=""
                onChange={(v) => set("label", "letterSpacing", v)}
              />
              <ColorInput label="Цвет подписи" value={c.label.color} onChange={(v) => set("label", "color", v)} />
            </>
          )}
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
          <Select
            label="Шрифт исполнителей и времени"
            value={c.text.secondaryFont}
            options={[
              { value: "same" as const, label: "Как у названия" },
              ...FONTS.map((f) => ({ value: f.id, label: f.label })),
            ]}
            onChange={(v) => set("text", "secondaryFont", v)}
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
          <Slider
            label="Толщина исполнителей"
            value={c.text.artistWeight}
            min={300}
            max={900}
            step={100}
            unit=""
            onChange={(v) => set("text", "artistWeight", v)}
          />
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
            <Toggle label="Курсив у названия" checked={c.text.italic} onChange={(v) => set("text", "italic", v)} />
          </div>
          <Select
            label="Эффект текста"
            value={c.text.effect}
            options={[
              { value: "none", label: "Нет" },
              { value: "gradient", label: "Градиент" },
              { value: "rainbow", label: "Бегущая радуга" },
              { value: "neon", label: "Неон" },
              { value: "outline", label: "Контур" },
            ]}
            onChange={(v) => set("text", "effect", v)}
          />
          {c.text.effect !== "none" && c.text.effect !== "rainbow" && (
            <ColorInput label="Цвет эффекта" value={c.text.effectColor} onChange={(v) => set("text", "effectColor", v)} />
          )}
          {c.text.effect === "gradient" && (
            <ColorInput
              label="Второй цвет"
              value={c.text.effectColor2}
              onChange={(v) => set("text", "effectColor2", v)}
            />
          )}
          {c.text.effect === "rainbow" && (
            <Slider
              label="Скорость радуги"
              value={c.text.effectSpeed}
              min={1}
              max={100}
              unit=""
              onChange={(v) => set("text", "effectSpeed", v)}
            />
          )}
          {c.text.effect !== "none" && (
            <Toggle
              label="Эффект и на исполнителях"
              checked={c.text.effectAll}
              onChange={(v) => set("text", "effectAll", v)}
            />
          )}
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
              {c.background.type === "gradient" && (
                <Toggle
                  label="Перетекание градиента"
                  checked={c.background.animated}
                  onChange={(v) => set("background", "animated", v)}
                />
              )}
              {c.background.type === "gradient" && c.background.animated && (
                <Slider
                  label="Секунд на цикл"
                  value={c.background.animationSeconds}
                  min={2}
                  max={60}
                  unit=" с"
                  onChange={(v) => set("background", "animationSeconds", v)}
                />
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
          <Segmented
            label="Сторона"
            value={c.cover.side}
            options={[
              { value: "start", label: "Слева / сверху" },
              { value: "end", label: "Справа / снизу" },
            ]}
            onChange={(v) => set("cover", "side", v)}
          />
          <UrlInput
            label="Картинка, если обложки нет"
            value={c.cover.fallbackUrl}
            onChange={(v) => set("cover", "fallbackUrl", v)}
          />
          <p className="muted small" style={{ margin: 0 }}>
            Spotify не отдаёт обложки локальных файлов, поэтому для них показывается эта картинка (или значок ноты).
          </p>
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
              { value: "dots", label: "Точки" },
              { value: "stripes", label: "Бегущие полосы" },
              { value: "rainbow", label: "Радуга" },
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

    case "visualizer": {
      const v = c.visualizer;
      return (
        <>
          <Toggle label="Включить визуализатор" checked={v.enabled} onChange={(on) => set("visualizer", "enabled", on)} />
          <p className="muted small" style={{ margin: 0 }}>
            Spotify не отдаёт реальный звук трека, поэтому визуализатор — красивая анимация: она движется, пока трек
            играет, и затихает на паузе. «Волна трека» всегда одинакова для одного и того же трека, а проигранная
            часть закрашивается, как в SoundCloud.
          </p>
          {v.enabled && (
            <>
              <Select
                label="Стиль"
                value={v.style}
                options={[
                  { value: "bars", label: "Столбики" },
                  { value: "mirror", label: "Зеркальные столбики" },
                  { value: "wave", label: "Волна" },
                  { value: "dots", label: "Точки" },
                  { value: "blocks", label: "Эквалайзер (блоки)" },
                  { value: "soundcloud", label: "Волна трека + прогресс" },
                ]}
                onChange={(s) => set("visualizer", "style", s)}
              />
              <Select
                label="Где показывать"
                value={v.placement}
                options={[
                  { value: "replace-progress", label: "Вместо полосы прогресса" },
                  { value: "below", label: "Под прогрессом" },
                  { value: "background", label: "На заднем плане карточки" },
                ]}
                onChange={(p) => set("visualizer", "placement", p)}
              />
              {v.placement !== "background" && (
                <Slider label="Высота" value={v.height} min={8} max={200} onChange={(h) => set("visualizer", "height", h)} />
              )}
              <Slider label="Количество" value={v.bars} min={4} max={128} unit="" onChange={(n) => set("visualizer", "bars", n)} />
              <Slider label="Промежуток" value={v.gap} min={0} max={16} onChange={(n) => set("visualizer", "gap", n)} />
              <Slider label="Скругление" value={v.radius} min={0} max={16} onChange={(n) => set("visualizer", "radius", n)} />
              <Slider label="Размах" value={v.amplitude} min={10} max={100} unit="%" onChange={(n) => set("visualizer", "amplitude", n)} />
              <Slider label="Скорость" value={v.speed} min={10} max={300} unit="%" onChange={(n) => set("visualizer", "speed", n)} />
              <Slider label="Непрозрачность" value={v.opacity} min={5} max={100} unit="%" onChange={(n) => set("visualizer", "opacity", n)} />
              <ColorInput label="Цвет" value={v.color} onChange={(col) => set("visualizer", "color", col)} />
              <Toggle label="Градиент" checked={v.gradient} onChange={(g) => set("visualizer", "gradient", g)} />
              {v.gradient && (
                <ColorInput label="Второй цвет" value={v.color2} onChange={(col) => set("visualizer", "color2", col)} />
              )}
              {v.style === "soundcloud" && (
                <ColorInput label="Цвет непроигранной части" value={v.dimColor} onChange={(col) => set("visualizer", "dimColor", col)} />
              )}
              <Toggle
                label="Замирать на паузе"
                checked={v.freezeWhenPaused}
                onChange={(f) => set("visualizer", "freezeWhenPaused", f)}
              />
            </>
          )}
        </>
      );
    }

    case "decor":
      return (
        <>
          <p className="muted small" style={{ margin: 0 }}>
            Добавьте свою картинку или GIF (например, танцующего персонажа или рамку). Два слота, можно использовать
            оба. Нужна <b>прямая ссылка https</b> на файл: файл с компьютера (вида C:\Users\…) браузер и OBS по такой
            ссылке не откроют, его сначала нужно выложить в интернет (например, на imgur.com, GIPHY или в свой
            репозиторий GitHub) и вставить ссылку сюда. Картинки не перекрывают обложку: она всегда сверху.
          </p>
          <Segmented
            label="Слот"
            value={String(decoSlot) as "0" | "1"}
            options={[
              { value: "0", label: "Картинка 1" },
              { value: "1", label: "Картинка 2" },
            ]}
            onChange={(v) => setDecoSlot(v === "1" ? 1 : 0)}
          />
          <DecorationEditor
            key={decoSlot}
            d={c.decorations[decoSlot]}
            onChange={(d) => {
              const next: WidgetConfig["decorations"] = [c.decorations[0], c.decorations[1]];
              next[decoSlot] = d;
              onChange({ ...c, decorations: next });
            }}
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
              { value: "flip", label: "Переворот" },
              { value: "bounce", label: "Подпрыгивание" },
              { value: "drop", label: "Падение сверху" },
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
          <Select
            label="Постоянная анимация"
            value={c.animation.idle}
            options={[
              { value: "none", label: "Нет" },
              { value: "float", label: "Парение" },
              { value: "pulse", label: "Пульсация" },
              { value: "swing", label: "Покачивание" },
            ]}
            onChange={(v) => set("animation", "idle", v)}
          />
          {c.animation.idle !== "none" && (
            <Slider
              label="Сила"
              value={c.animation.idleAmount}
              min={1}
              max={30}
              unit=""
              onChange={(v) => set("animation", "idleAmount", v)}
            />
          )}
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
          <Slider
            label="Яркость на паузе"
            value={c.behavior.pausedOpacity}
            min={10}
            max={100}
            unit="%"
            onChange={(v) => set("behavior", "pausedOpacity", v)}
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
          <Slider
            label="Прозрачность значка"
            value={c.attribution.opacity}
            min={10}
            max={100}
            unit="%"
            onChange={(v) => set("attribution", "opacity", v)}
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
