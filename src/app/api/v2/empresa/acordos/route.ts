import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET /api/v2/empresa/acordos — lista acordos aguardando aprovação
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const acordos = await prisma.acordoCobranca.findMany({
      where: {
        status: 'aguardando_aprovacao',
        clienteDevedor: { contaEmpresaId: conta.id },
      },
      include: {
        clienteDevedor: { select: { id: true, nome: true, telefone: true } },
        cobranca: { select: { id: true, descricao: true, valor: true, vencimento: true } },
      },
      orderBy: { criadoEm: 'desc' },
    })

    return Response.json(acordos)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
