// ─────────────────────────────────────────────────────────────────────────
// Sprint 5 · T05 — header provider control + first-open gate
// ─────────────────────────────────────────────────────────────────────────
//
// A small header island that:
//   • auto-opens the provider modal on first open (nothing persisted yet), and
//   • is the "change it later" entry point — a chip showing the active provider
//     that reopens the modal on click.
//
// The chosen provider is read back from localStorage on relaunch (persistence
// lives in `provider-preference.ts`). The chat reads the same persisted value
// at send time, so this island owns the UI only — no prop drilling into chat.

import { useEffect, useState } from 'react';
import { DialogRoot } from '~/components/ui/Dialog';
import { ProviderModal } from './ProviderModal';
import { classNames } from '~/utils/classNames';
import {
  PROVIDER_CHANGED_EVENT,
  providerLabel,
  readProviderPreference,
  writeProviderPreference,
  type ProviderPreference,
} from '~/lib/provider-preference';

export function ProviderControl() {
  return <ProviderControlButton />;
}

interface ProviderControlButtonProps {
  className?: string;
}

export function ProviderControlButton({ className }: ProviderControlButtonProps) {
  const [pref, setPref] = useState<ProviderPreference | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  // Read the persisted choice on mount; open the modal when there is none.
  useEffect(() => {
    const stored = readProviderPreference();
    setPref(stored);
    setReady(true);
    if (!stored) {
      setOpen(true);
    }
  }, []);

  // Stay in sync if another island changes the preference.
  useEffect(() => {
    const onChange = () => setPref(readProviderPreference());
    window.addEventListener(PROVIDER_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PROVIDER_CHANGED_EVENT, onChange);
  }, []);

  const handleSave = (next: ProviderPreference) => {
    writeProviderPreference(next);
    setPref(next);
    setOpen(false);
  };

  if (!ready) {
    return null;
  }

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <button
        className={classNames(
          'flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(12,16,22,0.42)] px-3 py-1.5 text-xs text-[rgba(232,240,247,0.96)] transition-colors hover:bg-[rgba(255,255,255,0.05)]',
          className,
        )}
        onClick={() => setOpen(true)}
        title="Choose how generation runs"
      >
        <span className="i-ph:plugs-connected text-sm" />
        <span>{providerLabel(pref)}</span>
      </button>

      {open && (
        <ProviderModal initial={pref} dismissible={Boolean(pref)} onSave={handleSave} onClose={() => setOpen(false)} />
      )}
    </DialogRoot>
  );
}
