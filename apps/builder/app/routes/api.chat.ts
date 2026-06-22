import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { resolveServerProviderConfig, ProviderConfigError } from '~/lib/.server/llm/resolve-provider-config';
import type { ProviderConfig } from '~/lib/.server/llm/provider';
import type { ProviderPreference } from '~/lib/provider-preference';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { createProjectPlan, reviseProjectPlan } from '~/lib/.server/seeker/ai-orchestrator';
import { generateCustomizedFiles } from '~/lib/.server/seeker/claude-customizer';
import { getSeekerEditPrompt } from '~/lib/.server/seeker/edit-prompt';
import {
  createProjectFromTemplate,
  getProjectDir,
  projectExists,
  readEditableFiles,
  refreshProjectArchive,
  refreshWorkbenchFiles,
  writeEditableFiles,
} from '~/lib/.server/seeker/template-engine';
import type { ProjectPlan } from '~/lib/.server/seeker/shared';
import {
  isPlanConfirmation,
  parsePlanMessage,
  renderPlanReview,
} from '~/lib/seeker-plan';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  try {
    const { messages, providerConfig: preference } = await request.json<{
      messages: Messages;
      providerConfig?: ProviderPreference;
    }>();
    const latestPrompt = getLatestUserPrompt(messages);

    if (!latestPrompt) {
      return new Response('Send a prompt that describes the app you want to generate.', {
        status: 400,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
        },
      });
    }

    // Resolve the chosen provider for this turn (byok key from session,
    // agent-runtime path re-resolved server-side). cloud → undefined (managed key).
    let providerConfig: ProviderConfig | undefined;
    try {
      providerConfig = await resolveServerProviderConfig(request, preference);
    } catch (error) {
      if (error instanceof ProviderConfigError) {
        return streamTextMessage(error.message);
      }
      throw error;
    }

    const existingProject = getExistingProject(messages);
    const existingPlan = getLatestAssistantPlan(messages);

    if (existingProject && projectExists(existingProject.projectSlug)) {
      return streamProjectEdits(messages, context.cloudflare.env, existingProject, providerConfig);
    }

    // The plan/scaffold/customize steps below currently run on the managed key
    // (Sprint 5 scope: only the streaming generation turn honors the chosen
    // provider). On a self-host install with no managed key, surface that the
    // chosen provider drives edits — the first scaffold needs the hosted key.
    if (providerConfig && providerConfig.mode !== 'cloud' && !hasManagedKey(context.cloudflare.env)) {
      return streamTextMessage(
        'Your selected provider runs the build/edit turns. Creating a brand-new project from scratch still needs the hosted key for planning — add ANTHROPIC_API_KEY, or open an existing project and iterate on it with your provider.',
      );
    }

    if (existingPlan && !isPlanConfirmation(latestPrompt)) {
      const revisedPlan = await reviseProjectPlan(context.cloudflare.env, existingPlan, latestPrompt);
      return streamTextMessage(renderPlanReview(revisedPlan));
    }

    if (!existingPlan) {
      const draftPlan = await createProjectPlan(context.cloudflare.env, latestPrompt, existingProject ?? undefined);
      return streamTextMessage(renderPlanReview(draftPlan));
    }

    const plan = existingPlan;

    const project = existingProject && projectExists(existingProject.projectSlug)
      ? {
          projectName: existingProject.projectName,
          projectSlug: existingProject.projectSlug,
          projectDescription: plan.appDescription,
          projectDir: getProjectDir(existingProject.projectSlug),
          archivePath: await refreshProjectArchive(existingProject.projectSlug),
          editableFiles: await readEditableFiles(getProjectDir(existingProject.projectSlug)),
          files: await refreshWorkbenchFiles(getProjectDir(existingProject.projectSlug)),
        }
      : await createProjectFromTemplate(
          {
            name: plan.projectName,
            description: plan.appDescription,
            template: plan.template,
          },
          plan,
        );

    const customizedFiles = await generateCustomizedFiles(context.cloudflare.env, plan, project.editableFiles);

    await writeEditableFiles(project.projectDir, customizedFiles);
    const files = await refreshWorkbenchFiles(project.projectDir);
    const archivePath = await refreshProjectArchive(project.projectSlug);
    return streamWorkbenchArtifact(
      project.projectName,
      project.projectSlug,
      project.files,
      Object.entries(customizedFiles).map(([path, content]) => ({ path, content })),
      archivePath,
      {
        bootstrapPreview: true,
      },
    );
  } catch (error) {
    console.error(error);

    return new Response('Failed to generate project.', {
      status: 500,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }
}

async function streamProjectEdits(
  messages: Messages,
  env: Env,
  existingProject: { projectName: string; projectSlug: string },
  providerConfig?: ProviderConfig,
) {
  const stream = new SwitchableStream();

  // The multi-segment continuation loop (onFinish → switchSource) is an AI-SDK
  // concern: the SDK stops at maxTokens and we resume. agent-runtime returns the
  // whole turn in one shot (T01 GO/NO-GO §3.2), so the loop is naturally a no-op
  // there — its data stream never invokes onFinish.
  const options: StreamingOptions = {
    toolChoice: 'none',
    system: getSeekerEditPrompt(existingProject.projectName, existingProject.projectSlug),
    onFinish: async ({ text: content, finishReason }) => {
      if (finishReason !== 'length') {
        return stream.close();
      }

      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw Error('Cannot continue message: Maximum segments reached');
      }

      const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

      console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: CONTINUE_PROMPT });

      const result = await streamText(messages, env, options, providerConfig);
      return stream.switchSource(result.toAIStream());
    },
  };

  const result = await streamText(messages, env, options, providerConfig);
  stream.switchSource(result.toAIStream());

  return new Response(stream.readable, {
    status: 200,
    headers: {
      contentType: 'text/plain; charset=utf-8',
    },
  });
}

/** Whether a managed (hosted) Anthropic key is configured in this environment. */
function hasManagedKey(env: Env): boolean {
  return Boolean(getAPIKey(env));
}

function getLatestUserPrompt(messages: Array<{ role: string; content: string }>): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');

  if (!latestUserMessage) {
    return '';
  }

  return latestUserMessage.content.replace(/<bolt_file_modifications[\s\S]*?<\/bolt_file_modifications>/g, '').trim();
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function escapeActionContent(value: string): string {
  return value.replace(/<\/boltAction>/g, '<\\/boltAction>');
}

function formatDataStreamPart(type: 'text' | 'finish_message', value: unknown): string {
  const prefix = type === 'text' ? '0' : 'd';
  return `${prefix}:${JSON.stringify(value)}\n`;
}

function streamWorkbenchArtifact(
  projectName: string,
  projectSlug: string,
  scaffoldFiles: Array<{ path: string; content: string }>,
  additionalFiles: Array<{ path: string; content: string }>,
  _archivePath?: string,
  options?: {
    bootstrapPreview?: boolean;
  },
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const chunks = [
        `<boltArtifact id="${projectSlug}" title="${escapeAttribute(projectName)} workspace" downloadUrl="${escapeAttribute(
          `/api/download/${projectSlug}`,
        )}">`,
        `<boltAction type="scaffold" summary="Create starter from template">${escapeActionContent(
          JSON.stringify(scaffoldFiles),
        )}</boltAction>`,
        ...additionalFiles.map(
          (file) =>
            `<boltAction type="file" filePath="${escapeAttribute(file.path)}">${escapeActionContent(file.content)}</boltAction>`,
        ),
        ...(options?.bootstrapPreview
          ? [
              // Run the self-contained Seeker preview (a react-native-web build of
              // the generated app + the mock wallet) and serve it. The builder's
              // preview pane frames the resulting URL in the device frame. Each
              // shell action runs in a fresh shell, so each must `cd preview`.
              '<boltAction type="shell" summary="Install preview dependencies">cd preview && npm install</boltAction>',
              '<boltAction type="shell" summary="Start preview server" background="true" waitForPort="5275">cd preview && npm run dev</boltAction>',
            ]
          : []),
        '</boltArtifact>',
      ];

      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(formatDataStreamPart('text', chunk)));
        await wait(70);
      }

      controller.enqueue(
        encoder.encode(
          formatDataStreamPart('finish_message', {
            finishReason: 'stop',
            usage: {
              promptTokens: 0,
              completionTokens: 0,
            },
          }),
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

function streamTextMessage(content: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(formatDataStreamPart('text', content)));
      controller.enqueue(
        encoder.encode(
          formatDataStreamPart('finish_message', {
            finishReason: 'stop',
            usage: {
              promptTokens: 0,
              completionTokens: 0,
            },
          }),
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

function getExistingProject(messages: Array<{ role: string; content: string }>) {
  const latestAssistantArtifact = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content.includes('<boltArtifact'));

  if (!latestAssistantArtifact) {
    return null;
  }

  const idMatch = latestAssistantArtifact.content.match(/<boltArtifact[^>]*id="([^"]+)"/);
  const titleMatch = latestAssistantArtifact.content.match(/<boltArtifact[^>]*title="([^"]+)"/);

  if (!idMatch?.[1]) {
    return null;
  }

  const projectSlug = idMatch[1];
  const title = titleMatch?.[1] ?? projectSlug;
  const projectName = title.replace(/\s+workspace$/i, '').trim() || projectSlug;

  return { projectName, projectSlug };
}

function getLatestAssistantPlan(messages: Array<{ role: string; content: string }>): ProjectPlan | null {
  const latestAssistantPlan = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content.includes('<seekerPlan>'));

  if (!latestAssistantPlan) {
    return null;
  }

  return parsePlanMessage(latestAssistantPlan.content);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
