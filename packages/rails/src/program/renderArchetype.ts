/**
 * Deterministic archetype renderer — the "no free-form Rust" safety rail.
 *
 * Given a curated archetype key and a small set of identifier slots (sourced
 * from the plan's `programSpec`), this materializes a buildable Anchor workspace
 * by copying the committed skeleton and substituting ONLY validated identifiers
 * into `lib.rs`. The model never emits Rust; the structure of every generated
 * program is exactly the structure committed under `archetypes/`.
 *
 * Safety properties:
 * - Every substituted identifier is sanitized to a strict Rust identifier; any
 *   value that fails validation falls back to the archetype default.
 * - The only model-influenced text that reaches the source is identifiers; the
 *   fixed `#[msg("…")]` strings live in the skeleton, not the spec.
 * - Unknown / un-curated archetypes throw; there is no arbitrary-source path.
 *
 * Pure Node/TS, zero npm dependencies — keeps `@seeker/rails` headless and
 * standalone-extractable.
 */

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Root of the committed archetype library. */
export const ARCHETYPES_DIR = resolve(PACKAGE_ROOT, 'archetypes');

/**
 * Archetypes with a curated, compiling skeleton today. KEEP IN SYNC with the
 * builder's `SUPPORTED_PROGRAM_ARCHETYPES` (the plan schema clamps to this set).
 */
export const RAILS_PROGRAM_ARCHETYPES = ['counter'] as const;
export type RailsProgramArchetype = (typeof RAILS_PROGRAM_ARCHETYPES)[number];

/** The fixed Anchor artifact / crate name shared by every generated program. */
export const PROGRAM_ARTIFACT = 'seeker_program';

/**
 * Identifier slots the renderer fills. Structurally compatible with the
 * builder's `ProgramSpec` (rails never imports builder — standalone hygiene).
 */
export interface ArchetypeRenderSpec {
  archetype: string;
  state: { name: string; field: string };
  instructions: string[];
}

export interface RenderIdentifiers {
  stateStruct: string;
  stateField: string;
  seedLabel: string;
  errorEnum: string;
  initInstruction: string;
  incrementInstruction: string;
}

export interface RenderResult {
  /** The materialized Anchor workspace (ready for `deploy({ fixtureDir })`). */
  workspaceDir: string;
  /** Fixed Anchor artifact name (program keypair / `.so` / IDL stem). */
  programArtifact: string;
  /** Path to the rendered `lib.rs`. */
  libRsPath: string;
  /** The exact identifiers substituted (after sanitization). */
  identifiers: RenderIdentifiers;
}

// Rust keywords (2015 + 2018 + reserved) — never allowed as generated idents.
const RUST_KEYWORDS = new Set([
  'as', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern',
  'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move',
  'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super',
  'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while', 'async', 'await',
  'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv', 'try',
  'typeof', 'unsized', 'virtual', 'yield', 'union',
]);

// Field names already present in the fixed account struct — a generated field
// must not collide with these or the struct won't compile.
const RESERVED_FIELDS = new Set(['authority', 'bump']);

function isValidSnake(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value) && !RUST_KEYWORDS.has(value);
}

/** Coerce arbitrary text to a snake_case Rust identifier, or '' if impossible. */
function toSnake(value: string): string {
  const snake = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/^_+|_+$/g, '');
  return isValidSnake(snake) ? snake : '';
}

/** Coerce arbitrary text to a PascalCase Rust type name, or '' if impossible. */
function toPascal(value: string): string {
  const pascal = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
    .replace(/^[^A-Za-z]+/, '');
  const valid = /^[A-Za-z][A-Za-z0-9]*$/.test(pascal) && !RUST_KEYWORDS.has(pascal);
  return valid ? pascal : '';
}

/** Resolve the final, sanitized identifier set from the spec (with fallbacks). */
function resolveIdentifiers(spec: ArchetypeRenderSpec): RenderIdentifiers {
  const stateStruct = toPascal(spec.state?.name ?? '') || 'Counter';

  let stateField = toSnake(spec.state?.field ?? '') || 'count';
  if (RESERVED_FIELDS.has(stateField)) {
    stateField = 'count';
  }

  const initInstruction = toSnake(spec.instructions?.[0] ?? '') || 'initialize';
  let incrementInstruction = toSnake(spec.instructions?.[1] ?? '') || 'increment';
  if (incrementInstruction === initInstruction) {
    incrementInstruction = initInstruction === 'increment' ? 'bump' : 'increment';
  }

  const seedLabel = toSnake(stateStruct) || 'counter';
  const errorEnum = `${stateStruct}Error`;

  return { stateStruct, stateField, seedLabel, errorEnum, initInstruction, incrementInstruction };
}

const SLOT_TOKENS: Record<string, keyof RenderIdentifiers> = {
  '{{STATE_STRUCT}}': 'stateStruct',
  '{{STATE_FIELD}}': 'stateField',
  '{{SEED_LABEL}}': 'seedLabel',
  '{{ERROR_ENUM}}': 'errorEnum',
  '{{INIT_IX}}': 'initInstruction',
  '{{INCREMENT_IX}}': 'incrementInstruction',
};

function renderTemplate(template: string, ids: RenderIdentifiers): string {
  let out = template;
  for (const [token, key] of Object.entries(SLOT_TOKENS)) {
    out = out.split(token).join(ids[key]);
  }
  const leftover = out.match(/\{\{[A-Z_]+\}\}/);
  if (leftover) {
    throw new Error(`Unsubstituted archetype slot ${leftover[0]} — refusing to emit Rust.`);
  }
  return out;
}

function assertSupported(archetype: string): RailsProgramArchetype {
  if ((RAILS_PROGRAM_ARCHETYPES as readonly string[]).includes(archetype)) {
    return archetype as RailsProgramArchetype;
  }
  throw new Error(
    `Archetype "${archetype}" is not curated. Supported: ${RAILS_PROGRAM_ARCHETYPES.join(', ')}.`,
  );
}

/**
 * Materialize a buildable Anchor workspace for `spec.archetype` into `destDir`.
 * Copies the committed skeleton (excluding the `.tmpl` source and any build
 * output), then renders `lib.rs` from validated identifier slots.
 */
export function renderArchetype(spec: ArchetypeRenderSpec, destDir: string): RenderResult {
  const archetype = assertSupported(spec.archetype);
  const srcDir = resolve(ARCHETYPES_DIR, archetype);
  if (!existsSync(srcDir)) {
    throw new Error(`Archetype assets not found at ${srcDir}`);
  }

  const ids = resolveIdentifiers(spec);

  // 1) Copy the pristine skeleton, skipping the template source and any
  //    accidental build/install artifacts.
  cpSync(srcDir, destDir, {
    recursive: true,
    filter: (source) => {
      const base = source.split('/').pop() ?? '';
      if (base === 'node_modules' || base === 'target' || base === '.anchor') return false;
      if (base.endsWith('.tmpl')) return false;
      return true;
    },
  });

  // 2) Render lib.rs from the tokenized skeleton into the copied workspace.
  const templatePath = resolve(srcDir, 'programs', PROGRAM_ARTIFACT, 'src', 'lib.rs.tmpl');
  const template = readFileSync(templatePath, 'utf8');
  const libRsPath = resolve(destDir, 'programs', PROGRAM_ARTIFACT, 'src', 'lib.rs');
  writeFileSync(libRsPath, renderTemplate(template, ids), 'utf8');

  // Defensive: ensure no stray template leaked into the output workspace.
  const strayTmpl = resolve(destDir, 'programs', PROGRAM_ARTIFACT, 'src', 'lib.rs.tmpl');
  if (existsSync(strayTmpl)) rmSync(strayTmpl);

  return { workspaceDir: destDir, programArtifact: PROGRAM_ARTIFACT, libRsPath, identifiers: ids };
}
