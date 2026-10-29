import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DialogContext, type DialogApi, type Request } from "./dialog-context";

// Свои окна вместо системных window.confirm / prompt / alert: те выглядят чужеродно,
// не подстраиваются под тему сайта и не умеют ничего, кроме двух кнопок.

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const current = useRef<Request | null>(null);

  const open = useCallback((next: Request) => {
    // Если окно уже открыто, предыдущее закрывается как отменённое.
    const previous = current.current;
    if (previous?.kind === "confirm") previous.resolve(false);
    if (previous?.kind === "prompt") previous.resolve(null);
    if (previous?.kind === "alert") previous.resolve();
    current.current = next;
    setRequest(next);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => new Promise<boolean>((resolve) => open({ kind: "confirm", options, resolve })),
      prompt: (options) => new Promise<string | null>((resolve) => open({ kind: "prompt", options, resolve })),
      alert: (options) => new Promise<void>((resolve) => open({ kind: "alert", options, resolve })),
    }),
    [open],
  );

  const close = () => {
    current.current = null;
    setRequest(null);
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request && <DialogView request={request} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogView({ request, onClose }: { request: Request; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(request.kind === "prompt" ? (request.options.defaultValue ?? "") : "");
  const { options } = request;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const finish = (confirmed: boolean) => {
    if (request.kind === "confirm") request.resolve(confirmed);
    else if (request.kind === "prompt") request.resolve(confirmed ? value.trim() || null : null);
    else request.resolve();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      onClick={(e) => {
        // Клик по затемнению (по самому <dialog>, а не по его содержимому) отменяет окно.
        if (e.target === ref.current) finish(false);
      }}
    >
      <form
        method="dialog"
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          finish(true);
        }}
      >
        <h2 id="dialog-title">{options.title}</h2>
        {options.message && <p className="muted">{options.message}</p>}
        {request.kind === "prompt" && (
          <label className="field">
            {request.options.label && <span>{request.options.label}</span>}
            <input
              className="input"
              autoFocus
              value={value}
              maxLength={request.options.maxLength ?? 60}
              placeholder={request.options.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
        )}
        <div className="dialog-actions">
          {request.kind !== "alert" && (
            <button type="button" className="btn" onClick={() => finish(false)}>
              {options.cancelLabel ?? "Отмена"}
            </button>
          )}
          <button
            type="submit"
            className={`btn ${options.danger ? "danger" : "primary"}`}
            autoFocus={request.kind !== "prompt"}
            disabled={request.kind === "prompt" && value.trim() === ""}
          >
            {options.confirmLabel ?? (request.kind === "alert" ? "Понятно" : "Да")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
