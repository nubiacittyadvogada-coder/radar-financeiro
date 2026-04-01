import prisma from './db'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function chamarIA(prompt: string, maxTokens: number = 300, jsonMode = false): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada no servidor')

  const messages: any[] = [{ role: 'user', content: prompt }]
  // Prefill com "{" força o modelo a retornar JSON puro, sem markdown
  if (jsonMode) messages.push({ role: 'assistant', content: '{' })

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  // Se usou prefill, o "{" inicial já foi injetado — concatena
  return jsonMode ? '{' + text : text
}

export async function responderPergunta(
  clienteId: string,
  pergunta: string,
  mes?: number,
  ano?: number
): Promise<string> {
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

  const historico = await prisma.fechamento.findMany({
    where: { clienteId },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    take: 3,
    select: { mes: true, ano: true, receitaBruta: true, lucroOperacional: true, lucroLiquido: true, retiradaSocios: true, saldoFinal: true },
  })

  const maioresDespesas = await prisma.lancamento.findMany({
    where: { clienteId, mes: fechamento.mes, ano: fechamento.ano, previsto: false, tipo: { in: ['pessoal', 'marketing', 'geral', 'custo_direto'] } },
    orderBy: { valor: 'asc' },
    take: 10,
    select: { favorecido: true, planoConta: true, valor: true },
  })

  const fmt = (v: any) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const mesNome = ['','janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

  const prompt = `Você é um consultor financeiro que analisa dados reais de uma empresa.
Responda em português simples e direto. Máximo 4 frases. Use os números reais abaixo.

DADOS ${mesNome[fechamento.mes]}/${fechamento.ano}:
Receita Bruta: R$ ${fmt(fechamento.receitaBruta)}
Lucro Operacional: R$ ${fmt(fechamento.lucroOperacional)} (${Number(fechamento.percLucroOp).toFixed(1)}%)
Despesas ADM: R$ ${fmt(fechamento.totalDespesasAdm)} | Pessoal: R$ ${fmt(fechamento.despesasPessoal)} | Marketing: R$ ${fmt(fechamento.despesasMarketing)}
Retirada de Sócios: R$ ${fmt(fechamento.retiradaSocios)}
Lucro Líquido: R$ ${fmt(fechamento.lucroLiquido)}
${fechamento.saldoFinal ? `Caixa: R$ ${fmt(fechamento.saldoFinal)}` : ''}

${historico.length > 1 ? `HISTÓRICO:\n${historico.map((h: any) => `${mesNome[h.mes]}/${h.ano}: receita R$ ${fmt(h.receitaBruta)}, lucro liq. R$ ${fmt(h.lucroLiquido)}`).join('\n')}` : ''}
${maioresDespesas.length > 0 ? `\nMAIORES DESPESAS:\n${maioresDespesas.map((d: any) => `${d.favorecido || 'N/I'}: R$ ${fmt(Math.abs(Number(d.valor)))} (${d.planoConta})`).join('\n')}` : ''}

PERGUNTA: ${pergunta}`

  const resposta = await chamarIA(prompt, 400)

  await prisma.conversaIA.create({
    data: { clienteId, pergunta, resposta, contextoMes: fechamento.mes, contextoAno: fechamento.ano },
  })

  return resposta
}

export async function gerarEstrategia(clienteId: string): Promise<any> {
  const fechamentos = await prisma.fechamento.findMany({
    where: { clienteId, receitaBruta: { gt: 0 } },
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
  })

  if (fechamentos.length === 0) {
    throw new Error('Sem dados financeiros para gerar estratégia.')
  }

  const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const mesNome = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  const ultimos6 = fechamentos.slice(-6)
  const mediaReceita = ultimos6.reduce((a, f) => a + Number(f.receitaBruta), 0) / ultimos6.length
  const mediaLucroOp = ultimos6.reduce((a, f) => a + Number(f.lucroOperacional), 0) / ultimos6.length
  const mediaRetirada = ultimos6.reduce((a, f) => a + Number(f.retiradaSocios), 0) / ultimos6.length
  const mediaDespGerais = ultimos6.reduce((a, f) => a + Number(f.despesasGerais), 0) / ultimos6.length
  const mediaDespPessoal = ultimos6.reduce((a, f) => a + Number(f.despesasPessoal), 0) / ultimos6.length
  const mediaMargem = ultimos6.reduce((a, f) => a + Number(f.percMargem), 0) / ultimos6.length

  const topDespesas = await prisma.lancamento.groupBy({
    by: ['planoConta'],
    where: { clienteId, previsto: false, tipo: { in: ['geral', 'pessoal', 'marketing'] } },
    _sum: { valor: true },
    orderBy: { _sum: { valor: 'asc' } },
    take: 15,
  })

  const ultimo = fechamentos[fechamentos.length - 1]

  const prompt = `Você é uma consultora financeira especialista em escritórios de advocacia no Brasil.
Analise os dados reais abaixo e gere uma estratégia financeira COMPLETA e ESPECÍFICA.
Use linguagem simples, direta, voltada para a empresária (Núbia Citty — NC Advogados).
Seja honesta mas construtiva. Use os números reais.

HISTÓRICO (${fechamentos.length} meses — ${mesNome[fechamentos[0].mes]}/${fechamentos[0].ano} a ${mesNome[ultimo.mes]}/${ultimo.ano}):
${fechamentos.map(f => `${mesNome[f.mes]}/${f.ano}: Receita ${fmt(f.receitaBruta)} | Lucro Op. ${fmt(f.lucroOperacional)} (${Number(f.percLucroOp).toFixed(0)}%) | Retirada ${fmt(f.retiradaSocios)} | Lucro Liq. ${fmt(f.lucroLiquido)} | Caixa ${fmt(f.saldoFinal)}`).join('\n')}

MÉDIAS ÚLTIMOS 6 MESES:
- Receita: ${fmt(mediaReceita)}
- Lucro Op.: ${fmt(mediaLucroOp)} (${((mediaLucroOp/mediaReceita)*100).toFixed(1)}%)
- Retirada: ${fmt(mediaRetirada)} (${((mediaRetirada/mediaReceita)*100).toFixed(1)}% da receita)
- Desp. Gerais: ${fmt(mediaDespGerais)} | Pessoal: ${fmt(mediaDespPessoal)}
- Margem: ${mediaMargem.toFixed(1)}%

DÍVIDAS: SICREDI BNDES R$ 42.272,84 + PRONAMPE R$ 99.999,84 = R$ 142.272,68 total

TOP DESPESAS ACUMULADAS:
${topDespesas.map(d => `${d.planoConta}: ${fmt(d._sum.valor)}`).join('\n')}

Responda APENAS com JSON válido, sem texto antes ou depois:
{
  "diagnostico": "2-3 parágrafos diagnóstico real",
  "pontosCriticos": ["problema 1 com números", "problema 2", "problema 3"],
  "despesasParaCortar": [{"categoria": "nome", "valorMensal": 0, "acao": "o que fazer", "economia": 0}],
  "estrategiasReceita": [{"titulo": "nome", "descricao": "como fazer", "impactoPotencial": "R$ X/mês"}],
  "planoAcao90dias": [{"mes": "Mês 1", "acoes": ["ação 1", "ação 2"]}, {"mes": "Mês 2", "acoes": ["ação 1"]}, {"mes": "Mês 3", "acoes": ["ação 1"]}],
  "metaRetirada": {"valorIdeal": 0, "justificativa": "por quê"},
  "alertas": ["alerta urgente 1", "alerta 2"],
  "mensagemMotivacional": "frase final para a Núbia"
}`

  const text = await chamarIA(prompt, 3000, true)

  let estrategia: any = { diagnostico: text }
  try {
    estrategia = JSON.parse(text)
  } catch {
    // Fallback: tenta extrair JSON do texto
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { estrategia = JSON.parse(match[0]) } catch { estrategia = { diagnostico: text } }
    }
  }

  await prisma.conversaIA.create({
    data: { clienteId, pergunta: 'ESTRATÉGIA FINANCEIRA COMPLETA', resposta: JSON.stringify(estrategia), contextoMes: ultimo.mes, contextoAno: ultimo.ano },
  })

  return estrategia
}
