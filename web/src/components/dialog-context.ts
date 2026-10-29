import { createContext, useContext } from "react";

export interface BaseOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Красная кнопка подтверждения для необратимых действий. */
  danger?: boolean;
}

export interface PromptOptions extends BaseOptions {
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}

export interface DialogApi {
  confirm: (options: BaseOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  alert: (options: Omit<BaseOptions, "cancelLabel" | "danger">) => Promise<void>;
}

export type Request =
  | { kind: "confirm"; options: BaseOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void }
  | { kind: "alert"; options: BaseOptions; resolve: () => void };

export const DialogContext = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialogs должен вызываться внутри DialogProvider");
  return api;
}

