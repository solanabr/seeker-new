import type { Message } from 'ai';
import React, { type RefCallback } from 'react';
import type { ProjectPlan } from '~/lib/.server/seeker/shared';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { ProviderControlButton } from '~/components/provider/ProviderControl.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { Messages } from './Messages.client';

import styles from './BaseChat.module.scss';

const FEATURE_STEPS = [
  {
    step: '01',
    title: 'App + Solana Program Generator',
    description:
      'A single prompt generates the mobile app and its Solana program — UI, wallet flow, onchain logic, and devnet structure.',
    iconClassName: 'i-ph:device-mobile-camera',
  },
  {
    step: '02',
    title: 'Compile + Preview',
    description:
      'Build with an Android emulator preview and QR-code testing. See the app running on a real device before publishing.',
    iconClassName: 'i-ph:cpu',
  },
  {
    step: '03',
    title: 'Devnet + dApp Store Deploy',
    description:
      'Faucet devnet SOL, integrate native protocols, deploy to devnet, and autopublish straight to the Solana dApp Store.',
    iconClassName: 'i-ph:cubes',
  },
] as const;

const GITHUB_REPO_URL = 'https://github.com/solanabr/seeker-new';
const GITHUB_REPO_LABEL = 'solanabr/seeker-new';
const GITHUB_STAR_COUNT = 0;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  activePlanMessageIndex?: number;
  onConfirmPlan?: (plan: ProjectPlan) => void;
  onEditPlan?: (plan: ProjectPlan) => void;
  onRegeneratePlan?: (plan: ProjectPlan) => void;
}

const EXAMPLE_PROMPTS = [
  { text: 'Create a Solana Mobile app with wallet login and a simple home screen.' },
  { text: 'Create a Solana Mobile app called PayFriend with wallet login and a simple payment home screen.' },
  { text: 'Create a Solana Mobile app called EventPass with wallet login and a ticketing dashboard.' },
  { text: 'Create a Solana Mobile app called Scout with wallet login and a portfolio overview.' },
  { text: 'Create a Solana Mobile app called CrewPay with wallet login and team expense tracking.' },
];

const TEXTAREA_MIN_HEIGHT = 76;

function formatCompactCount(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
      activePlanMessageIndex = -1,
      onConfirmPlan,
      onEditPlan,
      onRegeneratePlan,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const showIntro = !chatStarted;

    return (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden bg-[#090b0e]')}
        data-chat-visible={showChat}
      >
        {chatStarted && <ClientOnly>{() => <Menu />}</ClientOnly>}
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div
            className={classNames(styles.Chat, 'flex flex-col flex-grow h-full', {
              'min-w-[var(--chat-min-width)]': chatStarted,
            })}
          >
            {showIntro && (
              <div className={styles.IntroPage}>
                <header className={styles.IntroNav}>
                  <a href="/" className={styles.IntroNavBrand} aria-label="seeker.new home">
                    <img src="/images/seeker/seeker-wordmark.png" alt="Seeker" className={styles.IntroNavWordmark} />
                    <span className={styles.IntroNavDotNew}>.new</span>
                  </a>

                  <div className={styles.IntroNavActions}>
                    <ClientOnly>{() => <ProviderControlButton className={styles.IntroProviderButton} />}</ClientOnly>
                    <a
                      href={GITHUB_REPO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.IntroGithubButton}
                      aria-label={`Open ${GITHUB_REPO_LABEL} on GitHub`}
                    >
                      <GithubMark className={styles.IntroGithubIcon} />
                      <span className={styles.IntroGithubText}>
                        <span className={styles.IntroGithubLabel}>Open Source</span>
                        <span className={styles.IntroGithubRepo}>{GITHUB_REPO_LABEL}</span>
                      </span>
                      <span className={styles.IntroGithubStars}>
                        <div className="i-ph:star-fill text-[0.875rem]" />
                        {formatCompactCount(GITHUB_STAR_COUNT)}
                      </span>
                    </a>
                  </div>
                </header>

                <section className={styles.IntroHeroSection}>
                  <div aria-hidden="true" className={styles.IntroBackdrop}>
                    <div className={styles.TopGlow} />
                    <div className={styles.BottomGlow} />
                    <div className={styles.LeftGlow} />
                    <div className={styles.RightGlow} />
                    <div className={styles.GridOverlay} />
                    <div className={styles.Vignette} />
                    <div className={styles.DeviceVisual}>
                      <div className={styles.DeviceGlow} />
                      <img src="/images/seeker/seeker-phone.png" alt="" className={styles.DeviceImage} />
                    </div>
                  </div>
                  <div
                    className={classNames('pt-6 px-6', {
                      'h-full flex flex-col': chatStarted,
                      [styles.IntroLayout]: showIntro,
                    })}
                  >
                    <div
                      className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                        'sticky bottom-0': chatStarted,
                        [styles.IntroPromptWrap]: showIntro,
                      })}
                    >
                      <div
                        className={classNames('shadow-sm backdrop-filter backdrop-blur-[8px] overflow-hidden', {
                          [styles.IntroPromptShell]: showIntro,
                          'rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background':
                            chatStarted,
                        })}
                      >
                        {showIntro && (
                          <div id="intro" className={styles.IntroHeader}>
                            <p className={styles.IntroEyebrow}>The Definitive Web3 App Builder</p>
                            <div className={styles.IntroBrandRow}>
                              <img
                                src="/images/seeker/seeker-wordmark.png"
                                alt="Seeker"
                                className={styles.IntroWordmark}
                              />
                              <span className={styles.IntroDotNew}>.new</span>
                            </div>
                            <p className={styles.IntroCopy}>
                              Describe the app, generate a real Solana Mobile starter, inspect files, and iterate in the
                              workbench.
                            </p>
                          </div>
                        )}
                        <textarea
                          ref={textareaRef}
                          className={classNames(
                            'w-full focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent',
                            {
                              'pl-4 pt-4 pr-16': chatStarted,
                              [styles.IntroTextarea]: showIntro,
                            },
                          )}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              if (event.shiftKey) {
                                return;
                              }

                              event.preventDefault();

                              sendMessage?.(event);
                            }
                          }}
                          value={input}
                          onChange={(event) => {
                            handleInputChange?.(event);
                          }}
                          style={{
                            minHeight: TEXTAREA_MIN_HEIGHT,
                            maxHeight: TEXTAREA_MAX_HEIGHT,
                          }}
                          placeholder="Describe the app you want to generate"
                          translate="no"
                        />
                        <div className={styles.IntroControls}>
                          <div className={styles.IntroControlsLeft}>
                            <button type="button" className={styles.IntroIconButton} aria-label="Attach a file">
                              <div className="i-ph:paperclip text-base" />
                            </button>
                            <button
                              type="button"
                              title="Enhance prompt"
                              disabled={input.length === 0 || enhancingPrompt}
                              className={classNames(styles.IntroAgentChip, {
                                [styles.IntroAgentChipEnhanced]: promptEnhanced,
                              })}
                              onClick={() => enhancePrompt?.()}
                            >
                              {enhancingPrompt ? (
                                <>
                                  <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-sm" />
                                  <span>Enhancing</span>
                                </>
                              ) : (
                                <>
                                  <div className="i-bolt:stars text-sm" />
                                  <span>{promptEnhanced ? 'Prompt Enhanced' : 'Seeker Agent'}</span>
                                </>
                              )}
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={input.trim().length === 0 && !isStreaming}
                            className={styles.IntroGenerateButton}
                            onClick={(event) => {
                              if (isStreaming) {
                                handleStop?.();
                                return;
                              }

                              sendMessage?.(event);
                            }}
                          >
                            {isStreaming ? (
                              <>
                                <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                                <span>Generating</span>
                              </>
                            ) : (
                              <>
                                <span>Generate</span>
                                <div className="i-ph:arrow-up text-sm" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div id="examples" className={styles.IntroExamples}>
                      <div className={styles.IntroExamplesList}>
                        {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                          return (
                            <button
                              key={index}
                              onClick={(event) => {
                                sendMessage?.(event, examplePrompt.text);
                              }}
                              className={styles.IntroExampleButton}
                            >
                              <span className={styles.IntroExampleText}>{examplePrompt.text}</span>
                              <div className={classNames('i-ph:arrow-up-right', styles.IntroExampleIcon)} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                <section className={styles.FeaturesSection}>
                  <div className={styles.FeaturesHeader}>
                    <h2 className={styles.FeaturesTitle}>Prompt to dApp Store</h2>
                    <p className={styles.FeaturesCopy}>
                      One open-source workflow that takes you from an idea to a published Solana Mobile app — no
                      gatekeepers, no platform fees.
                    </p>
                  </div>

                  <div className={styles.StepGrid}>
                    {FEATURE_STEPS.map((feature) => (
                      <article key={feature.step} className={styles.StepCard}>
                        <div className={styles.StepCardHeader}>
                          <div className={styles.StepIconWrap}>
                            <div className={classNames(feature.iconClassName, styles.StepIcon)} />
                          </div>
                          <span className={styles.StepNumber}>{feature.step}</span>
                        </div>
                        <h3 className={styles.StepTitle}>{feature.title}</h3>
                        <p className={styles.StepDescription}>{feature.description}</p>
                      </article>
                    ))}
                  </div>

                  <div className={styles.BentoGrid}>
                    <article className={classNames(styles.BentoCard, styles.BentoCardLarge)}>
                      <div aria-hidden="true" className={styles.OpenSourceVisual}>
                        <div className={styles.OpenSourceGlow} />
                        <div className={styles.OpenSourceRingSmall} />
                        <div className={styles.OpenSourceRingMedium} />
                        <div className={styles.OpenSourceRingLarge} />
                        <SolanaMark className={styles.OpenSourceMark} />
                      </div>

                      <div className={styles.BentoLargeBody}>
                        <div className={styles.BentoTagRow}>
                          <GithubMark className={styles.GithubIcon} />
                          <span className={styles.BentoTag}>Open Source</span>
                        </div>
                        <h3 className={styles.BentoTitle}>Build in the open. Own what you ship.</h3>
                        <p className={styles.BentoDescription}>
                          Every template, SDK, and tool is fully open source. Fork it, audit it, and extend it — no
                          lock-in, no platform fees, no gatekeepers.
                        </p>
                        <a
                          href={GITHUB_REPO_URL}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.BentoOutlineButton}
                        >
                          <GithubMark className={styles.GithubIconSmall} />
                          <span>View on GitHub</span>
                        </a>
                      </div>
                    </article>

                    <article className={styles.BentoCard}>
                      <div className={styles.BentoIconRow}>
                        <div className={styles.StepIconWrap}>
                          <div className="i-ph:terminal-window text-[1.25rem] text-[var(--intro-accent)]" />
                        </div>
                        <span className={styles.BentoSeparator}>/</span>
                        <div className={styles.StepIconWrap}>
                          <div className="i-ph:key text-[1.25rem] text-[var(--intro-accent)]" />
                        </div>
                      </div>
                      <div>
                        <span className={styles.BentoTag}>Run Anywhere</span>
                        <h3 className={styles.BentoSmallTitle}>Local agent or your API key.</h3>
                        <p className={styles.BentoSmallDescription}>
                          Run the Seeker agent fully on your machine, or plug in your own API key. Your keys and code
                          stay yours.
                        </p>
                      </div>
                    </article>

                    <article className={styles.BentoCard}>
                      <div className={styles.StepIconWrap}>
                        <div className="i-ph:wallet text-[1.25rem] text-[var(--intro-accent)]" />
                      </div>
                      <div>
                        <span className={styles.BentoTag}>Wallet, built in</span>
                        <h3 className={styles.BentoSmallTitle}>Seed Vault + MWA, day one.</h3>
                        <p className={styles.BentoSmallDescription}>
                          Native wallet auth and hardware-backed Seed Vault signing ship in every generated app — no SDK
                          wiring required.
                        </p>
                      </div>
                    </article>
                  </div>

                  <a href="#" className={styles.FeaturesLink}>
                    <span>Read the full developer docs</span>
                    <div className="i-ph:arrow-right text-base" />
                  </a>
                </section>

                <footer className={styles.SiteFooter}>
                  <div className={styles.FooterInner}>
                    <div className={styles.FooterBrand}>
                      <span className={styles.FooterBrandText}>SOLANA</span>
                      <SolanaMark className={styles.FooterMark} />
                      <span className={styles.FooterBrandText}>MOBILE</span>
                    </div>
                    <p className={styles.FooterCopy}>
                      seeker.new creates apps only. A concept builder inspired by Solana Mobile.
                    </p>
                  </div>
                </footer>
              </div>
            )}
            {chatStarted && (
              <div className="flex h-full flex-col px-6 pt-6">
                <ClientOnly>
                  {() => {
                    return chatStarted ? (
                      <>
                        <Messages
                          ref={messageRef}
                          className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                          messages={messages}
                          isStreaming={isStreaming}
                          activePlanMessageIndex={activePlanMessageIndex}
                          onConfirmPlan={onConfirmPlan}
                          onEditPlan={onEditPlan}
                          onRegeneratePlan={onRegeneratePlan}
                        />
                      </>
                    ) : null;
                  }}
                </ClientOnly>
                <div className="relative w-full max-w-chat mx-auto z-prompt sticky bottom-0">
                  <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(255,255,255,0.12)] bg-[rgba(15,18,24,0.88)] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_28px_rgba(159,212,239,0.08)] backdrop-blur-xl">
                    <textarea
                      ref={textareaRef}
                      className="w-full resize-none bg-transparent px-5 pt-5 text-left text-base text-[rgba(232,240,247,0.96)] outline-none placeholder:text-[rgba(193,205,217,0.48)]"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();

                          sendMessage?.(event);
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder="Describe the app you want to generate"
                      translate="no"
                    />
                    <div className="flex items-center justify-between px-3 pb-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-[rgba(193,205,217,0.7)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(232,240,247,0.96)]"
                          aria-label="Attach a file"
                        >
                          <div className="i-ph:paperclip text-base" />
                        </button>
                        <button
                          type="button"
                          title="Enhance prompt"
                          disabled={input.length === 0 || enhancingPrompt}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-[rgba(193,205,217,0.72)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(232,240,247,0.96)] disabled:cursor-not-allowed disabled:opacity-45"
                          onClick={() => enhancePrompt?.()}
                        >
                          {enhancingPrompt ? (
                            <>
                              <div className="i-svg-spinners:90-ring-with-bg text-sm text-[rgba(159,212,239,0.88)]" />
                              <span>Enhancing</span>
                            </>
                          ) : (
                            <>
                              <div className="i-bolt:stars text-sm text-[rgba(159,212,239,0.88)]" />
                              <span>{promptEnhanced ? 'Prompt Enhanced' : 'Seeker Agent'}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={input.trim().length === 0 && !isStreaming}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-[rgba(207,244,229,0.92)] px-4 text-sm font-semibold text-[#12211b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          sendMessage?.(event);
                        }}
                      >
                        {isStreaming ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                            <span>Generating</span>
                          </>
                        ) : (
                          <>
                            <span>Generate</span>
                            <div className="i-ph:arrow-up text-sm" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-transparent pb-6">{/* Ghost Element */}</div>
                </div>
              </div>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);

function SolanaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 398 312"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Solana"
    >
      <path
        d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7Z"
        fill="currentColor"
      />
      <path
        d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8Z"
        fill="currentColor"
      />
      <path
        d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="GitHub"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A10.94 10.94 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
