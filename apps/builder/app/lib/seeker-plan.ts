import type { ProjectPlan } from '~/lib/.server/seeker/shared';

const SEEKER_PLAN_TAG_OPEN = '<seekerPlan>';
const SEEKER_PLAN_TAG_CLOSE = '</seekerPlan>';

export function serializePlanMessage(plan: ProjectPlan) {
  return `${SEEKER_PLAN_TAG_OPEN}${JSON.stringify(plan)}${SEEKER_PLAN_TAG_CLOSE}`;
}

export function parsePlanMessage(content: string): ProjectPlan | null {
  const match = content.match(
    /<seekerPlan>([\s\S]*?)<\/seekerPlan>/,
  );

  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as ProjectPlan;
  } catch {
    return null;
  }
}

export function stripPlanMessage(content: string) {
  return content.replace(/<seekerPlan>[\s\S]*?<\/seekerPlan>/g, '').trim();
}

export function isPlanConfirmation(content: string) {
  const normalized = content.trim().toLowerCase();

  return [
    'confirm',
    'confirm plan',
    'confirmar',
    'confirmar plano',
    'go ahead',
    'looks good',
    'approved',
    'pode gerar',
    'pode criar',
  ].includes(normalized);
}

export function renderPlanReview(plan: ProjectPlan) {
  const sections = [
    '# Review the plan',
    '',
    `**App name**: ${plan.projectName}`,
    `**Template**: ${plan.template}`,
    `**Summary**: ${plan.summary}`,
    '',
    '## Initial screens',
    ...plan.initialScreens.map((screen) => `- ${screen}`),
    '',
    '## Integrations',
    ...plan.integrations.map((integration) => `- ${integration}`),
    '',
    '## Existing files to edit',
    ...plan.filesToEdit.map((file) => `- \`${file.path}\``),
    '',
    plan.newFiles.length > 0 ? '## New files planned' : '## New files planned',
    ...(plan.newFiles.length > 0
      ? plan.newFiles.map((file) => `- \`${file.path}\`: ${file.purpose}`)
      : ['- None in MVP draft']),
    '',
    'Reply with `Confirm plan` to generate the project, or describe what should change.',
  ];

  return `${serializePlanMessage(plan)}\n\n${sections.join('\n')}`;
}
