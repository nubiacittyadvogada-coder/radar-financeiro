/**
 * POST /api/v2/especie/registrar
 * Rota pública — registra um pagamento em espécie (sem login).
 * Cria LancamentoEmpresa com statusPg: 'pendente' e conciliado: false.
 * O dono da empresa aprova depois.
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { token, clienteNome, clienteId, valor, referencia } = await req.json()

    if (!token) return Response.json({ erro: 'Token inválido' }, { status: 400 })
    if (!clienteNome || !valor || !referencia) {
      return Response.json({ erro: 'Preencha todos os campos obrigatórios' }, { status: 400 })
    }
    if (Number(valor) <= 0) {
      return Response.json({ erro: 'Valor deve ser maior que zero' }, { status: 400 })
    }

    const conta = await prisma.contaEmpresa.findFirst({
      where: { tokenEspecie: token },
      select: { id: true, nomeEmpresa: true },
    })
    if (!conta) return Response.json({ erro: 'Link inválido' }, { status: 404 })

    const agora = new Date()
    const mes = agora.getMonth() + 1
    const ano = agora.getFullYear()

    const lancamento = await prisma.lancamentoEmpresa.create({
      data: {
        contaEmpresaId: conta.id,
        origem: 'especie',
        mes,
        ano,
        favorecido: clienteNome,
        planoConta: '01_RPS.HONORÁRIOS MENSAIS',
        grupoConta: 'Receitas',
        tipo: 'receita',
        subtipo: 'honorario_mensal',
        descricao: referencia,
        valor: Number(valor),
        dataCompetencia: agora,
        statusPg: 'pendente_aprovacao',
        formaPagamento: 'Dinheiro',
        banco: 'TESOURARIA',
        conciliado: false,
        observacoes: clienteId ? `clienteId:${clienteId}` : null,
      },
    })

    return Response.json({
      ok: true,
      id: lancamento.id,
      nomeEmpresa: conta.nomeEmpresa,
      clienteNome,
      valor: Number(valor),
      referencia,
      data: agora.toISOString(),
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
