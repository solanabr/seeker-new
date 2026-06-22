export const TEMPLATE_NAME = 'kit-expo-minimal' as const;

export const ALLOWED_EDITABLE_FILES = [
  'README.md',
  'app/index.tsx',
  'app/_layout.tsx',
  'constants/app-config.ts',
] as const;

export const WORKBENCH_VISIBLE_FILES = [
  'package.json',
  'README.md',
  'app.json',
  'app/index.tsx',
  'app/_layout.tsx',
  'components/app-providers.tsx',
  'constants/app-config.ts',
] as const;

export type TemplateName = typeof TEMPLATE_NAME;
export type EditableFilePath = (typeof ALLOWED_EDITABLE_FILES)[number];

/**
 * Curated on-chain program archetypes the plan may select. Generation is
 * constrained to this set — the program is never free-form Rust, only a
 * known-good Anchor skeleton with spec-driven identifier slots filled in.
 *
 * KEEP IN SYNC with the rails archetype library
 * (`packages/rails/archetypes/` + `@seeker/rails` `renderArchetype`). Only
 * archetypes also present in `SUPPORTED_PROGRAM_ARCHETYPES` are actually
 * curated/buildable today; the rest are reserved slots so the schema is
 * forward-compatible as the library grows.
 */
export const PROGRAM_ARCHETYPES = ['counter', 'spl-token-mint', 'escrow', 'vote'] as const;

/** Archetypes with a curated, compiling skeleton in the rails library today. */
export const SUPPORTED_PROGRAM_ARCHETYPES = ['counter'] as const;

export type ProgramArchetype = (typeof PROGRAM_ARCHETYPES)[number];
export type SupportedProgramArchetype = (typeof SUPPORTED_PROGRAM_ARCHETYPES)[number];

/**
 * Optional on-chain program description carried by the plan. When
 * `needsProgram` is false the whole program-gen → deploy pipeline is a no-op
 * (the default for prompts with no on-chain logic), so this stays fully
 * backward compatible with frontend-only generation.
 *
 * Fields other than `needsProgram`/`archetype` are *identifier slots* the
 * deterministic renderer substitutes into the fixed archetype skeleton — names
 * only, never code.
 */
export interface ProgramSpec {
  /** Whether the app needs a deployed Solana program at all. */
  needsProgram: boolean;
  /** Which curated archetype to customize. */
  archetype: ProgramArchetype;
  /** The on-chain account this program reads/writes (a PDA). */
  state: {
    /** PascalCase account struct name, e.g. `Tally`. */
    name: string;
    /** snake_case field that holds the stored value, e.g. `count`. */
    field: string;
  };
  /** Human-readable account roles involved (informational; for the plan card). */
  accounts: string[];
  /** snake_case instruction names, e.g. `["initialize", "increment"]`. */
  instructions: string[];
  /** One-line, user-facing reason this archetype fits the app (for the card). */
  rationale: string;
}

export interface FileEditInstruction {
  path: EditableFilePath;
  instruction: string;
}

export interface ProjectPlan {
  prompt: string;
  template: TemplateName;
  projectName: string;
  projectSlug: string;
  summary: string;
  appDescription: string;
  appTagline: string;
  initialScreens: string[];
  entities: string[];
  integrations: string[];
  /**
   * Optional on-chain program plan. Present only when the prompt implies
   * on-chain logic; omitted (or `needsProgram:false`) leaves generation
   * frontend-only and unchanged.
   */
  programSpec?: ProgramSpec;
  newFiles: Array<{
    path: string;
    purpose: string;
    instruction: string;
  }>;
  dependencies: Array<{
    name: string;
    reason: string;
  }>;
  filesToEdit: FileEditInstruction[];
}

export interface ProjectCustomization {
  projectName: string;
  appDescription: string;
  appTagline: string;
  files: Record<EditableFilePath, string>;
}

export interface CreateProjectFromTemplateInput {
  name: string;
  description: string;
  template: TemplateName;
}

export interface GeneratedProjectFile {
  path: string;
  content: string;
}

export interface GeneratedProjectResult {
  projectName: string;
  projectSlug: string;
  projectDescription: string;
  projectDir: string;
  archivePath?: string;
  files: GeneratedProjectFile[];
}
