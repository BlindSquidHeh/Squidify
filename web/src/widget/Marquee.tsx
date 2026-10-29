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
  const inner = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const diff = inner.current.scrollWidth - outer.current.clientWidth;
      setOverflow(diff > 1 ? inner.current.scrollWidth : 0);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    // Шрифты Google могут догрузиться позже и изменить ширину текста.
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => observer.disconnect();
  }, [text, enabled]);

  const scrolling = enabled && overflow > 0;
  const distance = overflow + GAP;
  const duration = distance / Math.max(5, speed);

  const content = (
    <span ref={inner} className="sw-marquee-text">
      {text}
    </span>
  );

  return (
    <div
      ref={outer}
      className={`sw-marquee ${scrolling ? "is-scrolling" : "is-static"} ${className ?? ""}`}
      style={style}
      title={text}
    >
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
