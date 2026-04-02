import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import bcrypt from 'bcryptjs'

// Retorna (ou cria) o cliente "Finanças Pessoais" do BPO logado
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const bpoId = u.bpoId || u.id

    let cliente = await prisma.cliente.findFirst({
      where: { bpoId, setor: 'pessoal' },
    })

    if (!cliente) {
      const hash = await bcrypt.hash('pessoal123', 10)
      cliente = await prisma.cliente.create({
        data: {
          bpoId,
          nomeEmpresa: 'Finanças Pessoais',
          cnpj: 'PESSOAL',
          setor: 'pessoal',
          responsavel: 'Pessoal',
          email: `pessoal-${bpoId.slice(0, 8)}@interno`,
          senhaHash: hash,
          alertaWpp: false,
          metaLucro: 0,
          metaReceita: 0,
        },
      })
    }

    return Response.json({ clienteId: cliente.id })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
