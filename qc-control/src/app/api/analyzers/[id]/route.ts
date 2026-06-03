import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  const existing = await prisma.analyzer.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Analyzer not found' } }, { status: 404 })

  const body = await req.json()
  const allowedFields = ['model', 'manufacturer', 'serialNumber', 'location', 'status']
  const data: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) data[field] = body[field]
  }
  if (body.installDate) data.installDate = new Date(body.installDate)

  const analyzer = await prisma.analyzer.update({
    where: { id },
    data,
  })

  return NextResponse.json({ success: true, data: analyzer })
}
