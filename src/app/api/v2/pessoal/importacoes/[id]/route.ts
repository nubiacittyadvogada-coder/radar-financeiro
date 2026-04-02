import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const importacao = await prisma.importacaoPessoal.findFirst({
      where: { id: params.id, contaPessoalId: conta.id },
      include: { _count: { select: { transacoes: true } } },
    })
    if (!importacao) return Response.json({ erro: 'Importação não encontrada' }, { status: 404 })

    const total = importacao._count.transacoes
    await prisma.transacaoPessoal.deleteMany({ where: { importacaoId: params.id } })
    await prisma.importacaoPessoal.delete({ where: { id: params.id } })

    return Response.json({ ok: true, total })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
