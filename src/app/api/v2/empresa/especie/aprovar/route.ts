/**
 * POST /api/v2/empresa/especie/aprovar
 * Aprova ou rejeita um lançamento de espécie pendente.
 * Body: { lancamentoId, acao: 'aprovar' | 'rejeitar' }
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const { lancamentoId, acao } = await req.json()
    if (!lancamentoId || !['aprovar', 'rejeitar'].includes(acao)) {
      return Response.json({ erro: 'Parâmetros inválidos' }, { status: 400 })
    }

    const lancamento = await prisma.lancamentoEmpresa.findFirst({
      where: { id: lancamentoId, contaEmpresaId: conta.id, origem: 'especie', statusPg: 'pendente_aprovacao' },
    })
    if (!lancamento) return Response.json({ erro: 'Lançamento não encontrado' }, { status: 404 })

    if (acao === 'aprovar') {
      await prisma.lancamentoEmpresa.update({
        where: { id: lancamentoId },
        data: {
          statusPg: 'pago',
          dataPagamento: new Date(),
          conciliado: true,
        },
      })
      // Recalcula fechamento
      calcularFechamentoEmpresa(conta.id, lancamento.mes, lancamento.ano).catch(() => {})
      return Response.json({ ok: true, acao: 'aprovado' })
    } else {
      // Rejeitar: exclui o lançamento
      await prisma.lancamentoEmpresa.delete({ where: { id: lancamentoId } })
      return Response.json({ ok: true, acao: 'rejeitado' })
    }
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
