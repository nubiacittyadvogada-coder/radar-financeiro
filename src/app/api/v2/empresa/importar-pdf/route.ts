/**
 * POST /api/v2/empresa/importar-pdf
 * Usa Claude Vision para extrair receitas/despesas de extrato bancário PDF.
 * Retorna lista de transações para preview antes de confirmar importação.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ erro: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ erro: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const prompt = `Analise este extrato bancário empresarial e extraia TODAS as movimentações financeiras reais.

═══ IDENTIFICAR ═══
- Empresa: ${conta.nomeEmpresa}
- Extraia receitas (créditos/entradas) e despesas (débitos/saídas)
- Ignore: saldo inicial, saldo final, linhas de saldo/resumo
- Ignore transferências internas entre contas da mesma empresa

═══ CATEGORIAS PARA RECEITAS ═══
honorario_inicial | honorario_mensal | consulta | exito | multa_cancelamento | outros_receita

═══ CATEGORIAS PARA DESPESAS ═══
pessoal | aluguel | marketing | servicos | software | impostos | retirada | outras_despesas

═══ REGRAS ═══
- Créditos/entradas = tipo "receita"
- Débitos/saídas = tipo "despesa"
- Salários, pró-labore = pessoal
- Aluguel, IPTU = aluguel
- Google, Meta, publicidade = marketing
- Serviços de terceiros, freelancers = servicos
- Software, sistemas, assinaturas = software
- Impostos, DAS, IRPJ, CSLL, ISS = impostos
- Retirada de sócio = retirada
- Honorários recebidos de clientes = honorario_mensal ou honorario_inicial
- Consultas avulsas = consulta
- Valores de êxito = exito
- Qualquer outro crédito = outros_receita
- Qualquer outro débito = outras_despesas

Responda APENAS JSON válido (sem markdown):
{
  "banco": "nome do banco",
  "periodo": "ex: Abril/2026",
  "transacoes": [
    {
      "data": "2026-04-02",
      "descricao": "Descrição limpa",
      "tipo": "receita",
      "categoria": "honorario_mensal",
      "valor": 5000.00
    }
  ],
  "observacoes": "resumo do que foi ignorado"
}`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
          { role: 'assistant', content: '{' },
        ],
      }),
    })

    const aiData = await res.json()
    if (aiData.error) return Response.json({ erro: aiData.error.message || 'Erro na IA' }, { status: 500 })

    const text = '{' + (aiData.content?.[0]?.text ?? '{}')
    let resultado: any = {}
    try {
      resultado = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) try { resultado = JSON.parse(match[0]) } catch {}
    }

    if (!resultado.transacoes?.length) {
      return Response.json({ erro: 'Não foi possível identificar transações neste PDF.' }, { status: 422 })
    }

    return Response.json({
      banco: resultado.banco || 'Desconhecido',
      periodo: resultado.periodo || '',
      observacoes: resultado.observacoes || '',
      transacoes: resultado.transacoes,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
