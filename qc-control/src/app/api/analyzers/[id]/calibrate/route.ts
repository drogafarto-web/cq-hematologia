import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calibrateAnalyzerSchema } from '@/lib/validators'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  const analyzer = await prisma.analyzer.findUnique({ where: { id } })
  if (!analyzer) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Analyzer not found' } }, { status: 404 })

  const body = await req.json()
  const parsed = calibrateAnalyzerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })

  const calibratedAt = new Date(parsed.data.calibratedAt)
  const nextDueAt = new Date(calibratedAt)
  nextDueAt.setMonth(nextDueAt.getMonth() + 12)

  const calibration = await prisma.calibration.create({
    data: {
      analyzerId: id,
      calibratedAt,
      nextDueAt,
      certificateNumber: parsed.data.certificateNumber,
      performedBy: parsed.data.performedBy,
      notes: parsed.data.notes,
    },
  })

  await prisma.analyzer.update({
    where: { id },
    data: { status: 'OPERATIONAL' },
  })

  return NextResponse.json({ success: true, data: calibration }, { status: 201 })
}
