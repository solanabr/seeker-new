/**
 * ApprovalSheet — the Seeker-style wallet approval UX (T04).
 *
 * This is the demo the whole sprint exists to produce: a bottom sheet that slides
 * up over the device screen when the rendered app makes a wallet request, walks
 * the user through connect → approval → signing → tx-result, and supports both
 * approve and reject paths.
 *
 * It is simulator *chrome*: it renders in the simulator's react-dom tree (above
 * the device screen), not inside the react-native-web app. It owns no wallet
 * state — it subscribes to a {@link MockMwaProvider} and calls `approve()` /
 * `reject()` / `dismissResult()` on it. That keeps the sheet a pure view over the
 * same controller the rendered app drives through the mock MWA kit.
 *
 * Fidelity of this interaction is the product wedge (PRD §9), so the styling aims
 * to read as a real Seeker / Seed Vault approval sheet rather than a debug panel.
 */

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';

import type {
  MockMwaProvider,
  MockWalletState,
  MockRequestType,
} from './MockMwaProvider';

export interface ApprovalSheetProps {
  /** The shared mock wallet controller this sheet renders. */
  controller: MockMwaProvider;
}

const TITLES: Record<MockRequestType, string> = {
  authorize: 'Connection Request',
  'sign-message': 'Signature Request',
  'sign-transaction': 'Approve Transaction',
  'sign-and-send': 'Approve Transaction',
};

const ACTION_LABELS: Record<MockRequestType, string> = {
  authorize: 'Connect',
  'sign-message': 'Sign',
  'sign-transaction': 'Approve',
  'sign-and-send': 'Approve',
};

export function ApprovalSheet({ controller }: ApprovalSheetProps): ReactElement | null {
  const [state, setState] = useState<MockWalletState>(() =>
    controller.getState(),
  );

  useEffect(() => controller.subscribe(setState), [controller]);

  const visible = state.phase !== 'idle';

  if (!visible) {
    return null;
  }

  return (
    <div style={scrimStyle} data-simulator-approval-scrim>
      <div style={sheetStyle} role="dialog" aria-modal="true">
        <div style={grabberStyle} />
        <SheetBody controller={controller} state={state} />
      </div>
    </div>
  );
}

function SheetBody({
  controller,
  state,
}: {
  controller: MockMwaProvider;
  state: MockWalletState;
}): ReactElement {
  if (state.phase === 'signing') {
    return (
      <div style={centerColumn}>
        <Spinner />
        <div style={titleStyle}>Signing…</div>
        <div style={subtitleStyle}>Approving with the Seed Vault (mock)</div>
      </div>
    );
  }

  if (state.phase === 'result' && state.result) {
    const { approved, label, error } = state.result;
    return (
      <div style={centerColumn}>
        <StatusGlyph ok={approved} />
        <div style={titleStyle}>
          {approved ? 'Approved' : 'Request Rejected'}
        </div>
        {approved && label ? (
          <div style={signatureBox} title={label}>
            <div style={subtitleStyle}>Signature</div>
            <code style={codeStyle}>{ellipsizeMiddle(label, 10)}</code>
          </div>
        ) : (
          <div style={subtitleStyle}>{error ?? 'No action taken.'}</div>
        )}
        <button
          style={primaryButton}
          onClick={() => controller.dismissResult()}
        >
          Done
        </button>
      </div>
    );
  }

  // awaiting-approval
  const pending = state.pending;
  if (!pending) {
    return <div style={centerColumn} />;
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={seekerBadge}>
        <span style={seekerDot} /> Seeker Wallet · Devnet
      </div>
      <div style={titleStyle}>{TITLES[pending.type]}</div>
      <div style={summaryStyle}>{pending.summary}</div>

      {pending.details && pending.details.length > 0 ? (
        <div style={detailCard}>
          {pending.details.map((line, i) => (
            <div key={i} style={detailLine}>
              {line}
            </div>
          ))}
        </div>
      ) : null}

      <div style={buttonRow}>
        <button style={secondaryButton} onClick={() => controller.reject()}>
          Reject
        </button>
        <button style={primaryButton} onClick={() => controller.approve()}>
          {ACTION_LABELS[pending.type]}
        </button>
      </div>
      <div style={footnoteStyle}>
        Mock signer · no funds move · no network call
      </div>
    </div>
  );
}

// ── tiny presentational atoms ────────────────────────────────────────────────

function Spinner(): ReactElement {
  return (
    <div style={spinnerWrap}>
      <div style={spinnerRing} />
      <style>{KEYFRAMES}</style>
    </div>
  );
}

function StatusGlyph({ ok }: { ok: boolean }): ReactElement {
  return (
    <div
      style={{
        ...glyphCircle,
        background: ok ? 'rgba(20, 241, 149, 0.15)' : 'rgba(255, 99, 99, 0.15)',
        color: ok ? '#14F195' : '#ff6363',
      }}
    >
      {ok ? '✓' : '✕'}
    </div>
  );
}

function ellipsizeMiddle(value: string, edge: number): string {
  return value.length > edge * 2 + 1
    ? `${value.slice(0, edge)}…${value.slice(-edge)}`
    : value;
}

// ── styles (Seeker-ish dark glass) ───────────────────────────────────────────

const SOLANA_PURPLE = '#9945FF';
const SOLANA_GREEN = '#14F195';

const scrimStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  background: 'rgba(0, 0, 0, 0.55)',
  pointerEvents: 'auto',
};

const sheetStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #16161d 0%, #0d0d12 100%)',
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  padding: '12px 20px 22px',
  color: '#fff',
  boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
};

const grabberStyle: CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.25)',
  margin: '0 auto 16px',
};

const seekerBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.6)',
  background: 'rgba(255,255,255,0.06)',
  padding: '4px 10px',
  borderRadius: 999,
  marginBottom: 14,
};

const seekerDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 3,
  background: SOLANA_GREEN,
  display: 'inline-block',
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginBottom: 6,
};

const summaryStyle: CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.7)',
  marginBottom: 16,
};

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,0.6)',
  textAlign: 'center',
};

const detailCard: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: '12px 14px',
  marginBottom: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const detailLine: CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,0.82)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  wordBreak: 'break-word',
};

const buttonRow: CSSProperties = {
  display: 'flex',
  gap: 12,
};

const baseButton: CSSProperties = {
  flex: 1,
  border: 'none',
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
};

const primaryButton: CSSProperties = {
  ...baseButton,
  marginTop: 8,
  background: `linear-gradient(135deg, ${SOLANA_PURPLE}, ${SOLANA_GREEN})`,
  color: '#0b0b0f',
};

const secondaryButton: CSSProperties = {
  ...baseButton,
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
};

const footnoteStyle: CSSProperties = {
  marginTop: 14,
  textAlign: 'center',
  fontSize: 11,
  color: 'rgba(255,255,255,0.4)',
};

const centerColumn: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: '12px 0',
  width: '100%',
};

const signatureBox: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

const codeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 13,
  color: SOLANA_GREEN,
  background: 'rgba(20,241,149,0.08)',
  padding: '4px 10px',
  borderRadius: 8,
};

const glyphCircle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  fontWeight: 700,
};

const spinnerWrap: CSSProperties = {
  width: 48,
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const spinnerRing: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  border: '3px solid rgba(255,255,255,0.12)',
  borderTopColor: SOLANA_PURPLE,
  animation: 'seeker-spin 0.8s linear infinite',
};

const KEYFRAMES = `@keyframes seeker-spin { to { transform: rotate(360deg); } }`;
