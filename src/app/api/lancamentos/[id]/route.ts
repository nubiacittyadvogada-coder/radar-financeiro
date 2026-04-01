import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamento } from '@/server/lib/calcularFechamento'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const lancamento = await prisma.lancamentoManual.findUnique({ where: { id: params.id } })
    if (!lancamento) return Response.json({ erro: 'Lançamento não encontrado' }, { status: 404 })

    if (u.tipo === 'cliente' && lancamento.clienteId !== u.id) {
      return Response.json({ erro: 'Sem permissão' }, { status: 403 })
    }

    await prisma.lancamentoManual.delete({ where: { id: params.id } })
    await calcularFechamento(lancamento.clienteId, lancamento.mes, lancamento.ano)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
