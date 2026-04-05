export type PlanoKey = 'basico' | 'pro' | 'premium'

export const PLANOS = {
  basico: {
    nome: 'Básico',
    preco: 0,
    descricao: 'Para começar a organizar suas finanças',
    cor: 'gray',
    recursos: [
      '1 modo ativo (Pessoal ou Empresa)',
      'Até 3 importações por mês',
      'Dashboard e transações',
      'Orçamento mensal básico',
    ],
    limitado: [
      'Sem Conselheira IA',
      'Sem relatório PDF',
      'Sem parcelas CC',
      'Sem modo multi-entidade',
    ],
  },
  pro: {
    nome: 'Pro',
    preco: 29.90,
    descricao: 'Para quem quer controle total',
    cor: 'blue',
    destaque: true,
    recursos: [
      'Modos Pessoal + Empresa simultâneos',
      'Importações ilimitadas (PDF, Excel, Fatura)',
      'Conselheira IA — 30 consultas/mês',
      'Relatório PDF completo',
      'Controle de parcelas CC',
      'Casamento e metas financeiras',
      'Orçamento por titular (casal)',
      'Alertas de vencimento WhatsApp',
    ],
    limitado: [],
  },
  premium: {
    nome: 'Premium',
    preco: 49.90,
    descricao: 'Para o máximo de controle e análise',
    cor: 'green',
    recursos: [
      'Tudo do plano Pro',
      'Conselheira IA ilimitada',
      'Multi-entidade (Pessoal / Lar / PJ)',
      'Análises avançadas por entidade',
      'Suporte prioritário via WhatsApp',
      'Acesso antecipado a novas features',
    ],
    limitado: [],
  },
} as const

export function temAcesso(plano: string, recurso: 'ia' | 'pdf' | 'parcelas' | 'multi_entidade' | 'importacao_ilimitada' | 'ambos_modos'): boolean {
  const p = plano as PlanoKey
  switch (recurso) {
    case 'ia': return p === 'pro' || p === 'premium'
    case 'pdf': return p === 'pro' || p === 'premium'
    case 'parcelas': return p === 'pro' || p === 'premium'
    case 'multi_entidade': return p === 'premium'
    case 'importacao_ilimitada': return p === 'pro' || p === 'premium'
    case 'ambos_modos': return p === 'pro' || p === 'premium'
    default: return false
  }
}
