import Anthropic from '@anthropic-ai/sdk'
import prisma from './db'

// Lazy init: sem passar apiKey vazio — SDK lê ANTHROPIC_API_KEY do env automaticamente
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada no servidor')
  return new Anthropic({ apiKey })
}

export async function responderPergunta(
  clienteId: string,
  pergunta: string,
  mes?: number,
  ano?: number
): Promise<string> {
  // 1. Buscar fechamento do período (ou último disponível)
  let fechamento: any

  if (mes && ano) {
    fechamento = await prisma.fechamento.findUnique({
      where: { clienteId_mes_ano: { clienteId, mes, ano } },
    })
  }

  if (!fechamento) {
    fechamento = await prisma.fechamento.findFirst({
      where: { clienteId },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    })
  }

  if (!fechamento) {
    return 'Ainda não existem dados financeiros importados. Peça ao seu BPO para fazer a primeira importação.'
  }

  // 2. Buscar últimos 3 fechamentos para contexto histórico
  const historico = await prisma.fechamento.findMany({
    where: { clienteId },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    take: 3,
    select: {
      mes: true,
      ano: true,
      receitaBruta: true,
      lucroOperacional: true,
      lucroLiquido: true,
      totalDespesasAdm: true,
      retiradaSocios: true,
      saldoFinal: true,
    },
  })

  // 3. Buscar top 10 maiores despesas do período
  const maioresDespesas = await prisma.lancamento.findMany({
    where: {
      clienteId,
      mes: fechamento.mes,
      ano: fechamento.ano,
      previsto: false,
      tipo: { in: ['pessoal', 'marketing', 'geral', 'custo_direto'] },
    },
    orderBy: { valor: 'asc' }, // negativos primeiro (maiores despesas)
    take: 10,
    select: {
      favorecido: true,
      planoConta: true,
      valor: true,
      descricao: true,
    },
  })

  const fmt = (v: any) => {
    const n = Number(v)
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const mesNome = [
    '', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]

  const contexto = `Você é um consultor financeiro que analisa os dados reais de uma empresa.
Responda em português simples e direto, sem jargão contábil desnecessário.
Seja específico com os números. Máximo 4 frases na resposta.
Não invente dados. Use apenas o que está nos dados abaixo.

DADOS DO PERÍODO ${mesNome[fechamento.mes]}/${fechamento.ano}:
Receita Bruta: R$ ${fmt(fechamento.receitaBruta)}
Receita Líquida: R$ ${fmt(fechamento.receitaLiquida)}
Custos Diretos: R$ ${fmt(fechamento.custosDiretos)}
Margem de Contribuição: R$ ${fmt(fechamento.margemContribuicao)} (${Number(fechamento.percMargem).toFixed(1)}%)
Despesas ADM: R$ ${fmt(fechamento.totalDespesasAdm)}
  - Pessoal: R$ ${fmt(fechamento.despesasPessoal)}
  - Marketing: R$ ${fmt(fechamento.despesasMarketing)}
  - Gerais: R$ ${fmt(fechamento.despesasGerais)}
Lucro Operacional: R$ ${fmt(fechamento.lucroOperacional)} (${Number(fechamento.percLucroOp).toFixed(1)}%)
Retirada de Sócios: R$ ${fmt(fechamento.retiradaSocios)}
Resultado Financeiro: R$ ${fmt(fechamento.resultadoFinanceiro)}
Lucro Líquido: R$ ${fmt(fechamento.lucroLiquido)}
${fechamento.saldoFinal ? `Saldo Final de Caixa: R$ ${fmt(fechamento.saldoFinal)}` : ''}

${historico.length > 1 ? `HISTÓRICO:
${historico.map((h: any) => `${mesNome[h.mes]}/${h.ano}: receita R$ ${fmt(h.receitaBruta)}, lucro op. R$ ${fmt(h.lucroOperacional)}, lucro liq. R$ ${fmt(h.lucroLiquido)}`).join('\n')}` : ''}

${maioresDespesas.length > 0 ? `MAIORES DESPESAS DO MÊS:
${maioresDespesas.map((d: any) => `${d.favorecido || 'N/I'}: R$ ${fmt(Math.abs(Number(d.valor)))} (${d.planoConta})`).join('\n')}` : ''}`

  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `${contexto}\n\nPERGUNTA DO EMPRESÁRIO: ${pergunta}`,
      },
    ],
  })

  const resposta =
    message.content[0].type === 'text'
      ? message.content[0].text
      : 'Não foi possível gerar uma resposta.'

  // Salvar conversa
  await prisma.conversaIA.create({
    data: {
      clienteId,
      pergunta,
      resposta,
      contextoMes: fechamento.mes,
      contextoAno: fechamento.ano,
    },
  })

  return resposta
}

export async function gerarEstrategia(clienteId: string): Promise<any> {
  // Buscar todos os fechamentos com receita
  const fechamentos = await prisma.fechamento.findMany({
    where: { clienteId, receitaBruta: { gt: 0 } },
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
  })

  if (fechamentos.length === 0) {
    throw new Error('Sem dados financeiros para gerar estratégia.')
  }

  const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const mesNome = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  // Calcular médias e tendências
  const ultimos6 = fechamentos.slice(-6)
  const mediaReceita = ultimos6.reduce((a, f) => a + Number(f.receitaBruta), 0) / ultimos6.length
  const mediaLucroOp = ultimos6.reduce((a, f) => a + Number(f.lucroOperacional), 0) / ultimos6.length
  const mediaRetirada = ultimos6.reduce((a, f) => a + Number(f.retiradaSocios), 0) / ultimos6.length
  const mediaDespGerais = ultimos6.reduce((a, f) => a + Number(f.despesasGerais), 0) / ultimos6.length
  const mediaDespPessoal = ultimos6.reduce((a, f) => a + Number(f.despesasPessoal), 0) / ultimos6.length
  const mediaMargem = ultimos6.reduce((a, f) => a + Number(f.percMargem), 0) / ultimos6.length

  // Buscar maiores despesas gerais (agrupadas)
  const topDespesas = await prisma.lancamento.groupBy({
    by: ['planoConta'],
    where: { clienteId, previsto: false, tipo: { in: ['geral', 'pessoal', 'marketing'] } },
    _sum: { valor: true },
    orderBy: { _sum: { valor: 'asc' } },
    take: 15,
  })

  // Último fechamento para contexto atual
  const ultimo = fechamentos[fechamentos.length - 1]
  const saldoAtual = Number(ultimo.saldoFinal || 0)

  const contexto = `Você é uma consultora financeira especialista em escritórios de advocacia no Brasil.
Analise os dados reais abaixo e gere uma estratégia financeira COMPLETA e ESPECÍFICA.
Use linguagem simples, direta, voltada para a empresária (Núbia Citty — NC Advogados).
Seja honesta mas construtiva. Use os números reais.

HISTÓRICO (${fechamentos.length} meses de dados — ${mesNome[fechamentos[0].mes]}/${fechamentos[0].ano} a ${mesNome[ultimo.mes]}/${ultimo.ano}):
${fechamentos.map(f => `${mesNome[f.mes]}/${f.ano}: Receita ${fmt(f.receitaBruta)} | Lucro Op. ${fmt(f.lucroOperacional)} (${Number(f.percLucroOp).toFixed(0)}%) | Retirada ${fmt(f.retiradaSocios)} | Lucro Liq. ${fmt(f.lucroLiquido)} | Caixa ${fmt(f.saldoFinal)}`).join('\n')}

MÉDIAS DOS ÚLTIMOS 6 MESES:
- Receita Bruta: ${fmt(mediaReceita)}
- Lucro Operacional: ${fmt(mediaLucroOp)} (${((mediaLucroOp/mediaReceita)*100).toFixed(1)}% da receita)
- Retirada de Sócios: ${fmt(mediaRetirada)} (${((mediaRetirada/mediaReceita)*100).toFixed(1)}% da receita)
- Despesas Gerais: ${fmt(mediaDespGerais)}
- Despesas Pessoal: ${fmt(mediaDespPessoal)}
- Margem de Contribuição: ${mediaMargem.toFixed(1)}%

SALDO ATUAL DE CAIXA: ${fmt(saldoAtual)}

DÍVIDAS CONHECIDAS:
- SICREDI BNDES: R$ 42.272,84 total restante
- SICREDI LIBERDADE (PRONAMPE): R$ 99.999,84 total restante
- Total endividamento: R$ 142.272,68

TOP DESPESAS ACUMULADAS (${fechamentos.length} meses):
${topDespesas.map(d => `${d.planoConta}: ${fmt(d._sum.valor)}`).join('\n')}

Gere a estratégia em formato JSON com exatamente esta estrutura:
{
  "diagnostico": "2-3 parágrafos com o diagnóstico real da saúde financeira",
  "pontosCriticos": ["lista de 3-5 problemas críticos identificados com números reais"],
  "despesasParaCortar": [{"categoria": "nome", "valorMensal": numero, "acao": "o que fazer especificamente", "economia": numero}],
  "estrategiasReceita": [{"titulo": "nome da estratégia", "descricao": "como implementar", "impactoPotencial": "valor estimado mensal"}],
  "planoAcao90dias": [{"mes": "Mês 1/2/3", "acoes": ["ação 1", "ação 2", "ação 3"]}],
  "metaRetirada": {"valorIdeal": numero, "justificativa": "por quê esse valor"},
  "alertas": ["alerta 1 urgente", "alerta 2"],
  "mensagemMotivacional": "uma frase de encerramento honesta e motivadora para a Núbia"
}`

  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: contexto }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'

  // Extrair JSON da resposta
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  let estrategia: any = { diagnostico: text }
  if (jsonMatch) {
    try {
      estrategia = JSON.parse(jsonMatch[0])
    } catch {
      // JSON veio malformado — tenta extrair o que der
      estrategia = { diagnostico: text, erro_parse: true }
    }
  }

  // Salvar como conversa IA
  await prisma.conversaIA.create({
    data: {
      clienteId,
      pergunta: 'ESTRATÉGIA FINANCEIRA COMPLETA',
      resposta: JSON.stringify(estrategia),
      contextoMes: ultimo.mes,
      contextoAno: ultimo.ano,
    },
  })

  return estrategia
}
