import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// POST /api/v2/empresa/devedores/[id]/cobrancas
// Adiciona nova cobrança a um devedor existente
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const devedor = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!devedor) return Response.json({ erro: 'Devedor não encontrado' }, { status: 404 })

    const { descricao, valor, vencimento } = await req.json()
    if (!descricao || !valor || !vencimento) {
      return Response.json({ erro: 'descricao, valor e vencimento são obrigatórios' }, { status: 400 })
    }

    const cobranca = await prisma.cobrancaDevedor.create({
      data: {
        clienteDevedorId: devedor.id,
        descricao,
        valor: Number(valor),
        vencimento: new Date(vencimento),
        status: 'pendente',
      },
    })

    // Atualiza totalDevido do devedor
    await prisma.clienteDevedor.update({
      where: { id: devedor.id },
      data: { totalDevido: { increment: Number(valor) } },
    })

    return Response.json(cobranca, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// GET /api/v2/empresa/devedores/[id]/cobrancas
// Lista cobranças de um devedor
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const devedor = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!devedor) return Response.json({ erro: 'Devedor não encontrado' }, { status: 404 })

    const cobrancas = await prisma.cobrancaDevedor.findMany({
      where: { clienteDevedorId: devedor.id },
      orderBy: { criadoEm: 'desc' },
    })
    return Response.json(cobrancas)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
