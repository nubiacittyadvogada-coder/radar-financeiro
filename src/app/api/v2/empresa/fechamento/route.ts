import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

// GET /api/v2/empresa/fechamento?mes=X&ano=Y
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes') || new Date().getMonth() + 1)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    const fechamento = await calcularFechamentoEmpresa(conta.id, mes, ano)
    return Response.json(fechamento)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
