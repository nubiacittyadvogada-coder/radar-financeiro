import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET — retorna dados da conta incluindo saldo
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })
    return Response.json({
      saldoConta: conta.saldoConta ? Number(conta.saldoConta) : null,
      saldoContaEm: conta.saldoContaEm,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// PATCH — atualiza saldo em conta
export async function PATCH(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const { saldoConta } = await req.json()
    const conta = await prisma.contaPessoal.update({
      where: { usuarioId: u.id },
      data: {
        saldoConta: saldoConta !== null && saldoConta !== undefined ? saldoConta : null,
        saldoContaEm: new Date(),
      },
    })
    return Response.json({
      saldoConta: conta.saldoConta ? Number(conta.saldoConta) : null,
      saldoContaEm: conta.saldoContaEm,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
