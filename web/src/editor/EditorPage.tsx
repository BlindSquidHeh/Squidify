import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogs } from "../components/dialog-context";
import { Link, useSearchParams } from "react-router-dom";
import { CopyField } from "../components/CopyField";
import {
  createPreset,
  deletePreset,
  getWidget,
  listPresets,
  updateWidget,
  type PresetRecord,
  type WidgetRecord,
} from "../lib/api";
import { config as appConfig } from "../lib/env";
import { useSpotifyConnection } from "../lib/useSpotifyConnection";
import { widgetLink } from "../lib/widgetLink";
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  suggestedSourceSize,
  type WidgetConfig,
} from "../widget/config";
import { BUILT_IN_PRESETS } from "../widget/presets";
import { useDemoFeed } from "../widget/useDemoFeed";
import { useWidgetFeed } from "../widget/useWidgetFeed";
import { WidgetView } from "../widget/WidgetView";
import { EditorSections } from "./sections";
import { TABS, type TabId } from "./tabs";

type SaveState = "saved" | "pending" | "saving" | "error";

const SAVE_DELAY_MS = 800;

export default function EditorPage() {
  const dialogs = useDialogs();
  const [params] = useSearchParams();
  const id = params.get("id");
  const [widget, setWidget] = useState<WidgetRecord | null>(null);
  const [cfg, setCfg] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("presets");
  const [presets, setPresets] = useState<PresetRecord[]>([]);
  const [sourceChoice, setSource] = useState<"demo" | "live" | null>(null);
  const [stage, setStage] = useState<"checker" | "dark" | "light" | "game">("game");
  const [zoom, setZoom] = useState(100);
  const dirty = useRef<{ config?: WidgetConfig; name?: string }>({});
  const timer = useRef<number | undefined>(undefined);

  const { connection } = useSpotifyConnection();
  const canLive = !appConfig.demo && connection?.status === "connected" && widget !== null;
  // Пока пользователь не выбрал источник сам, при подключённом Spotify показываем живой трек.
  const source = sourceChoice ?? (canLive ? "live" : "demo");
  const live = useWidgetFeed(widget?.publicToken ?? null, canLive && source === "live");
  const demo = useDemoFeed(source === "demo" || !canLive);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getWidget(id)
      .then((w) => {
        if (!active) return;
        if (!w) {
          setLoadError("Виджет не найден");
          return;
        }
        setWidget(w);
        setCfg(w.config);
        setName(w.name);
      })
      .catch((e) => active && setLoadError((e as Error).message));
    listPresets()
      .then((p) => active && setPresets(p))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id]);

  const flush = useCallback(async () => {
    if (!widget) return;
    const patch = dirty.current;
    if (!patch.config && patch.name === undefined) return;
    dirty.current = {};
    setSaveState("saving");
    try {
      const saved = await updateWidget(widget.id, patch);
      setWidget((prev) => (prev ? { ...prev, updatedAt: saved.updatedAt, name: saved.name } : prev));
      setSaveError(null);
      setSaveState(dirty.current.config || dirty.current.name !== undefined ? "pending" : "saved");
    } catch (e) {
      dirty.current = { ...patch, ...dirty.current };
      setSaveError((e as Error).message);
      setSaveState("error");
    }
  }, [widget]);

  const scheduleSave = useCallback(
    (patch: { config?: WidgetConfig; name?: string }) => {
      dirty.current = { ...dirty.current, ...patch };
      setSaveState("pending");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Предупреждение при закрытии вкладки с несохранёнными изменениями.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === "pending" || saveState === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  // Сохраняем изменения при уходе со страницы редактора.
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  const applyConfig = useCallback(
    (next: WidgetConfig) => {
      const normalized = normalizeConfig(next);
      setCfg(normalized);
      scheduleSave({ config: normalized });
    },
    [scheduleSave],
  );

  if (!id) {
    return (
      <div className="empty">
        Не выбран виджет. <Link to="/app">К списку виджетов</Link>
      </div>
    );
  }
  if (loadError) return <div className="alert error">{loadError}</div>;
  if (!widget) return <div className="muted">Загрузка…</div>;

  const playback = source === "live" && canLive ? live.playback : demo.playback;
  const receivedAt = source === "live" && canLive ? live.receivedAt : demo.receivedAt;
  const link = widgetLink({ ...widget, config: cfg });
  const size = suggestedSourceSize(cfg);

  const savePreset = async () => {
    const presetName = await dialogs.prompt({
      title: "Сохранить как пресет",
      label: "Название пресета",
      defaultValue: name,
      confirmLabel: "Сохранить",
    });
    if (!presetName) return;
    try {
      const preset = await createPreset(presetName, cfg);
      setPresets((prev) => [preset, ...prev]);
    } catch (e) {
      await dialogs.alert({ title: "Не удалось сохранить пресет", message: (e as Error).message });
    }
  };

  const removePreset = async (preset: PresetRecord) => {
    const ok = await dialogs.confirm({
      title: `Удалить пресет «${preset.name}»?`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePreset(preset.id);
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
    } catch (e) {
      await dialogs.alert({ title: "Не удалось удалить пресет", message: (e as Error).message });
    }
  };

  const saveLabel: Record<SaveState, string> = {
    saved: "✓ Сохранено, ссылка обновится автоматически",
    pending: "Есть изменения…",
    saving: "Сохраняем…",
    error: `Ошибка сохранения: ${saveError ?? ""}`,
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread">
        <div className="row" style={{ flex: 1, minWidth: 260 }}>
          <Link to="/app" className="btn small ghost">
            ← Виджеты
          </Link>
          <input
            className="input"
            style={{ maxWidth: 340, fontWeight: 700 }}
            value={name}
            maxLength={80}
            aria-label="Название виджета"
            onChange={(e) => {
              setName(e.target.value);
              scheduleSave({ name: e.target.value });
            }}
          />
        </div>
        <div className="row">
          <span
            className={`save-state ${saveState === "error" ? "error" : saveState === "saved" ? "" : "saving"}`}
            role="status"
          >
            {saveLabel[saveState]}
          </span>
          {saveState === "error" && (
            <button className="btn small" onClick={flush}>
              Повторить
            </button>
          )}
        </div>
      </div>

      <div className="editor">
        <div className="card editor-panel">
          <div className="editor-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="editor-section">
            {tab === "presets" ? (
              <>
                <h3 style={{ margin: 0 }}>Готовые пресеты</h3>
                <div className="preset-grid">
                  {BUILT_IN_PRESETS.map((p) => (
                    <button key={p.id} className="preset-btn" onClick={() => applyConfig(p.config)}>
                      <strong>{p.name}</strong>
                      <span>{p.description}</span>
                    </button>
                  ))}
                </div>
                <div className="spread" style={{ marginTop: 8 }}>
                  <h3 style={{ margin: 0 }}>Мои пресеты</h3>
                  <button className="btn small" onClick={savePreset}>
                    Сохранить текущий
                  </button>
                </div>
                {presets.length === 0 ? (
                  <p className="muted small" style={{ margin: 0 }}>
                    Сохраните текущий дизайн как пресет, чтобы быстро применять его к другим виджетам.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 6 }}>
                    {presets.map((p) => (
                      <div key={p.id} className="spread" style={{ gap: 6 }}>
                        <button className="btn small ghost" style={{ flex: 1, justifyContent: "flex-start" }} onClick={() => applyConfig(p.config)}>
                          {p.name}
                        </button>
                        <button className="btn small danger" onClick={() => removePreset(p)} aria-label={`Удалить ${p.name}`}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="btn small ghost"
                  style={{ alignSelf: "flex-start" }}
                  onClick={async () => {
                    const ok = await dialogs.confirm({
                      title: "Сбросить все настройки?",
                      message: "Виджет вернётся к стандартному оформлению. Сохранённые пресеты не изменятся.",
                      confirmLabel: "Сбросить",
                      danger: true,
                    });
                    if (ok) applyConfig(DEFAULT_CONFIG);
                  }}
                >
                  Сбросить к стандартным
                </button>
              </>
            ) : (
              <EditorSections tab={tab} config={cfg} onChange={applyConfig} />
            )}
          </div>
        </div>

        <div className="preview-area">
          <div className="spread">
            <div className="row">
              <div className="segmented">
                <button className={source === "demo" || !canLive ? "active" : ""} onClick={() => setSource("demo")}>
                  Демо-трек
                </button>
                <button
                  className={source === "live" && canLive ? "active" : ""}
                  onClick={() => setSource("live")}
                  disabled={!canLive}
                  title={canLive ? "" : "Подключите Spotify, чтобы видеть свой текущий трек"}
                >
                  Мой Spotify
                </button>
              </div>
              <div className="segmented">
                {(
                  [
                    ["game", "Игра"],
                    ["dark", "Тёмный"],
                    ["light", "Светлый"],
                    ["checker", "Прозрачный"],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} className={stage === value ? "active" : ""} onClick={() => setStage(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="segmented">
              {[50, 75, 100, 150].map((z) => (
                <button key={z} className={zoom === z ? "active" : ""} onClick={() => setZoom(z)}>
                  {z}%
                </button>
              ))}
            </div>
          </div>
          <div className={`preview-stage ${stage === "checker" ? "checker" : `bg-${stage}`}`}>
            <div style={{ zoom: (zoom / 100) * (cfg.size.scale / 100) }}>
              <WidgetView config={cfg} playback={playback} receivedAt={receivedAt} lastItem={live.lastItem} preview />
            </div>
          </div>
          {source === "live" && canLive && live.playback && !live.playback.item && (
            <div className="alert info small">
              Spotify сейчас ничего не воспроизводит. Включите музыку в любом приложении Spotify — виджет обновится
              через несколько секунд.
            </div>
          )}
          <div className="card stack">
            <CopyField label="Ссылка для OBS Browser Source" value={link} secret={!appConfig.demo} />
            <p className="muted small" style={{ margin: 0 }}>
              Рекомендуемый размер источника в OBS: <b>{size.width}</b> × <b>{size.height}</b> px.
              {!appConfig.demo && " Изменения дизайна применяются к этой ссылке автоматически, переносить её в OBS заново не нужно."}{" "}
              <Link to="/obs">Инструкция для OBS</Link>
            </p>
            {appConfig.demo && (
              <p className="small" style={{ margin: 0, color: "var(--warn)" }}>
                В демо-режиме дизайн вшит в ссылку: после изменений её нужно скопировать заново.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
