import { generateObject } from 'ai';
import { z } from 'zod';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { getAnthropicModel } from '~/lib/.server/llm/model';
import {
  ALLOWED_EDITABLE_FILES,
  PROGRAM_ARCHETYPES,
  SUPPORTED_PROGRAM_ARCHETYPES,
  TEMPLATE_NAME,
  type FileEditInstruction,
  type ProgramArchetype,
  type ProgramSpec,
  type ProjectPlan,
} from './shared';

const DEFAULT_TEMPLATE = TEMPLATE_NAME;

interface ExistingProjectSeed {
  projectName?: string;
  projectSlug?: string;
}

const planSchema = z.object({
  projectName: z.string().min(1),
  summary: z.string().min(1),
  appDescription: z.string().min(1),
  appTagline: z.string().min(1),
  initialScreens: z.array(z.string().min(1)).min(1).max(6),
  entities: z.array(z.string().min(1)).max(6).default([]),
  integrations: z.array(z.string().min(1)).min(1).max(6),
  newFiles: z
    .array(
      z.object({
        path: z.string().min(1),
        purpose: z.string().min(1),
        instruction: z.string().min(1),
      }),
    )
    .max(8)
    .default([]),
  dependencies: z
    .array(
      z.object({
        name: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .max(8)
    .default([]),
  program: z
    .object({
      needsProgram: z.boolean(),
      archetype: z.enum(PROGRAM_ARCHETYPES),
      state: z.object({
        name: z.string().min(1),
        field: z.string().min(1),
      }),
      accounts: z.array(z.string().min(1)).max(6).default([]),
      instructions: z.array(z.string().min(1)).min(1).max(6),
      rationale: z.string().min(1),
    })
    .optional(),
});

/** The model's raw program block, before normalization into a `ProgramSpec`. */
type PlanProgramDraft = NonNullable<z.infer<typeof planSchema>['program']>;

export async function createProjectPlan(
  env: Env,
  prompt: string,
  seed?: ExistingProjectSeed,
): Promise<ProjectPlan> {
  const normalizedPrompt = prompt.trim();
  const extractedName = seed?.projectName ?? extractProjectName(normalizedPrompt);
  const planDraft = await generateStructuredPlan(env, normalizedPrompt, extractedName);
  const projectName = seed?.projectName ?? planDraft.projectName;
  const projectSlug = seed?.projectSlug ?? slugify(projectName);

  return {
    prompt: normalizedPrompt,
    template: DEFAULT_TEMPLATE,
    projectName,
    projectSlug,
    summary: planDraft.summary,
    appDescription: ensurePeriod(planDraft.appDescription),
    appTagline: ensurePeriod(planDraft.appTagline),
    initialScreens: uniqueStrings(planDraft.initialScreens),
    entities: uniqueStrings(planDraft.entities),
    integrations: uniqueStrings(planDraft.integrations),
    newFiles: planDraft.newFiles,
    dependencies: planDraft.dependencies,
    filesToEdit: buildFileInstructions(projectName, ensurePeriod(planDraft.appDescription)),
    programSpec: normalizeProgramSpec(planDraft.program),
  };
}

/**
 * Turn the model's optional `program` block into a `ProgramSpec`, or `undefined`
 * for frontend-only apps. Backward compatible: when the model omits the block or
 * sets `needsProgram:false`, no `programSpec` is attached and the program-gen →
 * deploy pipeline stays a no-op. The archetype is clamped to the curated set
 * that actually has a compiling skeleton, so the plan can never point the
 * generator at an un-curated (free-form) program.
 */
function normalizeProgramSpec(program: PlanProgramDraft | undefined): ProgramSpec | undefined {
  if (!program || !program.needsProgram) {
    return undefined;
  }

  const archetype = clampArchetype(program.archetype);
  const instructions = uniqueStrings(program.instructions);

  return {
    needsProgram: true,
    archetype,
    state: {
      name: program.state.name.trim(),
      field: program.state.field.trim(),
    },
    accounts: uniqueStrings(program.accounts),
    instructions: instructions.length > 0 ? instructions : ['initialize', 'increment'],
    rationale: ensurePeriod(program.rationale),
  };
}

/** Clamp to a curated/buildable archetype; anything else falls back to counter. */
function clampArchetype(archetype: ProgramArchetype): ProgramArchetype {
  return (SUPPORTED_PROGRAM_ARCHETYPES as readonly ProgramArchetype[]).includes(archetype)
    ? archetype
    : 'counter';
}

export async function reviseProjectPlan(
  env: Env,
  currentPlan: ProjectPlan,
  feedback: string,
): Promise<ProjectPlan> {
  return createProjectPlan(env, `${currentPlan.prompt}\n\nRevision request: ${feedback}`, {
    projectName: currentPlan.projectName,
    projectSlug: currentPlan.projectSlug,
  });
}

function buildFileInstructions(projectName: string, appDescription: string): FileEditInstruction[] {
  return ALLOWED_EDITABLE_FILES.map((path) => ({
    path,
    instruction: `Customize ${path} for ${projectName}. Keep wallet connection intact and reflect: ${appDescription}`,
  }));
}

function extractProjectName(prompt: string): string | undefined {
  const patterns = [
    /called\s+([a-z0-9][\w-]*(?:\s+[a-z0-9][\w-]*){0,4}?)(?=\s+(?:with|for|that|using)\b|[.,]|$)/i,
    /named\s+([a-z0-9][\w-]*(?:\s+[a-z0-9][\w-]*){0,4}?)(?=\s+(?:with|for|that|using)\b|[.,]|$)/i,
    /chamad[oa]\s+([a-z0-9][\w-]*(?:\s+[a-z0-9][\w-]*){0,4}?)(?=\s+(?:com|para|que|using|with)\b|[.,]|$)/i,
    /^([a-z0-9][\w-]*(?:\s+[a-z0-9][\w-]*){0,2}?)(?=\s+(?:for|with|para|com)\b|[.,]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);

    if (match?.[1]) {
      return toTitleCase(match[1].trim().replace(/[.,]/g, ''));
    }
  }

  return undefined;
}

function extractDescription(prompt: string, projectName: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim();

  if (compact.length === 0) {
    return `${projectName} is a Solana mobile app with wallet connection and a focused mobile-first home screen.`;
  }

  return compact.endsWith('.') ? compact : `${compact}.`;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function generateStructuredPlan(
  env: Env,
  prompt: string,
  suggestedName?: string,
) {
  const { object } = await generateObject({
    model: getAnthropicModel(getAPIKey(env)),
    schema: planSchema,
    temperature: 0.2,
    system: [
      'You create project plans for a Solana mobile app builder.',
      'Return only a structured plan that stays within the kit-expo-minimal starter template (a flat, single Expo app on @solana/kit + @wallet-ui/react-native-kit; no backend, no companion web app).',
      'Do not promise features that require breaking the starter architecture.',
      'Prefer realistic first-version scopes.',
      'Keep initialScreens and integrations concise and useful.',
      'If the prompt is vague, still produce a credible mobile-first plan.',
      'projectName must be a clean product name, not a sentence.',
      'projectName must be based on the user request and app idea. Do not use generic defaults like "Seeker Pay" unless the prompt is explicitly about that exact name or a very close payment product concept.',
      'newFiles should usually be empty for MVP unless the prompt clearly asks for a dedicated feature surface.',
      'Decide whether the app needs its own on-chain Solana program (the "program" field). Base this on the entities and on whether the prompt implies shared, persisted on-chain state or counters/records the app must read and write.',
      'Most prompts do NOT need a custom program (wallet login, balance display, transfers, links to existing protocols). For those, omit the "program" field entirely or set needsProgram:false.',
      `Only add a program when on-chain logic is clearly required. When you do, set needsProgram:true and pick the closest archetype from this curated set: ${SUPPORTED_PROGRAM_ARCHETYPES.join(', ')} (the only archetypes available today; reserved-but-unbuilt: ${PROGRAM_ARCHETYPES.filter((a) => !(SUPPORTED_PROGRAM_ARCHETYPES as readonly string[]).includes(a)).join(', ')}).`,
      'The "counter" archetype is a per-user PDA account holding a single numeric value with initialize + increment instructions — use it for tallies, streaks, points, check-ins, vote counts, and similar single-value on-chain state.',
      'For the program: state.name is a PascalCase account name, state.field is the snake_case stored value, instructions are snake_case names, accounts lists the human-readable roles, rationale is one user-facing sentence. Do NOT write any Rust.',
    ].join('\n'),
    prompt: [
      `User prompt: ${prompt}`,
      suggestedName ? `Suggested project name: ${suggestedName}` : 'Suggested project name: infer one from the app idea in the prompt.',
      `Template: ${DEFAULT_TEMPLATE}`,
      'The project must preserve wallet connection and the starter structure (Expo Router app, account + network features).',
      'Decide entities first, then use them to decide whether an on-chain program is needed.',
      'Generate a product plan for user review before code generation.',
    ].join('\n'),
  });

  return object;
}

function ensurePeriod(value: string) {
  const normalized = value.trim();
  return normalized.endsWith('.') ? normalized : `${normalized}.`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
