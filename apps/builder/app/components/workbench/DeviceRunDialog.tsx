import { memo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import type { DeviceRunTarget } from '~/lib/stores/device-run';

interface DeviceRunDialogProps {
  open: boolean;
  deviceRunTarget?: DeviceRunTarget;
  previewUrl?: string;
  onClose: () => void;
}

export const DeviceRunDialog = memo(({ open, deviceRunTarget, previewUrl, onClose }: DeviceRunDialogProps) => {
  const deviceRunUrl = deviceRunTarget?.url;
  const targetLabel = deviceRunTarget?.kind === 'development-build' ? 'Development build' : 'Expo Go';

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <Dialog onBackdrop={onClose} onClose={onClose} className="max-w-[390px]">
        <DialogTitle>Run on your device</DialogTitle>
        <DialogDescription asChild>
          <div className="px-5 py-5">
            <div className="mx-auto flex h-[236px] w-[236px] items-center justify-center rounded-lg border border-bolt-elements-borderColor bg-white p-3">
              {deviceRunUrl ? (
                <QRCodeSVG value={deviceRunUrl} size={208} bgColor="#ffffff" fgColor="#0b0b0f" level="M" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-bolt-elements-textTertiary">
                  <div className="i-ph:device-mobile-slash text-4xl" />
                  <div className="text-sm">No Expo device URL yet</div>
                </div>
              )}
            </div>
            {deviceRunUrl ? (
              <div className="mt-4 truncate rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-center text-xs text-bolt-elements-textSecondary">
                {targetLabel}: {deviceRunUrl}
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-center text-xs text-bolt-elements-textSecondary">
                {previewUrl
                  ? 'The current preview is the browser simulator. Start an Expo or Metro server and this QR will switch to the native device URL.'
                  : 'Start a preview or Expo server to enable device run.'}
              </div>
            )}
            {deviceRunTarget?.local ? (
              <div className="mt-2 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-center text-xs text-bolt-elements-textTertiary">
                This URL uses localhost. Use a LAN host or Expo tunnel if the device cannot reach this machine.
              </div>
            ) : null}
          </div>
        </DialogDescription>
      </Dialog>
    </DialogRoot>
  );
});
