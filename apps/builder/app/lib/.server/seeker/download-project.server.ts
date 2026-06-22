import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GENERATED_DIR = fileURLToPath(new URL('../../../../../../generated/', import.meta.url));

export async function readProjectArchive(projectSlug: string) {
  const archivePath = path.join(GENERATED_DIR, `${projectSlug}.zip`);
  return readFile(archivePath);
}
