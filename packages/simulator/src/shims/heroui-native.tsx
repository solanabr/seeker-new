/**
 * heroui-native shim — a simulator-boundary stand-in (T02).
 *
 * The beeman template builds its UI with `heroui-native`, whose real
 * implementation depends on `react-native-reanimated` (worklets / a Babel
 * plugin) and the uniwind Metro transform — neither of which runs under the
 * simulator's Vite + react-native-web pipeline. Per the trusted-template
 * principle we do NOT edit the template; instead we alias `heroui-native` to this
 * shim at the bundler boundary so the real template components
 * (`AuthUiSolanaConnect`, `AuthUiConnectionStatus`, …) render unmodified.
 *
 * It reimplements only the surface the rendered components import — Card (+ slots),
 * Button (+ Label), Spinner, `useThemeColor`, `cn` — on plain react-native(-web)
 * primitives with a dark Seeker-ish theme. Fidelity is "structurally faithful,
 * reasonably styled," not pixel-perfect; this is a documented shim, listed in the
 * README's native-module shim table.
 */

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

// ── theme ────────────────────────────────────────────────────────────────────

const THEME = {
  background: '#0d0d12',
  foreground: '#f5f5f7',
  card: '#16161d',
  border: 'rgba(255,255,255,0.08)',
  muted: 'rgba(255,255,255,0.55)',
  primary: '#9945FF',
  primaryForeground: '#0b0b0f',
  secondary: 'rgba(255,255,255,0.08)',
  danger: '#ff6363',
  success: '#14F195',
  accent: '#14F195',
} as const;

type ThemeColor = keyof typeof THEME;

/** Mirrors heroui-native's `useThemeColor(name)`. */
export function useThemeColor(name: ThemeColor | string): string {
  return (THEME as Record<string, string>)[name] ?? THEME.foreground;
}

/** Mirrors heroui-native's `cn(...)` className joiner. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface SlotProps {
  children?: ReactNode;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
  numberOfLines?: number;
}

function CardRoot({ children, style }: SlotProps) {
  return (
    <View
      style={[
        {
          backgroundColor: THEME.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: THEME.border,
          padding: 16,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function CardTitle({ children, style }: SlotProps) {
  return (
    <Text
      style={[
        { color: THEME.foreground, fontSize: 17, fontWeight: '700' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function CardDescription({ children, style }: SlotProps) {
  return (
    <Text style={[{ color: THEME.muted, fontSize: 13 }, style]}>{children}</Text>
  );
}

function CardBody({ children, style }: SlotProps) {
  return <View style={[{ gap: 6 }, style]}>{children}</View>;
}

function CardFooter({ children, style }: SlotProps) {
  return <View style={[{ gap: 8 }, style]}>{children}</View>;
}

export const Card = Object.assign(CardRoot, {
  Title: CardTitle,
  Description: CardDescription,
  Body: CardBody,
  Footer: CardFooter,
});

// ── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | string;
  onPress?: () => void;
  isDisabled?: boolean;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
}

function ButtonRoot({
  children,
  variant = 'primary',
  onPress,
  isDisabled,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={
        [
          {
            backgroundColor: isPrimary ? THEME.primary : THEME.secondary,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 18,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? 'default' : 'pointer',
            userSelect: 'none',
          },
          style,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any
      }
    >
      {typeof children === 'string' ? (
        <Text
          style={{
            color: isPrimary ? THEME.primaryForeground : THEME.foreground,
            fontWeight: '700',
            fontSize: 15,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

function ButtonLabel({ children, style }: SlotProps) {
  return (
    <Text
      style={[{ color: THEME.foreground, fontWeight: '700', fontSize: 15 }, style]}
    >
      {children}
    </Text>
  );
}

export const Button = Object.assign(ButtonRoot, { Label: ButtonLabel });

// ── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 16 : size === 'lg' ? 32 : 24;
  return (
    <View
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          borderWidth: 2,
          borderColor: THEME.border,
          borderTopColor: THEME.primary,
          // RNW renders this as a CSS animation via the className escape hatch.
          animationKeyframes: [{ to: { transform: [{ rotate: '360deg' }] } }],
          animationDuration: '0.8s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }
    />
  );
}

// ── Provider passthrough (rendered by the template's AppProviders) ────────────

export function HeroUINativeProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
