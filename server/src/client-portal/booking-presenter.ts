import { ProjectStage, ProjectStatus } from '@prisma/client';

export function resolveLifecycleStatus(
  lead: { status: string },
  proposal: any,
  project: any,
) {
  if (project?.status === ProjectStatus.COMPLETED) return 'COMPLETED';
  if (project) return project.status;
  if (proposal?.contract?.status === 'SIGNED') return 'READY_FOR_EXECUTION';
  if (proposal?.status) return proposal.status;
  return lead.status;
}

export function resolveProgress(project: any) {
  if (!project) return 20;
  if (project.status === ProjectStatus.COMPLETED) return 100;
  return project.progress || 0;
}

export function resolveNextAction(
  lead: any,
  proposal: any,
  project: any,
  duePaymentId?: string,
) {
  if (proposal?.status === 'SENT') {
    return {
      label: 'Review proposal',
      path: `/dashboard/events/${lead.id}`,
    };
  }

  if (proposal?.contract && proposal.contract.status !== 'SIGNED') {
    return {
      label: 'Sign contract',
      path: `/dashboard/events/${lead.id}`,
    };
  }

  if (duePaymentId) {
    return {
      label: 'Complete payment',
      path: `/dashboard/events/${lead.id}`,
    };
  }

  if (project?.status === ProjectStatus.COMPLETED && !project.feedback) {
    return {
      label: 'Share feedback',
      path: `/dashboard/events/${lead.id}`,
    };
  }

  return {
    label: 'View event details',
    path: `/dashboard/events/${lead.id}`,
  };
}

export function buildStages(project: any) {
  const reachedStages = new Set<ProjectStage>(
    (project?.updates ?? []).map(
      (update: { stage: ProjectStage }) => update.stage,
    ),
  );
  const fallbackStage =
    project?.status === ProjectStatus.COMPLETED
      ? ProjectStage.COMPLETED
      : project?.status === ProjectStatus.EXECUTION
        ? ProjectStage.EVENT_DAY
        : project?.status === ProjectStatus.PREPARATION
          ? ProjectStage.PREPARATION
          : ProjectStage.PLANNING;

  const orderedStages = [
    ProjectStage.PLANNING,
    ProjectStage.PREPARATION,
    ProjectStage.READY,
    ProjectStage.EVENT_DAY,
    ProjectStage.COMPLETED,
  ];

  const fallbackIndex = orderedStages.indexOf(fallbackStage);

  return orderedStages.map((stage, index) => ({
    stage,
    completed: reachedStages.has(stage) || index <= fallbackIndex,
  }));
}

export function buildTimeline(input: {
  leadActivities: Array<any>;
  updates: Array<any>;
  payments: Array<any>;
  proposal: any;
  contract: any;
}) {
  const items = [
    ...input.leadActivities.map((activity) => ({
      id: activity.id,
      type: 'activity',
      title: activity.description,
      body: activity.metadata ?? null,
      actor: activity.actor,
      createdAt: activity.createdAt,
    })),
    ...input.updates.map((update) => ({
      id: update.id,
      type: 'update',
      title: update.title,
      body: update.body,
      actor: update.createdBy,
      createdAt: update.createdAt,
    })),
    ...input.payments.map((payment) => ({
      id: payment.id,
      type: 'payment',
      title: `${payment.type} payment ${payment.status.toLowerCase()}`,
      body: payment.notes,
      createdAt: payment.paidAt ?? payment.createdAt,
    })),
  ];

  if (input.proposal) {
    items.push({
      id: input.proposal.id,
      type: 'proposal',
      title: `Proposal ${input.proposal.status.toLowerCase()}`,
      body: input.proposal.clientComment,
      createdAt: input.proposal.decidedAt ?? input.proposal.createdAt,
    });
  }

  if (input.contract) {
    items.push({
      id: input.contract.id,
      type: 'contract',
      title: `Contract ${input.contract.status.toLowerCase()}`,
      body: input.contract.signedByName
        ? `Signed by ${input.contract.signedByName}`
        : null,
      createdAt: input.contract.signedAt ?? input.contract.createdAt,
    });
  }

  return items.sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}
