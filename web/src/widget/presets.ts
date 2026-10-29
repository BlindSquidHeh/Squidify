import { DEFAULT_CONFIG, mergeConfig, type WidgetConfig } from "./config";

export interface BuiltInPreset {
  id: string;
  name: string;
  description: string;
  config: WidgetConfig;
}

function preset(id: string, name: string, description: string, patch: unknown): BuiltInPreset {
  return { id, name, description, config: mergeConfig(DEFAULT_CONFIG, patch) };
}

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  preset("classic", "Классика", "Тёмная карточка с обложкой слева", {}),
  preset("glass", "Стекло", "Полупрозрачный фон с размытием", {
    background: { type: "solid", color: "#ffffff", opacity: 12, blur: 16 },
    border: { radius: 20, width: 1, color: "#ffffff33" },
    shadow: { enabled: true, blur: 30, offsetY: 10, opacity: 30 },
    colors: { title: "#ffffff", artist: "#e6e6e6", time: "#e6e6e6" },
    progress: { trackColor: "#ffffff40", fillColor: "#ffffff", knob: true },
    text: { font: "manrope" },
  }),
  preset("neon", "Неон", "Градиент и светящаяся полоса прогресса", {
    background: { type: "gradient", color: "#2b0a3d", color2: "#0a1a3d", angle: 120, opacity: 95 },
    border: { radius: 18, width: 2, color: "#ff3cac" },
    shadow: { enabled: true, color: "#ff3cac", blur: 28, offsetY: 0, opacity: 45 },
    colors: { title: "#ffffff", artist: "#ffb3e6", time: "#ffb3e6" },
    progress: { style: "glow", gradient: true, fillColor: "#ff3cac", fillColor2: "#2b86c5", trackColor: "#ffffff22", height: 5 },
    text: { font: "unbounded", titleSize: 16, titleWeight: 600 },
    animation: { trackChange: "slide-left" },
  }),
  preset("minimal", "Минимализм", "Только текст без фона", {
    layout: "text",
    elements: { cover: false, progress: false, elapsed: false, remaining: false },
    background: { type: "none" },
    shadow: { enabled: false },
    text: { shadow: true, titleSize: 22, artistSize: 16, font: "montserrat" },
    attribution: { position: "inline" },
    size: { width: 460, padding: 8 },
  }),
  preset("compact", "Компактный", "Узкая строка для угла экрана", {
    layout: "compact",
    elements: { album: false, elapsed: false, remaining: false },
    size: { width: 320, padding: 8, gap: 10 },
    cover: { size: 40 },
    text: { titleSize: 14, artistSize: 12 },
    border: { radius: 12 },
    progress: { height: 3 },
    attribution: { position: "inline" },
  }),
  preset("poster", "Постер", "Крупная обложка и подпись снизу", {
    layout: "large-cover",
    elements: { album: true },
    size: { width: 300, padding: 16, gap: 14 },
    cover: { size: 268, radius: 8 },
    align: { horizontal: "center" },
    text: { titleSize: 20, artistSize: 15, font: "rubik" },
    border: { radius: 22 },
  }),
  preset("vertical", "Вертикальный", "Обложка сверху, текст по центру", {
    layout: "vertical",
    size: { width: 240, padding: 16 },
    cover: { size: 120, radius: 8 },
    align: { horizontal: "center" },
    text: { titleSize: 16, artistSize: 13 },
  }),
  preset("progress-line", "Полоса", "Тонкая полоса прогресса с названием", {
    layout: "progress",
    elements: { cover: false, album: false },
    size: { width: 600, padding: 10 },
    background: { type: "solid", color: "#000000", opacity: 55 },
    border: { radius: 10 },
    progress: { style: "line", height: 2, fillColor: "#ffffff", trackColor: "#ffffff30", timeFormat: "elapsed-remaining" },
    text: { titleSize: 14, artistSize: 13, font: "jetbrains" },
    attribution: { position: "inline" },
  }),
  preset("retro", "Ретро", "Пиксельный шрифт и сегментированный прогресс", {
    background: { type: "solid", color: "#1b1b2f", opacity: 100 },
    border: { radius: 0, width: 3, color: "#f9ed69" },
    shadow: { enabled: true, color: "#000000", blur: 0, offsetY: 6, opacity: 80 },
    colors: { title: "#f9ed69", artist: "#f08a5d", time: "#f08a5d" },
    progress: { style: "segmented", height: 8, radius: 0, fillColor: "#f9ed69", trackColor: "#3a3a5a" },
    text: { font: "pixel", titleSize: 12, artistSize: 10, timeSize: 9, titleWeight: 400 },
    cover: { radius: 0 },
    animation: { trackChange: "scale" },
  }),
  preset("light", "Светлый", "Белая карточка для светлых сцен", {
    background: { type: "solid", color: "#ffffff", opacity: 96 },
    colors: { title: "#121212", artist: "#535353", album: "#6a6a6a", time: "#535353" },
    progress: { trackColor: "#e0e0e0", fillColor: "#1db954" },
    shadow: { enabled: true, color: "#000000", blur: 20, offsetY: 6, opacity: 18 },
    link: { color: "#ffffff", background: "#121212" },
  }),
  preset("equalizer", "Эквалайзер", "Прыгающие столбики вместо полосы прогресса", {
    size: { width: 440 },
    background: { type: "solid", color: "#0b0b0f", opacity: 92 },
    visualizer: { enabled: true, style: "bars", bars: 36, height: 38, gap: 3, gradient: true, color: "#1db954", color2: "#b8ff3c" },
    label: { enabled: true, text: "СЕЙЧАС ИГРАЕТ", color: "#1db954" },
    text: { font: "russo" },
  }),
  preset("waveform", "Волна трека", "Форма звука, как в SoundCloud, с прогрессом", {
    size: { width: 460 },
    background: { type: "solid", color: "#111111", opacity: 90 },
    visualizer: { enabled: true, style: "soundcloud", bars: 64, height: 44, gap: 2, radius: 2, color: "#ff5500", dimColor: "#555555", amplitude: 100 },
    progress: { timeFormat: "elapsed-total" },
    text: { font: "montserrat" },
  }),
  preset("cyberpunk", "Киберпанк", "Неоновый текст, бегущая рамка и мигающий эквалайзер", {
    background: { type: "gradient", color: "#0d0221", color2: "#261447", angle: 120, opacity: 96, animated: true, animationSeconds: 8 },
    border: { radius: 6, width: 2, color: "#00f0ff", effect: "rainbow", effectColor: "#ff2a6d" },
    text: { font: "orbitron", titleSize: 17, effect: "neon", effectColor: "#00f0ff", secondaryFont: "audiowide" },
    colors: { title: "#ffffff", artist: "#ff7ac8", time: "#9be8ff" },
    visualizer: { enabled: true, style: "blocks", bars: 28, height: 34, gap: 3, radius: 0, gradient: true, color: "#00f0ff", color2: "#ff2a6d" },
    cover: { radius: 0 },
    animation: { trackChange: "flip" },
    label: { enabled: true, text: "NOW PLAYING", color: "#ff2a6d" },
  }),
  preset("sunset", "Закат", "Перетекающий градиент и радужный текст", {
    background: { type: "gradient", color: "#ff6a3d", color2: "#7b2ff7", angle: 135, opacity: 95, animated: true, animationSeconds: 10 },
    border: { radius: 24 },
    text: { font: "righteous", titleSize: 19, effect: "rainbow", effectSpeed: 30 },
    colors: { title: "#ffffff", artist: "#ffe9d6", time: "#ffe9d6" },
    visualizer: { enabled: true, style: "wave", bars: 40, height: 34, color: "#ffffff", opacity: 90 },
    animation: { trackChange: "bounce", idle: "float", idleAmount: 5 },
  }),
];
