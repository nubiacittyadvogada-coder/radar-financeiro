import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])

    const devedores = await prisma.clienteDevedor.findMany({
      where: { contaEmpresaId: conta.id, ativo: true },
      include: {
        cobrancas: { where: { status: 'pendente' }, orderBy: { vencimento: 'asc' } },
        _count: { select: { mensagens: true } },
      },
      orderBy: { totalDevido: 'desc' },
    })

    return Response.json(devedores)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const body = await req.json()

    const devedor = await prisma.clienteDevedor.create({
      data: {
        contaEmpresaId: conta.id,
        nome: body.nome,
        cpfCnpj: body.cpfCnpj || null,
        email: body.email || null,
        telefone: body.telefone || null,
        perfilDevedor: body.perfilDevedor || 'primeiro_atraso',
        totalDevido: body.totalDevido || 0,
      },
    })

    // Cria cobrança se informado
    if (body.cobranca) {
      await prisma.cobrancaDevedor.create({
        data: {
          clienteDevedorId: devedor.id,
          descricao: body.cobranca.descricao,
          valor: body.cobranca.valor,
          vencimento: new Date(body.cobranca.vencimento),
        },
      })
    }

    return Response.json(devedor, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
