import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  controleId: z.string().cuid(),
  valorProtrombina: z.number(),
  valorRni: z.number(),
  valorTtppa: z.number(),
  operadorId: z.string().cuid(),
  observacao: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: parsed.error.message } },
      { status: 400 },
    );
  }

  try {
    const registro = await prisma.registro.create({
      data: {
        controleId: parsed.data.controleId,
        valorProtrombina: parsed.data.valorProtrombina,
        valorRni: parsed.data.valorRni,
        valorTtppa: parsed.data.valorTtppa,
        operadorId: parsed.data.operadorId,
        observacao: parsed.data.observacao,
      },
      include: {
        operador: { select: { nome: true } },
        controle: { select: { nome: true, lote: true } },
      },
    });
    return NextResponse.json({ success: true, data: registro });
  } catch (error) {
    console.error('Erro ao criar registro:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: 'Falha ao salvar registro' } },
      { status: 500 },
    );
  }
}
