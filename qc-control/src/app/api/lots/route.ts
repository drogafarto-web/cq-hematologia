import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createLotSchema } from '@/lib/validators'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const level = searchParams.get('level')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: Record<string, unknown> = {}
  if (search) where.OR = [
    { lotNumber: { contains: search, mode: 'insensitive' } },
    { analyte: { contains: search, mode: 'insensitive' } },
    { reagentName: { contains: search, mode: 'insensitive' } },
  ]
  if (level) where.level = parseInt(level)
  if (status) where.status = status

  const lots = await prisma.lot.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { analyzer: { select: { id: true, analyzerId: true, model: true } } },
  })

  return NextResponse.json({ success: true, data: lots })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const body = await req.json()
  const parsed = createLotSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })

  const existing = await prisma.lot.findUnique({
    where: { lotNumber_level: { lotNumber: parsed.data.lotNumber, level: parsed.data.level } },
  })
  if (existing) return NextResponse.json({ success: false, error: { code: 'DUPLICATE', message: 'Lot number + level combination already exists' } }, { status: 409 })

  const analyzer = await prisma.analyzer.findUnique({ where: { id: parsed.data.analyzerId } })
  if (!analyzer) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Analyzer not found' } }, { status: 404 })

  const lot = await prisma.lot.create({
    data: {
      lotNumber: parsed.data.lotNumber,
      analyte: parsed.data.analyte,
      level: parsed.data.level,
      reagentName: parsed.data.reagentName,
      analyzerId: parsed.data.analyzerId,
      targetMean: parsed.data.targetMean,
      sd: parsed.data.sd,
      minAcceptance: parsed.data.minAcceptance,
      maxAcceptance: parsed.data.maxAcceptance,
      createdById: session.user.id,
    },
    include: { analyzer: { select: { id: true, analyzerId: true, model: true } } },
  })

  return NextResponse.json({ success: true, data: lot }, { status: 201 })
}
