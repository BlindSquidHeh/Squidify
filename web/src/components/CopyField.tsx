import { useState } from "react";

export function CopyField({ value, label, secret }: { value: string; label?: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <label className="field">
      {label && <span>{label}</span>}
      <div className="copy-field">
        <input
          className="input"
          readOnly
          value={revealed ? value : "•".repeat(Math.min(value.length, 48))}
          onFocus={(e) => revealed && e.target.select()}
        />
        {secret && (
          <button type="button" className="btn small" onClick={() => setRevealed((v) => !v)}>
            {revealed ? "Скрыть" : "Показать"}
          </button>
        )}
        <button type="button" className="btn small primary" onClick={copy}>
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
    </label>
  );
}
