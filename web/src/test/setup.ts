import "@testing-library/jest-dom/vitest";

// jsdom не реализует canvas: визуализатор в тестах просто ничего не рисует.
HTMLCanvasElement.prototype.getContext = () => null;
