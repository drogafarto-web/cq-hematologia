import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = await params

  const existing = await prisma.analyzer.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Analyzer not found' } }, { status: 404 })

  const updated = await prisma.analyzer.update({
    where: { id },
    data: { archived: true, status: 'OUT_OF_SERVICE' },
  })

  return NextResponse.json({ success: true, data: updated })
}
