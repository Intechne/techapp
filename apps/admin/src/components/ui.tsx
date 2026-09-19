import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toUiError } from '../lib';

/** Loads server data with explicit loading / error states. `reload` re-runs the same loader. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);
  const reload = useCallback(async () => {
    const mine = ++seq.current; setLoading(true);
    try { const d = await run(); if (mine === seq.current) { setData(d); setError(null); } }
    catch (e) { if (mine === seq.current) setError(toUiError(e).message); }
    finally { if (mine === seq.current) setLoading(false); }
  }, [run]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

/** Runs a server action; reports failure honestly and never claims success on error. */
export function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => PromiseLike<{ error: unknown }>, after?: () => void | Promise<void>): Promise<boolean> => {
    setBusy(true); setError(null);
    try {
      const { error: err } = await fn();
      if (err) { setError(toUiError(err).message); return false; }
      await after?.(); return true;
    } catch (e) { setError(toUiError(e).message); return false; } finally { setBusy(false); }
  }, []);
  return { busy, error, run, clearError: () => setError(null) };
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: readonly [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return <div className="tabs" role="group" aria-label={label}>{tabs.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export function SectionTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly [T, string][]; value: T; onChange: (v: T) => void }) {
  return <div className="section-tabs" role="tablist">{tabs.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export type Tone = '' | 'moss' | 'neutral' | 'danger' | 'apricot';
export const StatusTag = ({ label, tone = '' }: { label: string; tone?: Tone }) => <span className={`tag ${tone}`}>{label}</span>;

export function ListState({ loading, error, empty, emptyText, onRetry, children }: { loading: boolean; error: string | null; empty: boolean; emptyText: string; onRetry?: () => void; children: ReactNode }) {
  if (error) return <div className="notice err" role="alert">{error} {onRetry && <button type="button" className="linkish" onClick={onRetry}>Tekrar dene</button>}</div>;
  if (loading && empty) return <p className="muted" aria-live="polite">Yükleniyor…</p>;
  if (empty) return <p className="muted">{emptyText}</p>;
  return <>{children}</>;
}

export const ErrorNote = ({ message }: { message: string | null }) => (message ? <div className="notice err" role="alert">{message}</div> : null);

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <label>{label}{children}{help && <span className="muted small" style={{ fontWeight: 400 }}>{help}</span>}</label>;
}

export function CheckRow({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className="row checkrow"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> <span>{label}</span></label>;
}

/** Two-step button for irreversible actions (no browser confirm() dialogs). */
export function ConfirmButton({ label, confirmLabel, className = 'btn danger', disabled, onConfirm }: { label: string; confirmLabel: string; className?: string; disabled?: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>{label}</button>;
  return <span className="row"><button type="button" className="btn danger" disabled={disabled} onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button><button type="button" className="btn secondary" onClick={() => setArmed(false)}>Vazgeç</button></span>;
}
