import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamento } from '@/server/lib/calcularFechamento'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { transacoes, clienteId: bodyClienteId } = await req.json()
    const clienteId = u.tipo === 'cliente' ? u.id : bodyClienteId
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })
    if (!transacoes?.length) return Response.json({ erro: 'Nenhuma transação para confirmar' }, { status: 400 })

    const confirmadas = transacoes.filter((t: any) => !t.ignorar)
    const mesesAfetados = new Set<string>()

    for (const t of confirmadas) {
      const dataObj = new Date(t.data)
      const mes = dataObj.getMonth() + 1
      const ano = dataObj.getFullYear()
      mesesAfetados.add(`${mes}-${ano}`)

      await prisma.lancamentoManual.create({
        data: {
          clienteId, tipo: t.tipo, descricao: t.descricao,
          planoConta: t.planoConta, grupoConta: t.grupoConta,
          tipoContabil: t.tipoContabil, valor: Math.abs(Number(t.valor)),
          data: dataObj, mes, ano, previsto: false,
        },
      })
    }

    for (const mesAno of mesesAfetados) {
      const [mes, ano] = mesAno.split('-').map(Number)
      await calcularFechamento(clienteId, mes, ano)
    }

    return Response.json({ importados: confirmadas.length, ignorados: transacoes.length - confirmadas.length })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
