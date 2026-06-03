import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { releaseQcRunSchema } from '@/lib/validators'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = releaseQcRunSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })

  const run = await prisma.qcRun.findUnique({ where: { id } })
  if (!run) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Run not found' } }, { status: 404 })

  if (run.status !== 'PENDING_JUSTIFICATION') {
    return NextResponse.json({ success: false, error: { code: 'INVALID_STATE', message: 'Run is not pending justification' } }, { status: 409 })
  }

  const updated = await prisma.qcRun.update({
    where: { id },
    data: { status: 'RELEASED', justification: parsed.data.justification },
    include: {
      lot: { include: { analyzer: true } },
      operator: { select: { name: true } },
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
