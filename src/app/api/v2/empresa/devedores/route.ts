import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json([])

    const devedores = await prisma.clienteDevedor.findMany({
      where: { contaEmpresaId: conta.id, ativo: true },
      include: {
        cobrancas: { where: { status: 'pendente' }, orderBy: { vencimento: 'asc' } },
        _count: {
          select: {
            mensagens: true,
            cobrancas: true,
          },
        },
      },
      orderBy: { totalDevido: 'desc' },
    })

    // Auto-atualiza perfil de cada devedor com base no histórico e dias em atraso
    for (const d of devedores) {
      const cobrancaMaisAntiga = d.cobrancas[0] // já ordenadas por vencimento asc
      if (!cobrancaMaisAntiga) continue

      const diasAtraso = Math.max(0, Math.floor(
        (Date.now() - new Date(cobrancaMaisAntiga.vencimento).getTime()) / (1000 * 60 * 60 * 24)
      ))
      const total = d._count.cobrancas

      let novoPerfil = 'primeiro_atraso'
      if (total >= 5 || diasAtraso >= 90) novoPerfil = 'longo_prazo'
      else if (total >= 3 || diasAtraso >= 60) novoPerfil = 'recorrente'
      else if (total >= 2 || diasAtraso >= 30) novoPerfil = 'segundo_atraso'

      if (novoPerfil !== d.perfilDevedor) {
        await prisma.clienteDevedor.update({
          where: { id: d.id },
          data: { perfilDevedor: novoPerfil },
        })
        d.perfilDevedor = novoPerfil
      }
    }

    return Response.json(devedores)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
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
