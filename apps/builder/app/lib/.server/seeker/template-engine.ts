import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  WORKBENCH_VISIBLE_FILES,
  type CreateProjectFromTemplateInput,
  type GeneratedProjectFile,
  type GeneratedProjectResult,
  type EditableFilePath,
  type ProjectPlan,
} from './shared';

const ROOT_DIR = fileURLToPath(new URL('../../../../../../', import.meta.url));
const TEMPLATE_DIR = fileURLToPath(new URL('../../../../../../apps/templates/kit-expo-minimal/', import.meta.url));
const GENERATED_DIR = fileURLToPath(new URL('../../../../../../generated/', import.meta.url));
// The simulator package, now living inside this monorepo at packages/simulator.
// Its `src` + `preset` are copied into each generated project's `preview/sim` so
// the preview runs self-contained in the WebContainer (it can't reach a host
// file: dep from inside the container).
const SIMULATOR_DIR = join(ROOT_DIR, 'packages', 'simulator');

export function getProjectDir(projectSlug: string) {
  return `${GENERATED_DIR}/${projectSlug}`;
}

export function projectExists(projectSlug: string) {
  return existsSync(getProjectDir(projectSlug));
}

export async function createProjectFromTemplate(
  input: CreateProjectFromTemplateInput,
  plan: ProjectPlan,
): Promise<GeneratedProjectResult & { editableFiles: Record<EditableFilePath, string> }> {
  const projectSlug = slugify(input.name);
  const projectDir = getProjectDir(projectSlug);

  await mkdir(GENERATED_DIR, { recursive: true });
  await rm(projectDir, { recursive: true, force: true });
  await cp(TEMPLATE_DIR, projectDir, {
    recursive: true,
    filter: (source) => !shouldSkipPath(source),
  });

  await applyBaseAppRename(projectDir, plan);
  await vendorSimulatorPreview(projectDir);

  const editableFiles = await readEditableFiles(projectDir);
  const files = await collectWorkbenchFiles(projectDir);
  const archivePath = await refreshProjectArchive(projectSlug);

  return {
    projectName: plan.projectName,
    projectSlug,
    projectDescription: plan.appDescription,
    projectDir,
    archivePath,
    editableFiles,
    files,
  };
}

async function applyBaseAppRename(projectDir: string, plan: ProjectPlan) {
  // kit-expo-minimal is a single, flat Expo app (no apps/mobile|web|api, no
  // packages/auth, no workspace). Renaming touches three root-level files.
  const rootPackageJsonPath = `${projectDir}/package.json`;
  const appJsonPath = `${projectDir}/app.json`;
  const appConfigPath = `${projectDir}/constants/app-config.ts`;

  const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, 'utf8'));
  rootPackageJson.name = plan.projectSlug;
  await writeJson(rootPackageJsonPath, rootPackageJson);

  const appJson = JSON.parse(await readFile(appJsonPath, 'utf8'));
  appJson.expo = {
    ...appJson.expo,
    name: plan.projectName,
    slug: plan.projectSlug,
    scheme: plan.projectSlug,
  };
  await writeJson(appJsonPath, appJson);

  // The home screen reads its display name from AppConfig.identity. Swap the
  // template's `{ name: 'kit-expo' }` for the generated project's name.
  const appConfig = await readFile(appConfigPath, 'utf8');
  await writeFile(
    appConfigPath,
    appConfig.replace(
      /static identity: AppIdentity = \{\s*name:\s*'[^']*'\s*\}/,
      `static identity: AppIdentity = { name: '${escapeSingleQuotes(plan.projectName)}' }`,
    ),
  );
}

/**
 * Copy the standalone simulator's `src` + `preset` into `<project>/preview/sim`
 * so the generated project's `preview/` runs self-contained in the WebContainer.
 * The generic preview config (package.json / vite.config / main.tsx / index.html)
 * ships with the template; only the simulator source is vendored here, from the
 * live repo, so there is a single source of truth.
 */
async function vendorSimulatorPreview(projectDir: string) {
  const simSrc = join(SIMULATOR_DIR, 'src');
  const simPreset = join(SIMULATOR_DIR, 'preset');

  if (!existsSync(simSrc) || !existsSync(simPreset)) {
    throw new Error(
      `seeker-simulator not found at ${SIMULATOR_DIR} (need its src + preset to build the preview). ` +
        'Expected the simulator package at packages/simulator inside this monorepo.',
    );
  }

  const destSim = `${projectDir}/preview/sim`;
  await cp(simSrc, `${destSim}/src`, { recursive: true, filter: (source) => !shouldSkipPath(source) });
  await cp(simPreset, `${destSim}/preset`, { recursive: true, filter: (source) => !shouldSkipPath(source) });
}

async function collectWorkbenchFiles(projectDir: string): Promise<GeneratedProjectFile[]> {
  const rootPackageJson = JSON.parse(await readFile(`${projectDir}/package.json`, 'utf8'));
  const catalog = rootPackageJson.workspaces?.catalog ?? {};
  const workspacePackages = Array.isArray(rootPackageJson.workspaces)
    ? rootPackageJson.workspaces
    : (rootPackageJson.workspaces?.packages ?? []);

  const filePaths = await collectTextFilePaths(projectDir);
  const files = await Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      content: transformWorkbenchFile(filePath, await readFile(`${projectDir}/${filePath}`, 'utf8'), catalog, workspacePackages),
    })),
  );

  // Only a monorepo template needs a pnpm workspace manifest. kit-expo-minimal is
  // a single flat package, so there are no workspace packages and no manifest.
  if (workspacePackages.length > 0) {
    files.push({
      path: 'pnpm-workspace.yaml',
      content: buildPnpmWorkspaceYaml(workspacePackages),
    });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function readEditableFiles(projectDir: string): Promise<Record<EditableFilePath, string>> {
  return {
    'README.md': await readFile(`${projectDir}/README.md`, 'utf8'),
    'app/index.tsx': await readFile(`${projectDir}/app/index.tsx`, 'utf8'),
    'app/_layout.tsx': await readFile(`${projectDir}/app/_layout.tsx`, 'utf8'),
    'constants/app-config.ts': await readFile(`${projectDir}/constants/app-config.ts`, 'utf8'),
  };
}

export async function writeEditableFiles(
  projectDir: string,
  editableFiles: Record<EditableFilePath, string>,
) {
  await writeFile(`${projectDir}/README.md`, editableFiles['README.md']);
  await writeFile(`${projectDir}/app/index.tsx`, editableFiles['app/index.tsx']);
  await writeFile(`${projectDir}/app/_layout.tsx`, editableFiles['app/_layout.tsx']);
  await writeFile(`${projectDir}/constants/app-config.ts`, editableFiles['constants/app-config.ts']);
}

export async function refreshWorkbenchFiles(projectDir: string) {
  return collectWorkbenchFiles(projectDir);
}

async function createArchive(projectSlug: string): Promise<string | undefined> {
  const archivePath = `${GENERATED_DIR}/${projectSlug}.zip`;
  await rm(archivePath, { force: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('zip', ['-qr', archivePath, projectSlug], {
        cwd: GENERATED_DIR,
        stdio: 'ignore',
      });

      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`zip exited with code ${code}`));
      });
    });

    return archivePath;
  } catch {
    return undefined;
  }
}

export async function refreshProjectArchive(projectSlug: string) {
  return createArchive(projectSlug);
}

export interface InjectProgramInput {
  /** Deployed program address to wire into the app config. */
  programId: string;
  /**
   * Freshly generated `@solana/kit` client directory (the ship pipeline's client
   * artifact). When provided it replaces the app's bundled program client so the
   * app calls exactly the program that was just deployed.
   */
  clientDir?: string;
}

/**
 * Wire a deployed program into a generated app: point `constants/program-config`
 * at the deployed program ID and (when provided) refresh the bundled program
 * client with the freshly generated one. This is what closes the loop after the
 * rails deploy — the generated app then calls the program that was just shipped.
 */
export async function injectProgram(projectSlug: string, input: InjectProgramInput): Promise<void> {
  const projectDir = getProjectDir(projectSlug);

  const programConfigPath = `${projectDir}/constants/program-config.ts`;
  if (existsSync(programConfigPath)) {
    const config = await readFile(programConfigPath, 'utf8');
    await writeFile(
      programConfigPath,
      config.replace(/programId:\s*'[^']*'/, `programId: '${input.programId}'`),
    );
  }

  if (input.clientDir && existsSync(input.clientDir)) {
    const dest = `${projectDir}/features/counter/program-client`;
    await rm(dest, { recursive: true, force: true });
    await cp(input.clientDir, dest, {
      recursive: true,
      filter: (source) => !shouldSkipPath(source),
    });
  }

  await refreshProjectArchive(projectSlug);
}


function shouldSkipPath(source: string): boolean {
  const segments = source.split('/').filter(Boolean);
  const name = segments[segments.length - 1];
  return ['.git', '.github', '.ruler', 'node_modules', '.turbo', '.expo', 'dist', 'build', 'android', 'ios'].includes(name);
}

async function collectTextFilePaths(projectDir: string, relativeDir = ''): Promise<string[]> {
  const currentDir = relativeDir ? `${projectDir}/${relativeDir}` : projectDir;
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (shouldSkipPath(entry.name)) {
      continue;
    }

    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await collectTextFilePaths(projectDir, relativePath)));
      continue;
    }

    if (shouldSkipWorkbenchFile(relativePath)) {
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

function shouldSkipWorkbenchFile(filePath: string) {
  const extension = getFileExtension(filePath);

  return [
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.zip',
    '.lockb',
  ].includes(extension) || filePath === 'bun.lock';
}

function transformWorkbenchFile(
  filePath: string,
  content: string,
  catalog: Record<string, string>,
  workspacePackages: string[],
) {
  if (!filePath.endsWith('package.json')) {
    return content;
  }

  const packageJson = JSON.parse(content);

  for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    if (packageJson[key]) {
      packageJson[key] = replaceCatalogVersions(packageJson[key], catalog);
    }
  }

  // Only rewrite workspace metadata for a monorepo template. The flat kit-expo
  // app keeps its own npm/expo package.json untouched.
  if (filePath === 'package.json' && workspacePackages.length > 0) {
    packageJson.packageManager = 'pnpm@9.15.9';
    packageJson.workspaces = workspacePackages;
  }

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function replaceCatalogVersions(
  dependencies: Record<string, string>,
  catalog: Record<string, string>,
) {
  return Object.fromEntries(
    Object.entries(dependencies).map(([name, version]) => {
      if (version !== 'catalog:') {
        return [name, version];
      }

      return [name, catalog[name] ?? 'latest'];
    }),
  );
}

function buildPnpmWorkspaceYaml(workspacePackages: string[]) {
  const packageLines = workspacePackages.map((item) => `  - '${item}'`);
  return `packages:\n${packageLines.join('\n')}\n`;
}

function getFileExtension(filePath: string) {
  const lastDotIndex = filePath.lastIndexOf('.');

  if (lastDotIndex === -1) {
    return '';
  }

  return filePath.slice(lastDotIndex).toLowerCase();
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

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
