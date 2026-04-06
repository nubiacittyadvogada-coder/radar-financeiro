import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    // Verifica que a conta pertence ao usuário logado
    const contaPessoal = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!contaPessoal) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const conta = await prisma.contaPagarPessoal.findFirst({
      where: { id: params.id, contaPessoalId: contaPessoal.id },
    })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const atualizada = await prisma.contaPagarPessoal.update({
      where: { id: params.id },
      data: {
        status: conta.status === 'pago' ? 'pendente' : 'pago',
        pagoEm: conta.status === 'pago' ? null : new Date(),
      },
    })

    return Response.json(atualizada)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
