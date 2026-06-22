import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { ProviderControl } from '~/components/provider/ProviderControl.client';

export function Header() {
  const chat = useStore(chatStore);

  if (!chat.started) {
    return null;
  }

  return (
    <header className="flex h-[var(--header-height)] items-center border-b border-[rgba(255,255,255,0.08)] bg-[#090b0e] px-5 text-[rgba(232,240,247,0.96)]">
      <div className="z-logo flex items-center gap-3">
        <div className="i-ph:sidebar-simple-duotone text-xl text-[rgba(193,205,217,0.82)]" />
        <a href="/" className="flex items-end gap-1 tracking-tight">
          <span className="text-xl font-semibold text-[rgba(232,240,247,0.96)]">seeker</span>
          <span className="pb-[1px] text-xl font-semibold text-[rgba(159,212,239,0.88)]">.new</span>
        </a>
      </div>
      <span className={classNames('flex-1 px-4 text-center text-[rgba(193,205,217,0.74)]')}>
        <ClientOnly>{() => <ChatDescription />}</ClientOnly>
      </span>
      <ClientOnly>{() => <ProviderControl />}</ClientOnly>
      <ClientOnly>
        {() => (
          <div className="ml-2 mr-1">
            <HeaderActionButtons />
          </div>
        )}
      </ClientOnly>
    </header>
  );
}
