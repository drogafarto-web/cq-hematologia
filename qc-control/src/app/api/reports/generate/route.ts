import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createReportSchema } from '@/lib/validators'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const body = await req.json()
  const parsed = createReportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })

  const report = await prisma.report.create({
    data: {
      type: parsed.data.type,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      scope: parsed.data.scope,
      generatedById: session.user.id,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      ...report,
      downloadUrl: `/api/reports/${report.id}/download/pdf`,
      generatedAt: report.generatedAt.toISOString(),
    },
  }, { status: 201 })
}
