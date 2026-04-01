/**
 * Categoriza transações de extrato bancário usando IA (Claude)
 * Mapeia descrição do banco → plano de contas do sistema
 */
import Anthropic from '@anthropic-ai/sdk'
import { TransacaoExtrato } from './parsearExtrato'

export interface TransacaoCategorizada extends TransacaoExtrato {
  planoConta: string
  grupoConta: string
  tipoContabil: string
  categoriaLabel: string
  confianca: 'alta' | 'media' | 'baixa'
  ignorar: boolean   // transferências internas, aplicações próprias, etc.
}

const CATEGORIAS_DISPONIVEIS = `
RECEITAS:
- 01_RPS.HONORARIOS INICIAIS → Honorário inicial de contrato (créditos de clientes)
- 01_RPS.HONORARIOS MENSAIS → Mensalidade / monitoramento recorrente
- 01_RPS.HONORARIOS DE EXITO → Honorário de êxito
- 01_RPS.INSTALACAO → Instalação de equipamentos
- 01_RPS.MANUTENCAO → Manutenção técnica
- 01_RPS.OUTROS → Outras receitas operacionais

IMPOSTOS:
- 02_IMP.SIMPLES NACIONAL → Simples Nacional, DAS
- 02_IMP.OUTROS → ISS, IRPJ, outros impostos

CUSTOS DIRETOS (do serviço):
- 03_CSP.EQUIPAMENTOS → Compra de câmeras, DVR, cabos, materiais
- 03_CSP.MAO DE OBRA → Técnicos, instaladores, subcontratados
- 03_CSP.MANUTENCAO CORRETIVA → Peças de reparo, visitas técnicas

PESSOAL:
- 04_PES.SALARIOS → Salários, pagamento de funcionários, FGTS, INSS
- 04_PES.PRO LABORE → Pró-labore dos sócios

MARKETING:
- 04_MKT.PUBLICIDADE → Google Ads, Meta Ads, impulsionamento

DESPESAS GERAIS:
- 04_GER.ALUGUEL → Aluguel de imóvel
- 04_GER.COMBUSTIVEL → Gasolina, combustível de veículos
- 04_GER.TELEFONE → Telefone, internet, celular
- 04_GER.SISTEMAS → Softwares, plataformas, assinaturas
- 04_GER.DESPESAS BANCARIAS → Tarifas bancárias, IOF, TED, Pix taxa
- 04_GER.VEICULOS → IPVA, seguro de carro, manutenção de frota
- 04_GER.OUTROS → Outras despesas administrativas

RETIRADA:
- 05_RET.RETIRADA → Retirada dos sócios, distribuição de lucros

FINANCEIRO:
- 06_DRF.JUROS PAGOS → Juros de empréstimo, cheque especial
- 06_DRF.RECEITA JUROS → Rendimento de aplicação, CDB

IGNORAR (não lançar):
- IGNORAR → Transferência entre contas próprias, aplicação/resgate CDB, estorno do próprio banco
`

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
}

export async function categorizarTransacoes(
  transacoes: TransacaoExtrato[],
  nomeEmpresa: string,
  setor: string = 'segurança eletrônica'
): Promise<TransacaoCategorizada[]> {

  if (transacoes.length === 0) return []

  // Processar em lotes de 30 para não ultrapassar limite de tokens
  const lotes: TransacaoExtrato[][] = []
  for (let i = 0; i < transacoes.length; i += 30) {
    lotes.push(transacoes.slice(i, i + 30))
  }

  const resultados: TransacaoCategorizada[] = []

  for (const lote of lotes) {
    const lista = lote.map((t, i) =>
      `${i + 1}. [${t.tipo === 'credito' ? 'CRÉDITO' : 'DÉBITO'}] R$ ${t.valor.toFixed(2)} | ${t.descricao} | ${t.data.toLocaleDateString('pt-BR')}`
    ).join('\n')

    const prompt = `Você é um contador especialista em classificar transações bancárias para empresas de ${setor}.

Empresa: ${nomeEmpresa}
Setor: ${setor}

CATEGORIAS DISPONÍVEIS:
${CATEGORIAS_DISPONIVEIS}

TRANSAÇÕES DO EXTRATO:
${lista}

Para cada transação, responda EXATAMENTE no formato JSON abaixo (array com ${lote.length} itens):
[
  {
    "n": 1,
    "planoConta": "04_GER.COMBUSTIVEL",
    "label": "Combustível",
    "confianca": "alta",
    "ignorar": false
  },
  ...
]

Regras:
- Use APENAS os códigos de planoConta da lista acima
- "ignorar": true para transferências entre contas próprias, aplicações/resgates do mesmo titular, estornos
- "confianca": "alta" se certeza, "media" se provavelmente certo, "baixa" se chute
- Créditos de clientes = 01_RPS.*
- PIX recebido sem identificação = 01_RPS.OUTROS (confianca: baixa)
- Tarifas, TED, Pix enviado a fornecedor = 04_GER.DESPESAS BANCARIAS
- Não invente categorias fora da lista

Responda APENAS o JSON, sem texto antes ou depois.`

    try {
      const msg = await getAnthropic().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'

      // Extrair JSON mesmo se vier com texto ao redor
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      const categorias: any[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

      for (let i = 0; i < lote.length; i++) {
        const t = lote[i]
        const cat = categorias.find(c => c.n === i + 1) || {}
        const planoConta = cat.planoConta || (t.tipo === 'credito' ? '01_RPS.OUTROS' : '04_GER.OUTROS')
        const prefixo = planoConta.split('.')[0]

        const TIPO_MAP: Record<string, string> = {
          '01_RPS': 'receita', '01_ROB': 'receita', '01_ROP': 'receita',
          '02_IMP': 'imposto',
          '03_CSP': 'custo_direto',
          '04_PES': 'pessoal',
          '04_MKT': 'marketing',
          '04_GER': 'geral',
          '05_RET': 'retirada',
          '06_DRF': 'financeiro',
          '07_DLC': 'distribuicao',
          '08_INV': 'investimento',
          '09_EMP': 'emprestimo',
          '10_APL': 'aplicacao',
          '11_APT': 'aporte',
          '12_PCI': 'parcelamento',
        }

        resultados.push({
          ...t,
          planoConta,
          grupoConta: prefixo,
          tipoContabil: TIPO_MAP[prefixo] || 'geral',
          categoriaLabel: cat.label || planoConta.split('.')[1] || 'Outros',
          confianca: cat.confianca || 'baixa',
          ignorar: cat.ignorar || false,
        })
      }
    } catch (err) {
      // Fallback sem IA: categorização básica por tipo
      for (const t of lote) {
        const planoConta = t.tipo === 'credito' ? '01_RPS.OUTROS' : '04_GER.OUTROS'
        resultados.push({
          ...t,
          planoConta,
          grupoConta: t.tipo === 'credito' ? '01_RPS' : '04_GER',
          tipoContabil: t.tipo === 'credito' ? 'receita' : 'geral',
          categoriaLabel: t.tipo === 'credito' ? 'Receita' : 'Despesa Geral',
          confianca: 'baixa',
          ignorar: false,
        })
      }
    }
  }

  return resultados
}
