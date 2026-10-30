import { useEffect } from "react";

declare global {
  interface Window {
    /** Задаётся оболочкой окна Windows: кадров в секунду для бесконечных анимаций. */
    __swFps?: number;
  }
}

/**
 * В окне Windows бесконечные CSS-анимации (парение, пульсация, радуга) рисуются на каждом кадре экрана,
 * а прозрачное окно при программной отрисовке перерисовывается целиком. Здесь такие анимации ставятся
 * на паузу и двигаются вручную с заданной частотой: выглядит так же, а нагрузка в несколько раз меньше.
 */
export function useAnimationThrottle(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof CSSAnimation === "undefined") return;
    const owned = new Map<Animation, number>(); // анимация → момент, от которого идёт её время
    let timer: number | undefined;
    let stopped = false;

    const release = () => {
      for (const animation of owned.keys()) {
        try {
          animation.play();
        } catch {
          // анимация уже снята
        }
      }
      owned.clear();
    };

    const loop = () => {
      if (stopped) return;
      const fps = window.__swFps;
      if (!fps || fps <= 0 || fps >= 60) {
        release();
        timer = window.setTimeout(loop, 500);
        return;
      }
      const now = performance.now();
      const alive = new Set<Animation>();
      for (const animation of document.getAnimations()) {
        if (!(animation instanceof CSSAnimation)) continue;
        if (animation.animationName === "sw-marquee") continue; // бегущая строка должна оставаться плавной
        if (animation.effect?.getComputedTiming().iterations !== Infinity) continue;
        alive.add(animation);
        let origin = owned.get(animation);
        if (origin === undefined) {
          origin = now - Number(animation.currentTime ?? 0);
          owned.set(animation, origin);
          animation.pause();
        }
        animation.currentTime = now - origin;
      }
      for (const animation of owned.keys()) if (!alive.has(animation)) owned.delete(animation);
      timer = window.setTimeout(loop, 1000 / fps);
    };

    loop();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      release();
    };
  }, [enabled]);
}
