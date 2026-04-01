import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPagar.findUnique({ where: { id: params.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    await prisma.contaPagar.update({ where: { id: params.id }, data: { status: 'pago', pagoEm: new Date() } })

    if (conta.recorrente && conta.frequencia) {
      const proxVenc = new Date(conta.vencimento)
      if (conta.frequencia === 'mensal') proxVenc.setMonth(proxVenc.getMonth() + 1)
      else if (conta.frequencia === 'quinzenal') proxVenc.setDate(proxVenc.getDate() + 15)
      else if (conta.frequencia === 'semanal') proxVenc.setDate(proxVenc.getDate() + 7)
      else if (conta.frequencia === 'anual') proxVenc.setFullYear(proxVenc.getFullYear() + 1)

      await prisma.contaPagar.create({
        data: {
          clienteId: conta.clienteId, descricao: conta.descricao, fornecedor: conta.fornecedor,
          valor: conta.valor, vencimento: proxVenc, recorrente: true, frequencia: conta.frequencia,
          categoria: conta.categoria, status: 'pendente',
        },
      })
    }

    return Response.json({ ok: true, recorrente: conta.recorrente })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
