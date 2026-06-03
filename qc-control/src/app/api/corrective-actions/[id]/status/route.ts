import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const validTransitions: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['UNDER_VERIFICATION'],
  UNDER_VERIFICATION: ['CLOSED'],
  CLOSED: [],
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  const existing = await prisma.correctiveAction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Corrective action not found' } }, { status: 404 })

  const body = await req.json()
  const { status: newStatus } = body
  if (!newStatus) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'status is required' } }, { status: 400 })

  const allowed = validTransitions[existing.status]
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_TRANSITION', message: `Cannot transition from ${existing.status} to ${newStatus}` },
    }, { status: 409 })
  }

  const data: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'CLOSED') data.closedAt = new Date()

  const updated = await prisma.correctiveAction.update({
    where: { id },
    data,
    include: {
      operator: { select: { id: true, name: true } },
      investigator: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
      lot: { select: { id: true, lotNumber: true, analyte: true } },
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
