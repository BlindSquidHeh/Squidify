import { useEffect, useRef } from "react";
import type { WidgetConfig } from "./config";

interface Props {
  config: WidgetConfig["visualizer"];
  playing: boolean;
  /** Доля проигранного трека 0..1 (для стиля «волна трека»). */
  ratio: number;
  /** Определяет форму «волны трека»: у каждого трека она своя. */
  seed: string;
  className?: string;
}

/**
 * Spotify не отдаёт приложениям реальный звук и спектр трека (Audio Analysis
 * API закрыт), поэтому визуализатор — анимация, которая живёт, пока трек
 * играет, и затихает на паузе. Волна трека строится из id трека, то есть для
 * одного и того же трека всегда выглядит одинаково.
 */

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

interface Lane {
  p1: number;
  p2: number;
  p3: number;
  s1: number;
  s2: number;
  s3: number;
}

function makeLanes(count: number, seed: string): Lane[] {
  const rand = seededRandom(hash(`${seed}:lanes`));
  return Array.from({ length: count }, () => ({
    p1: rand() * Math.PI * 2,
    p2: rand() * Math.PI * 2,
    p3: rand() * Math.PI * 2,
    s1: 1.3 + rand() * 1.6,
    s2: 2.6 + rand() * 2.4,
    s3: 5 + rand() * 4,
  }));
}

/** Статичная «форма звука» трека: плавные холмы плюс шум, 0..1. */
function makeWaveform(count: number, seed: string): number[] {
  const rand = seededRandom(hash(`${seed}:wave`));
  const a = rand() * 6;
  const b = rand() * 6;
  return Array.from({ length: count }, (_, i) => {
    const x = i / Math.max(1, count - 1);
    const hills = 0.5 + 0.25 * Math.sin(x * 9 + a) + 0.15 * Math.sin(x * 23 + b);
    const noise = (rand() - 0.5) * 0.45;
    const edge = Math.min(1, x * 12, (1 - x) * 12) * 0.5 + 0.5;
    return Math.min(1, Math.max(0.08, (hills + noise) * edge));
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (radius === 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function Visualizer({ config, playing, ratio, seed, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Всё, что меняется часто, читается внутри цикла анимации из ref,
  // чтобы не перезапускать его при каждой перерисовке.
  const live = useRef({ config, playing, ratio, seed });
  useEffect(() => {
    live.current = { config, playing, ratio, seed };
  });

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = el.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    const g: CanvasRenderingContext2D = ctx;

    let width = 0;
    let height = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(el.clientWidth));
      height = Math.max(1, Math.round(el.clientHeight));
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(el);

    let lanes: Lane[] = [];
    let lanesKey = "";
    let wave: number[] = [];
    let waveKey = "";
    let level = 0; // плавное «затухание» на паузе
    let time = 0;
    let last = performance.now();
    let frame = 0;
    let running = true;

    const paint = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(paint);
      // 30 кадров в секунду достаточно для полос и вдвое дешевле для процессора.
      if (now - last < 30) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { config: v, playing: isPlaying, ratio: progress, seed: trackSeed } = live.current;

      const active = isPlaying || !v.freezeWhenPaused;
      level += ((active ? 1 : 0.06) - level) * Math.min(1, dt * 6);
      if (active) time += dt * (v.speed / 100);

      const count = v.style === "wave" ? Math.max(6, Math.round(v.bars / 2)) : v.bars;
      const key = `${count}:${trackSeed}`;
      if (key !== lanesKey) {
        lanesKey = key;
        lanes = makeLanes(count, trackSeed);
      }
      const wKey = `${v.bars}:${trackSeed}`;
      if (wKey !== waveKey) {
        waveKey = wKey;
        wave = makeWaveform(v.bars, trackSeed);
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);
      g.globalAlpha = v.opacity / 100;

      let fill: string | CanvasGradient = v.color;
      if (v.gradient) {
        const grad = g.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, v.color);
        grad.addColorStop(1, v.color2);
        fill = grad;
      }

      const amp = v.amplitude / 100;
      const value = (i: number) => {
        const lane = lanes[i];
        if (!lane) return 0;
        const wobble =
          0.5 * Math.sin(time * lane.s1 + lane.p1) +
          0.3 * Math.sin(time * lane.s2 + lane.p2) +
          0.2 * Math.sin(time * lane.s3 + lane.p3);
        const base = 0.5 + 0.5 * wobble;
        const tilt = 1 - 0.45 * Math.pow(i / Math.max(1, count - 1), 1.2);
        return Math.max(0.04, Math.min(1, base * tilt * amp * level + 0.04));
      };

      const barWidth = Math.max(1, (width - v.gap * (count - 1)) / count);

      if (v.style === "bars") {
        g.fillStyle = fill;
        for (let i = 0; i < count; i++) {
          const h = Math.max(2, value(i) * height);
          roundedRect(g, i * (barWidth + v.gap), height - h, barWidth, h, v.radius);
          g.fill();
        }
      } else if (v.style === "mirror") {
        g.fillStyle = fill;
        for (let i = 0; i < count; i++) {
          const h = Math.max(2, value(i) * height);
          roundedRect(g, i * (barWidth + v.gap), (height - h) / 2, barWidth, h, v.radius);
          g.fill();
        }
      } else if (v.style === "blocks") {
        g.fillStyle = fill;
        const block = Math.max(2, Math.min(barWidth, height / 6));
        const step = block + Math.max(1, v.gap / 2);
        const rows = Math.max(1, Math.floor(height / step));
        for (let i = 0; i < count; i++) {
          const lit = Math.max(1, Math.round(value(i) * rows));
          for (let r = 0; r < lit; r++) {
            roundedRect(g, i * (barWidth + v.gap), height - (r + 1) * step + (step - block), barWidth, block, v.radius);
            g.fill();
          }
        }
      } else if (v.style === "dots") {
        g.fillStyle = fill;
        const dot = Math.max(2, Math.min(barWidth, height / 5));
        const step = dot + Math.max(2, v.gap);
        const rows = Math.max(1, Math.floor(height / step));
        for (let i = 0; i < count; i++) {
          const lit = Math.max(1, Math.round(value(i) * rows));
          const cx = i * (barWidth + v.gap) + barWidth / 2;
          for (let r = 0; r < lit; r++) {
            g.beginPath();
            g.arc(cx, height - r * step - dot / 2, dot / 2, 0, Math.PI * 2);
            g.fill();
          }
        }
      } else if (v.style === "wave") {
        const points: [number, number][] = [];
        for (let i = 0; i < count; i++) {
          const x = (i / Math.max(1, count - 1)) * width;
          const lane = lanes[i];
          const swing = lane ? Math.sin(time * lane.s1 + lane.p1) * 0.6 + Math.sin(time * lane.s2 + lane.p2) * 0.4 : 0;
          points.push([x, height / 2 + swing * amp * level * (height / 2 - 2)]);
        }
        g.lineWidth = Math.max(2, Math.min(8, height / 10));
        g.lineJoin = "round";
        g.lineCap = "round";
        g.strokeStyle = fill;
        g.beginPath();
        g.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const mx = (points[i][0] + points[i + 1][0]) / 2;
          const my = (points[i][1] + points[i + 1][1]) / 2;
          g.quadraticCurveTo(points[i][0], points[i][1], mx, my);
        }
        const tail = points[points.length - 1];
        g.lineTo(tail[0], tail[1]);
        g.stroke();
      } else {
        // soundcloud: статичная форма трека, проигранная часть закрашена
        const playedBars = progress * count;
        for (let i = 0; i < count; i++) {
          const breathe = 1 + 0.06 * level * Math.sin(time * 3 + i * 0.7);
          const h = Math.max(2, (wave[i] ?? 0.1) * amp * breathe * height);
          const x = i * (barWidth + v.gap);
          const done = i + 0.5 <= playedBars;
          g.fillStyle = done ? fill : v.dimColor;
          roundedRect(g, x, (height - h) / 2, barWidth, h, v.radius);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    };
    frame = requestAnimationFrame(paint);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return <canvas ref={canvas} className={`sw-visualizer ${className ?? ""}`} aria-hidden="true" />;
}
