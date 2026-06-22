import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { IconButton } from '~/components/ui/IconButton';
import { deviceRunStore } from '~/lib/stores/device-run';
import { workbenchStore } from '~/lib/stores/workbench';
import { isSeekerProject } from '~/lib/simulator-preview/detect';
import { classNames } from '~/utils/classNames';
import { rewriteLocalDeviceRunUrl } from '~/utils/device-run-url';
import { DeviceRunDialog } from './DeviceRunDialog';
import { PortDropdown } from './PortDropdown';
import { SimulatorPreview } from './SimulatorPreview.client';

type DeviceOrientation = 'portrait' | 'landscape';

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isDeviceRunOpen, setIsDeviceRunOpen] = useState(false);
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientation>('portrait');
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const hasSelectedPreview = useRef(false);
  const previews = useStore(workbenchStore.previews);
  const files = useStore(workbenchStore.files);
  const deviceRunTarget = useStore(deviceRunStore.target);
  const activePreview = previews[activePreviewIndex];

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();

  const [externalPreviewUrl, setExternalPreviewUrl] = useState<string | undefined>();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const param = new URLSearchParams(window.location.search).get('previewUrl');

    if (param) {
      setExternalPreviewUrl(param);

      workbenchStore.showWorkbench.set(true);
      workbenchStore.currentView.set('preview');
    }
  }, []);

  const detectedSeeker = useMemo(() => isSeekerProject(files), [files]);
  const isSeeker = detectedSeeker || externalPreviewUrl != null || previews.length === 0;
  const [deviceFrameOverride, setDeviceFrameOverride] = useState<boolean | null>(null);
  const deviceFrame = isSeeker ? true : deviceFrameOverride ?? false;

  useEffect(() => {
    if (!activePreview) {
      setUrl('');
      setIframeUrl(undefined);

      return;
    }

    const { baseUrl } = activePreview;

    setUrl(baseUrl);
    setIframeUrl(baseUrl);
  }, [activePreview, iframeUrl]);

  const previewUrl = iframeUrl ?? externalPreviewUrl;
  const hasPreview = activePreview != null || externalPreviewUrl != null;
  const normalizedDeviceRunTarget = useMemo(() => {
    if (!deviceRunTarget?.local || typeof window === 'undefined') {
      return deviceRunTarget;
    }

    const rewrittenUrl = rewriteLocalDeviceRunUrl(deviceRunTarget.url, window.location.hostname);

    return rewrittenUrl
      ? {
          ...deviceRunTarget,
          url: rewrittenUrl,
          local: false,
        }
      : deviceRunTarget;
  }, [deviceRunTarget]);

  const validateUrl = useCallback(
    (value: string) => {
      if (!activePreview) {
        return false;
      }

      const { baseUrl } = activePreview;

      if (value === baseUrl) {
        return true;
      } else if (value.startsWith(baseUrl)) {
        return ['/', '?', '#'].includes(value.charAt(baseUrl.length));
      }

      return false;
    },
    [activePreview],
  );

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: { port: number }, index: number, array: { port: number }[]) => {
      return preview.port < array[minIndex].port ? index : minIndex;
    },
    [],
  );

  // when previews change, display the lowest port if user hasn't selected a preview
  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview.current) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);

      setActivePreviewIndex(minPortIndex);
    }
  }, [previews]);

  const reloadPreview = () => {
    if (deviceFrame) {
      setPreviewReloadKey((key) => key + 1);
    } else if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const rotateDevice = () => {
    setDeviceOrientation((orientation) => (orientation === 'portrait' ? 'landscape' : 'portrait'));
  };

  if (deviceFrame) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-bolt-elements-background-depth-1">
        <DeviceRunDialog
          open={isDeviceRunOpen}
          deviceRunTarget={normalizedDeviceRunTarget}
          previewUrl={previewUrl}
          onClose={() => setIsDeviceRunOpen(false)}
        />
        <div className="absolute left-3 right-4 top-3 z-10 flex items-center justify-end gap-2 overflow-x-auto">
          <IconButton
            icon="i-ph:device-rotate"
            title={deviceOrientation === 'portrait' ? 'Rotate to landscape' : 'Rotate to portrait'}
            onClick={rotateDevice}
          />
          <PreviewToolbarButton icon="i-ph:upload-simple" disabled>
            Share
          </PreviewToolbarButton>
          <PreviewToolbarButton icon="i-ph:cube" disabled>
            No build yet
          </PreviewToolbarButton>
          <IconButton
            icon="i-ph:arrow-clockwise"
            title="Reload preview"
            disabled={!previewUrl}
            onClick={reloadPreview}
          />
          <PreviewToolbarButton
            icon="i-ph:device-mobile"
            disabled={!hasPreview && !normalizedDeviceRunTarget}
            onClick={() => setIsDeviceRunOpen(true)}
          >
            Run on your device
          </PreviewToolbarButton>
        </div>
        <div className="absolute inset-0 pt-16">
          <ClientOnly>
            {() => <SimulatorPreview url={previewUrl} orientation={deviceOrientation} reloadKey={previewReloadKey} />}
          </ClientOnly>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-1.5">
        <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} />
        <IconButton
          icon="i-ph:device-mobile"
          className={deviceFrame ? 'text-bolt-elements-item-contentAccent' : undefined}
          title={deviceFrame ? 'Showing Seeker device frame' : 'Show Seeker device frame'}
          onClick={() => setDeviceFrameOverride(!deviceFrame)}
        />
        <div
          className="flex items-center gap-1 flex-grow bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-full px-3 py-1 text-sm hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive
        focus-within-border-bolt-elements-borderColorActive focus-within:text-bolt-elements-preview-addressBar-textActive"
        >
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && validateUrl(url)) {
                setIframeUrl(url);

                if (inputRef.current) {
                  inputRef.current.blur();
                }
              }
            }}
          />
        </div>
        {previews.length > 1 && (
          <PortDropdown
            activePreviewIndex={activePreviewIndex}
            setActivePreviewIndex={setActivePreviewIndex}
            isDropdownOpen={isPortDropdownOpen}
            setHasSelectedPreview={(value) => (hasSelectedPreview.current = value)}
            setIsDropdownOpen={setIsPortDropdownOpen}
            previews={previews}
          />
        )}
      </div>
      <div className="flex-1 border-t border-bolt-elements-borderColor">
        {hasPreview && previewUrl ? (
          deviceFrame ? (
            <ClientOnly>{() => <SimulatorPreview url={previewUrl} />}</ClientOnly>
          ) : (
            <iframe ref={iframeRef} className="border-none w-full h-full bg-white" src={previewUrl} />
          )
        ) : (
          <div className="flex w-full h-full justify-center items-center bg-white">No preview available</div>
        )}
      </div>
    </div>
  );
});

interface PreviewToolbarButtonProps {
  children: string;
  disabled?: boolean;
  icon: string;
  onClick?: () => void;
}

function PreviewToolbarButton({ children, disabled = false, icon, onClick }: PreviewToolbarButtonProps) {
  return (
    <button
      className={classNames(
        'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 text-sm font-medium text-bolt-elements-textSecondary transition-colors duration-200',
        {
          'cursor-not-allowed opacity-45': disabled,
          'cursor-pointer hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary': !disabled,
        },
      )}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onClick?.();
        }
      }}
    >
      <div className={classNames(icon, 'text-lg')} />
      <span>{children}</span>
    </button>
  );
}
