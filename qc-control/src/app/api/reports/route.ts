import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const reports = await prisma.report.findMany({
    orderBy: { generatedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ success: true, data: reports })
}
