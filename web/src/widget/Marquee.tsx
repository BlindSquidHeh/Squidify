import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

interface Props {
  text: string;
  enabled: boolean;
  /** Скорость прокрутки, пикселей в секунду. */
  speed: number;
  className?: string;
  style?: CSSProperties;
  href?: string | null;
}

const GAP = 48;

/**
 * Длинный текст прокручивается, чтобы его можно было прочитать целиком
 * (правила Spotify разрешают сокращать метаданные, только если полный
 * текст остаётся доступен). Без прокрутки показывается многоточие и подсказка.
 */
export function Marquee({ text, enabled, speed, className, style, href }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    // Ширину текста измеряем по отдельному невидимому элементу, который
    // всегда выглядит одинаково (не зависит от того, прокручивается ли
    // название сейчас). Раньше мерили сам прокручиваемый текст: после
    // включения прокрутки его размер читался иначе, режим переключался
    // туда-обратно, и название «дрожало» (особенно заметно в OBS).
    const measure = () => {
      if (!outer.current || !probe.current) return;
      const available = outer.current.clientWidth;
      const full = Math.ceil(probe.current.getBoundingClientRect().width);
      // available = 0 означает, что виджет ещё не раскладывается: ждём.
      if (available <= 0) return;
      setOverflow((prev) => {
        // Небольшой гистерезис: граница срабатывания зависит от текущего режима.
        const next = prev > 0 ? full > available - 1 : full > available + 1;
        const value = next ? full : 0;
        return value === prev ? prev : value;
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (outer.current) observer.observe(outer.current);
    // Шрифты Google могут догрузиться позже и изменить ширину текста.
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => observer.disconnect();
  }, [text, enabled]);

  const scrolling = enabled && overflow > 0;
  const distance = overflow + GAP;
  const duration = distance / Math.max(5, speed);

  const content = <span className="sw-marquee-text">{text}</span>;

  return (
    <div
      ref={outer}
      className={`sw-marquee ${scrolling ? "is-scrolling" : "is-static"} ${className ?? ""}`}
      style={style}
      title={text}
    >
      <span ref={probe} className="sw-marquee-probe" aria-hidden="true" data-text={text} />
      <div
        className="sw-marquee-track"
        style={
          scrolling
            ? ({
                "--sw-marquee-distance": `-${distance}px`,
                animationDuration: `${duration + 3}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        ) : (
          content
        )}
        {scrolling && (
          <span className="sw-marquee-text" aria-hidden="true" style={{ paddingLeft: GAP }}>
            {text}
          </span>
        )}
      </div>
    </div>
  );
}
