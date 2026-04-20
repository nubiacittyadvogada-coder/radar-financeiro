/**
 * Cron: roda no último dia do mês às 18h Brasília (21h UTC).
 * 1. Calcula DRE do mês que fechou
 * 2. Compara com mês anterior
 * 3. Claude analisa e gera insights
 * 4. Envia resumo via WhatsApp
 *
 * Vercel cron: "0 21 28-31 * *" (dias 28-31, 21h UTC — filtra último dia internamente)
 */

import { NextRequest } from 'next/server'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'
import { getZApiClient } from '@/lib/zapi'

export const maxDuration = 120

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function fmt(v: any) {
  return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function pct(v: any) {
  return `${Number(v || 0).toFixed(1)}%`
}

// Verifica se hoje é o último dia do mês
function isUltimoDiaMes(): boolean {
  const hoje = new Date()
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)
  return amanha.getDate() === 1
}

async function gerarAnaliseIA(
  empresa: string,
  mes: number,
  ano: number,
  atual: any,
  anterior: any | null
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return gerarAnaliseFallback(mes, ano, atual, anterior)

  const d = (v: any) => Number(v || 0)
  const varPct = (a: any, b: any) => b ? ((d(a) - d(b)) / (d(b) || 1) * 100).toFixed(1) : null

  const contexto = `
Empresa: ${empresa}
Mês analisado: ${MESES[mes]}/${ano}

DRE ${MESES[mes]}/${ano}:
- Receita Bruta: ${fmt(atual.receitaBruta)}
- Impostos: ${fmt(atual.impostos)}
- Receita Líquida: ${fmt(atual.receitaLiquida)}
- Custos Diretos: ${fmt(atual.custosDiretos)}
- Margem de Contribuição: ${fmt(atual.margemContribuicao)} (${pct(atual.percMargem)})
- Despesas Pessoal: ${fmt(atual.despesasPessoal)}
- Despesas Marketing: ${fmt(atual.despesasMarketing)}
- Despesas Gerais: ${fmt(atual.despesasGerais)}
- Lucro Operacional: ${fmt(atual.lucroOperacional)} (${pct(atual.percLucroOp)})
- Retirada Sócios: ${fmt(atual.retiradaSocios)}
- Lucro Líquido: ${fmt(atual.lucroLiquido)} (${pct(atual.percLucroLiq)})
${anterior ? `
Comparação com ${MESES[mes - 1 || 12]}/${mes === 1 ? ano - 1 : ano}:
- Receita: ${varPct(atual.receitaBruta, anterior.receitaBruta)}%
- Lucro Operacional: ${varPct(atual.lucroOperacional, anterior.lucroOperacional)}%
- Margem: ${(d(atual.percMargem) - d(anterior.percMargem)).toFixed(1)}pp
- Despesas ADM: ${varPct(atual.totalDespesasAdm, anterior.totalDespesasAdm)}%
` : '(sem mês anterior para comparação)'}
`

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Você é um consultor financeiro para escritórios de advocacia. Analise o DRE abaixo e gere um resumo executivo em 3-4 pontos principais para enviar por WhatsApp. Seja direto e prático. Use emoji. Máximo 250 palavras.

${contexto}

Responda apenas com o texto da análise, sem cabeçalhos ou explicações.`,
        }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || gerarAnaliseFallback(mes, ano, atual, anterior)
  } catch {
    return gerarAnaliseFallback(mes, ano, atual, anterior)
  }
}

function gerarAnaliseFallback(mes: number, ano: number, atual: any, anterior: any | null): string {
  const d = (v: any) => Number(v || 0)
  const partes: string[] = []

  const lucro = d(atual.lucroLiquido)
  const margem = d(atual.percLucroLiq)

  if (lucro > 0) {
    partes.push(`✅ Lucro líquido de ${fmt(lucro)} (margem ${pct(margem)})`)
  } else {
    partes.push(`⚠️ Resultado negativo de ${fmt(lucro)} — atenção às despesas`)
  }

  if (anterior) {
    const varReceita = d(atual.receitaBruta) - d(anterior.receitaBruta)
    const emoji = varReceita >= 0 ? '📈' : '📉'
    partes.push(`${emoji} Receita ${varReceita >= 0 ? '+' : ''}${fmt(varReceita)} vs mês anterior`)
  }

  const totalDesp = d(atual.totalDespesasAdm)
  if (totalDesp > d(atual.receitaLiquida) * 0.7) {
    partes.push(`⚠️ Despesas ADM representam ${pct(totalDesp / (d(atual.receitaLiquida) || 1) * 100)} da receita líquida — avaliar otimizações`)
  }

  return partes.join('\n')
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  // Só executa no último dia do mês (cron chama nos dias 28-31)
  const forcar = req.nextUrl.searchParams.get('forcar') === '1'
  if (!forcar && !isUltimoDiaMes()) {
    return Response.json({ ok: true, pulado: true, motivo: 'Não é o último dia do mês' })
  }

  const agora = new Date()
  // Mês que está fechando = mês atual
  const mes = agora.getMonth() + 1
  const ano = agora.getFullYear()
  // Mês anterior
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano

  const resultados: Array<{ empresa: string; enviado: boolean }> = []

  try {
    const contas = await prisma.contaEmpresa.findMany({
      where: {
        alertaAtivo: true,
        telefoneAlerta: { not: null },
        zapiInstanceId: { not: null },
        zapiToken: { not: null },
        zapiClientToken: { not: null },
      },
    })

    for (const conta of contas) {
      try {
        // Recalcula fechamento atual
        const fechamentoAtual = await calcularFechamentoEmpresa(conta.id, mes, ano)

        // Busca fechamento anterior (sem recalcular)
        const fechamentoAnterior = await prisma.fechamentoEmpresa.findUnique({
          where: { contaEmpresaId_mes_ano: { contaEmpresaId: conta.id, mes: mesAnt, ano: anoAnt } },
        })

        // Gera análise com Claude
        const analise = await gerarAnaliseIA(
          conta.nomeEmpresa,
          mes,
          ano,
          fechamentoAtual,
          fechamentoAnterior
        )

        // Monta mensagem
        const d = (v: any) => Number(v || 0)
        const mensagem =
          `📊 *DRE ${MESES[mes]}/${ano} — ${conta.nomeEmpresa}*\n\n` +
          `💰 Receita Bruta: *${fmt(fechamentoAtual.receitaBruta)}*\n` +
          `📉 Impostos: ${fmt(fechamentoAtual.impostos)}\n` +
          `💵 Receita Líquida: *${fmt(fechamentoAtual.receitaLiquida)}*\n` +
          `─────────────────\n` +
          `🏢 Custos Diretos: ${fmt(fechamentoAtual.custosDiretos)}\n` +
          `👥 Pessoal: ${fmt(fechamentoAtual.despesasPessoal)}\n` +
          `📣 Marketing: ${fmt(fechamentoAtual.despesasMarketing)}\n` +
          `🗂️ Gerais: ${fmt(fechamentoAtual.despesasGerais)}\n` +
          `─────────────────\n` +
          `📈 Lucro Operacional: *${fmt(fechamentoAtual.lucroOperacional)}* (${pct(fechamentoAtual.percLucroOp)})\n` +
          `💎 Lucro Líquido: *${fmt(fechamentoAtual.lucroLiquido)}* (${pct(fechamentoAtual.percLucroLiq)})\n\n` +
          `🤖 *Análise IA:*\n${analise}\n\n` +
          `_Ver DRE completo no Radar Financeiro_`

        // Envia WhatsApp
        const zapi = getZApiClient(conta)
        let enviado = false
        if (zapi && conta.telefoneAlerta) {
          enviado = await zapi.enviarTexto(conta.telefoneAlerta, mensagem)
        }

        resultados.push({ empresa: conta.nomeEmpresa, enviado })

        // Salva conversa IA para histórico
        await prisma.conversaIAEmpresa.create({
          data: {
            contaEmpresaId: conta.id,
            pergunta: `DRE automático ${MESES[mes]}/${ano}`,
            resposta: analise,
            contextoMes: mes,
            contextoAno: ano,
          },
        })
      } catch (err: any) {
        console.error(`[Cron DRE] Erro em ${conta.nomeEmpresa}:`, err.message)
        resultados.push({ empresa: conta.nomeEmpresa, enviado: false })
      }
    }

    return Response.json({ ok: true, mes, ano, processados: contas.length, resultados })
  } catch (err: any) {
    console.error('[Cron dre-mensal]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
