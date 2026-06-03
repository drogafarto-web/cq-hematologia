import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import CAClient from './ca-client'

export default async function CorrectiveActionsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [raw, users] = await Promise.all([
    prisma.correctiveAction.findMany({
      orderBy: { openedAt: 'desc' },
      include: {
        operator: { select: { id: true, name: true } },
        investigator: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
        lot: {
          select: {
            lotNumber: true,
            analyte: true,
            reagentName: true,
            analyzer: { select: { analyzerId: true } },
          },
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const actions = raw.map((a) => ({
    ...a,
    openedAt: a.openedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    targetCompletionAt: a.targetCompletionAt?.toISOString() ?? null,
    verificationAt: a.verificationAt?.toISOString() ?? null,
    closedAt: a.closedAt?.toISOString() ?? null,
    equipmentId: a.equipmentId ?? null,
    lotId: a.lotId ?? null,
    ruleViolated: a.ruleViolated ?? null,
    investigatorId: a.investigatorId ?? null,
    rootCause: a.rootCause ?? null,
    supportingEvidence: a.supportingEvidence ?? null,
    actionTaken: a.actionTaken ?? null,
    preventiveMeasure: a.preventiveMeasure ?? null,
    effectivenessCheck: a.effectivenessCheck ?? null,
    verifiedById: a.verifiedById ?? null,
  }))

  return <CAClient actions={actions} users={users} currentUserId={session.user.id} />
}
