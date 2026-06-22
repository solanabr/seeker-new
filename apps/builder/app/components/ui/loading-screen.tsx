import { OrbitalLoader } from '~/components/ui/orbital-loader';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading seeker.new workspace' }: LoadingScreenProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#090b0e] px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[rgba(159,212,239,0.10)] blur-[140px]" />
        <div className="absolute -bottom-48 left-1/2 h-[40rem] w-[55rem] -translate-x-1/2 rounded-full bg-[rgba(207,244,229,0.08)] blur-[150px]" />
        <div className="absolute top-1/2 -left-40 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full bg-[rgba(159,212,239,0.07)] blur-[130px]" />
        <div className="absolute top-1/3 -right-40 h-[34rem] w-[34rem] rounded-full bg-[rgba(207,244,229,0.07)] blur-[130px]" />
      </div>

      <div className="relative z-1 flex flex-col items-center gap-6 text-center">
        <div className="flex items-end gap-1.5">
          <img
            src="/images/seeker/seeker-wordmark.png"
            alt="Seeker"
            className="h-auto w-[12rem] drop-shadow-[0_0_30px_rgba(159,212,239,0.22)]"
          />
          <span className="pb-[0.2rem] text-3xl font-semibold leading-none tracking-tight text-[rgba(159,212,239,0.88)]">
            .new
          </span>
        </div>
        <OrbitalLoader message={message} />
      </div>
    </div>
  );
}
