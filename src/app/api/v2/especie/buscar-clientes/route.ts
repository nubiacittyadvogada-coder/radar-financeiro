/**
 * GET /api/v2/especie/buscar-clientes?token=...&q=nome
 * Rota pública — busca clientes pelo nome para autocompletar no formulário de espécie.
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    const q = req.nextUrl.searchParams.get('q') || ''

    if (!token) return Response.json({ erro: 'Token inválido' }, { status: 400 })

    const conta = await prisma.contaEmpresa.findFirst({
      where: { tokenEspecie: token },
      select: { id: true },
    })
    if (!conta) return Response.json({ erro: 'Link inválido' }, { status: 404 })

    const clientes = await prisma.clienteDevedor.findMany({
      where: {
        contaEmpresaId: conta.id,
        ativo: true,
        nome: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, nome: true, cpfCnpj: true },
      take: 10,
      orderBy: { nome: 'asc' },
    })

    return Response.json({ clientes })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
