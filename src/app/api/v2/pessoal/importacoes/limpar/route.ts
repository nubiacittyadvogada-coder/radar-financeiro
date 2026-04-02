import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// DELETE /api/v2/pessoal/importacoes/limpar?mes=X&ano=Y
// Remove TODAS as transações do mês/ano (com ou sem importacaoId)
export async function DELETE(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes'))
    const ano = Number(searchParams.get('ano'))

    if (!mes || !ano) return Response.json({ erro: 'mes e ano obrigatórios' }, { status: 400 })

    const { count } = await prisma.transacaoPessoal.deleteMany({
      where: { contaPessoalId: conta.id, mes, ano },
    })

    return Response.json({ ok: true, removidas: count })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
