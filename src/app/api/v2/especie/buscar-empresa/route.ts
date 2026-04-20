/**
 * GET /api/v2/especie/buscar-empresa?token=...
 * Rota pública (sem autenticação) — valida o token e retorna dados da empresa.
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return Response.json({ erro: 'Token inválido' }, { status: 400 })

    const conta = await prisma.contaEmpresa.findFirst({
      where: { tokenEspecie: token },
      select: { id: true, nomeEmpresa: true, cnpj: true },
    })

    if (!conta) return Response.json({ erro: 'Link inválido ou expirado' }, { status: 404 })

    return Response.json({ nomeEmpresa: conta.nomeEmpresa })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
