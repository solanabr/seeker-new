import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { readProjectArchive } from '~/lib/.server/seeker/download-project.server';

export async function loader({ params }: LoaderFunctionArgs) {
  const projectSlug = params.projectSlug;

  if (!projectSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug)) {
    return new Response('Invalid project slug', { status: 400 });
  }

  try {
    const archive = await readProjectArchive(projectSlug);

    return new Response(archive, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${projectSlug}.zip"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[download] failed to read archive', { projectSlug, error });

    return new Response('Project archive not found', { status: 404 });
  }
}
