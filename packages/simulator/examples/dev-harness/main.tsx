/**
 * Standalone dev harness for seeker-simulator.
 *
 * Mounts <Simulator> rendering the REAL beeman template home screen
 * (react-native-web, T02) wired to the mock MWA layer (T03) and the Seeker
 * approval sheet (T04). Use it to exercise the full wallet flow in a browser:
 *
 *   connect → approval sheet → approve → account shown in the template card
 *   sign / send → approval sheet → signing → tx-result   (approve AND reject)
 *
 * Run with: pnpm dev   (http://localhost:5273)
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Simulator,
  createMockWallet,
  type AppSource,
  type RenderingBackend,
} from '../../src/index';
import { TemplateHome } from './template-home';

// One shared mock wallet: its bridge renders the approval sheet, its controller
// is the same instance the aliased @wallet-ui/react-native-kit drives.
const { bridge } = createMockWallet({ accountLabel: 'Seeker (Simulated)' });

const templateApp: AppSource = {
  kind: 'react-component',
  appKey: 'beeman-template',
  component: TemplateHome,
};

function App() {
  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <Simulator
        app={templateApp}
        wallet={bridge}
        scale={0.7}
        onReady={(backend: RenderingBackend) =>
          console.info(`[harness] backend "${backend.id}" mounted`, backend.getDevice())
        }
        onError={(error) => console.error('[harness] simulator error', error)}
      />
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        maxWidth: 280,
        color: '#cfcfd6',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
        paddingTop: 24,
      }}
    >
      <h2 style={{ color: '#fff', fontSize: 18, margin: '0 0 8px' }}>
        seeker-simulator
      </h2>
      <p style={{ margin: '0 0 12px', color: '#9a9aa3' }}>
        A real template app under react-native-web, with a mock Mobile Wallet
        Adapter.
      </p>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          Tap <strong>Connect</strong> → approve in the Seeker sheet → the card
          shows the authorized account.
        </li>
        <li>
          Use the dashed <strong>Simulator demo</strong> row to sign a message or
          send a (mock) transaction.
        </li>
        <li>Try the reject path — the app receives a user-rejection.</li>
      </ol>
      <p style={{ marginTop: 12, color: '#6f6f78', fontSize: 12 }}>
        No cluster · no real secrets · ephemeral keypair.
      </p>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('dev-harness: #root not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
