import { generateObject } from 'ai';
import { z } from 'zod';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { getAnthropicModel } from '~/lib/.server/llm/model';
import {
  ALLOWED_EDITABLE_FILES,
  type EditableFilePath,
  type ProjectPlan,
} from './shared';
import { WALLET_CONTRACT } from './template-contract';

const fileSchema = z.object({
  content: z.string().min(1),
});

export async function generateCustomizedFiles(
  env: Env,
  plan: ProjectPlan,
  editableFiles: Record<EditableFilePath, string>,
): Promise<Record<EditableFilePath, string>> {
  const entries = await Promise.all(
    ALLOWED_EDITABLE_FILES.map(async (filePath) => {
      const content = await generateFileContent(env, plan, filePath, editableFiles[filePath]);
      return [filePath, content] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<EditableFilePath, string>;
}

async function generateFileContent(
  env: Env,
  plan: ProjectPlan,
  filePath: EditableFilePath,
  currentContent: string,
) {
  const { object } = await generateObject({
    model: getAnthropicModel(getAPIKey(env)),
    schema: fileSchema,
    temperature: 0.2,
    system: buildSystemPrompt(filePath),
    prompt: buildUserPrompt(plan, filePath, currentContent),
  });

  return object.content;
}

/**
 * The wallet/Solana contract (shared with the edit path) plus the constraint
 * unique to this path: the customizer can only edit a fixed allowlist of files
 * and cannot create new ones, so any new import/route would dangle.
 */
const MOBILE_TEMPLATE_CONTRACT = [
  WALLET_CONTRACT,
  '- Only import modules that already exist in the template. You can edit ONLY a fixed allowlist of files and cannot create new ones, so do NOT introduce an import, screen, or route that depends on a file you are not editing here — it would dangle and break the build.',
].join('\n');

const MOBILE_FILES: EditableFilePath[] = [
  'app/index.tsx',
  'app/_layout.tsx',
];

function buildSystemPrompt(filePath: EditableFilePath) {
  return [
    'You are customizing one file of a kit-expo-minimal Solana app (a flat, single Expo app).',
    `Target file: ${filePath}`,
    'Always use the provided file as the base.',
    'Preserve working imports, framework conventions, and overall file structure unless the user request requires a focused change.',
    'Return the full updated file content only via the schema field.',
    'Do not wrap the content in markdown fences.',
    'Do not invent new files.',
    'Keep the app based on the original kit-expo-minimal template.',
    MOBILE_FILES.includes(filePath) ? MOBILE_TEMPLATE_CONTRACT : '',
    filePath === 'app/index.tsx'
      ? 'Keep the file as a valid Expo Router screen component (a default-exported React component). Do NOT register navigation routes here. If the screen renders `<CounterFeatureIndex />` (from `@/features/counter/counter-feature-index`), KEEP it on the home screen — it is how this app calls its deployed Solana program. Style with React Native `StyleSheet` / `appStyles` from `@/constants/app-styles`, not NativeWind/`className`.'
      : '',
    filePath === 'app/_layout.tsx'
      ? 'Keep the file as a valid Expo Router layout and preserve the provider structure (it wraps `AppProviders` from `@/components/app-providers`). Only register `Stack.Screen`s whose route files already exist — you cannot create new screen files, so do not add a route for a screen that is not already present.'
      : '',
    filePath === 'constants/app-config.ts'
      ? 'Keep the file as a valid TypeScript module exporting the `AppConfig` class. Preserve the `identity` and `networks` shape and the `@wallet-ui/react-native-kit` cluster factories; only adjust values (e.g. identity name) to match the app.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUserPrompt(
  plan: ProjectPlan,
  filePath: EditableFilePath,
  currentContent: string,
) {
  return [
    `User request: ${plan.prompt}`,
    `App name: ${plan.projectName}`,
    `App slug: ${plan.projectSlug}`,
    `App description: ${plan.appDescription}`,
    `App tagline: ${plan.appTagline}`,
    `Current file path: ${filePath}`,
    '',
    'Use this current file as the source template:',
    `<file path="${filePath}">`,
    currentContent,
    '</file>',
    '',
    'Rewrite this file so it reflects the user request while staying based on the provided template.',
  ].join('\n');
}
