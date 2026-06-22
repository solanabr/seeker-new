import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { LoadingScreen } from '~/components/ui/loading-screen';

export const meta: MetaFunction = () => {
  return [
    { title: 'seeker.new' },
    { name: 'description', content: 'seeker.new creates apps only, using a constrained Solana Mobile workflow.' },
  ];
};

export const loader = () => json({});

export default function Index() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ClientOnly fallback={<LoadingScreen message="Preparing seeker.new" />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
