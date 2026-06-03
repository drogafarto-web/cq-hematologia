import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAnalyzerSchema } from '@/lib/validators'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const analyzers = await prisma.analyzer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      calibrations: { orderBy: { calibratedAt: 'desc' }, take: 1 },
      maintenances: { orderBy: { performedAt: 'desc' }, take: 1 },
    },
  })

  return NextResponse.json({ success: true, data: analyzers })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const body = await req.json()
  const parsed = createAnalyzerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })

  const existing = await prisma.analyzer.findUnique({ where: { analyzerId: parsed.data.analyzerId } })
  if (existing) return NextResponse.json({ success: false, error: { code: 'DUPLICATE', message: 'Analyzer ID already exists' } }, { status: 409 })

  const analyzer = await prisma.analyzer.create({
    data: {
      analyzerId: parsed.data.analyzerId,
      model: parsed.data.model,
      manufacturer: parsed.data.manufacturer,
      serialNumber: parsed.data.serialNumber,
      location: parsed.data.location,
      installDate: new Date(parsed.data.installDate),
      status: 'OPERATIONAL',
    },
  })

  return NextResponse.json({ success: true, data: analyzer }, { status: 201 })
}
