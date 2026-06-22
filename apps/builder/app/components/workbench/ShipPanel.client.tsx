import { memo, useCallback, useRef, useState } from 'react';
import { Dialog, DialogRoot } from '~/components/ui/Dialog';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { classNames } from '~/utils/classNames';

interface ShipPanelProps {
  projectSlug: string;
}

type StageId = 'render' | 'ship' | 'inject';

interface StageView {
  id: StageId;
  label: string;
}

// Coarse, user-facing stages of the ship pipeline (faucet → build → deploy →
// client → wire). The headless rails run the fine-grained steps; we surface the
// pipeline as three readable beats plus a live log tail.
const STAGES: StageView[] = [
  { id: 'render', label: 'Prepare program' },
  { id: 'ship', label: 'Build & deploy to devnet' },
  { id: 'inject', label: 'Wire program into the app' },
];

interface ShipResult {
  cluster: string;
  programId: string;
  explorer: string;
  deployer: string;
  publish: { status: string; note?: string };
}

type StageStatus = 'pending' | 'active' | 'done';

export const ShipPanel = memo(({ projectSlug }: ShipPanelProps) => {
  const [open, setOpen] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [stageStatus, setStageStatus] = useState<Record<StageId, StageStatus>>({
    render: 'pending',
    ship: 'pending',
    inject: 'pending',
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ShipResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const reset = useCallback(() => {
    setStageStatus({ render: 'pending', ship: 'pending', inject: 'pending' });
    setLogs([]);
    setResult(null);
    setError(null);
  }, []);

  const runShip = useCallback(async () => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    setShipping(true);
    reset();

    try {
      const response = await fetch(`/api/ship/${projectSlug}`, { method: 'POST' });
      if (!response.ok || !response.body) {
        throw new Error(`Ship failed to start (status ${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // The route streams newline-delimited JSON events.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim()) {
            handleEvent(line);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setShipping(false);
      startedRef.current = false;
    }
  }, [projectSlug, reset]);

  const handleEvent = useCallback((line: string) => {
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    switch (event.type) {
      case 'stage':
        setStageStatus((prev) => ({
          ...prev,
          [event.stage as StageId]: event.status === 'done' ? 'done' : 'active',
        }));
        break;
      case 'log':
        setLogs((prev) => [...prev.slice(-80), event.message]);
        break;
      case 'result':
        setResult(event.result as ShipResult);
        setStageStatus({ render: 'done', ship: 'done', inject: 'done' });
        break;
      case 'error':
        setError(event.message as string);
        break;
      default:
        break;
    }
  }, []);

  const onShipClick = useCallback(() => {
    setOpen(true);
    runShip().catch((err) => {
      console.error(err);
    });
  }, [runShip]);

  return (
    <>
      <PanelHeaderButton
        className="mr-1 text-sm"
        disabled={shipping}
        onClick={onShipClick}
      >
        <div className={shipping ? 'i-svg-spinners:90-ring-with-bg' : 'i-ph:rocket-launch'} />
        {shipping ? 'Shipping' : 'Ship'}
      </PanelHeaderButton>

      <DialogRoot open={open} onOpenChange={setOpen}>
        <Dialog onBackdrop={() => setOpen(false)} onClose={() => setOpen(false)} className="max-w-[460px]">
          <div className="px-5 py-5">
            <div className="text-lg font-semibold text-bolt-elements-textPrimary">Ship to Solana devnet</div>
            <div className="mt-1 text-sm text-bolt-elements-textSecondary">
              Deploys this app's program to devnet and wires it into the app.
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {STAGES.map((stage) => {
                const status = stageStatus[stage.id];
                return (
                  <div key={stage.id} className="flex items-center gap-2 text-sm">
                    <div
                      className={classNames('text-base', {
                        'i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress': status === 'active',
                        'i-ph:check-circle-fill text-green-500': status === 'done',
                        'i-ph:circle text-bolt-elements-textTertiary': status === 'pending',
                      })}
                    />
                    <span
                      className={classNames({
                        'text-bolt-elements-textPrimary': status !== 'pending',
                        'text-bolt-elements-textTertiary': status === 'pending',
                      })}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {logs.length > 0 && !result && (
              <div className="mt-4 max-h-32 overflow-auto rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 font-mono text-xs text-bolt-elements-textTertiary">
                {logs.slice(-8).map((entry, index) => (
                  <div key={index} className="truncate">
                    {entry}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-3">
                  <div className="text-xs uppercase tracking-wide text-bolt-elements-textTertiary">Program deployed</div>
                  <div className="mt-1 break-all font-mono text-sm text-bolt-elements-textPrimary">
                    {result.programId}
                  </div>
                  <div className="mt-1 text-xs text-bolt-elements-textSecondary">on {result.cluster}</div>
                  <a
                    href={result.explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-bolt-elements-item-contentAccent hover:underline"
                  >
                    <div className="i-ph:arrow-square-out" />
                    View on Solana Explorer
                  </a>
                </div>

                {/* Publish seam — slots in once dApp Store publish lands. */}
                <div className="flex items-center justify-between rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-3">
                  <div>
                    <div className="text-sm text-bolt-elements-textPrimary">Publish to Solana dApp Store</div>
                    <div className="text-xs text-bolt-elements-textTertiary">Coming soon</div>
                  </div>
                  <span className="rounded-full border border-bolt-elements-borderColor px-2 py-0.5 text-xs text-bolt-elements-textTertiary">
                    Pending
                  </span>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      </DialogRoot>
    </>
  );
});
