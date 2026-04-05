import Link from 'next/link'

const planos = [
  {
    key: 'basico',
    nome: 'Básico',
    preco: 'Grátis',
    precoSub: 'para sempre',
    cor: 'gray',
    destaque: false,
    recursos: [
      '1 modo ativo (Pessoal ou Empresa)',
      'Até 3 importações por mês',
      'Dashboard e transações',
      'Orçamento mensal básico',
    ],
    nao: [
      'Conselheira IA',
      'Relatório PDF',
      'Controle de parcelas CC',
      'Modo multi-entidade',
    ],
    cta: null,
    ctaHref: '/cadastro',
  },
  {
    key: 'pro',
    nome: 'Pro',
    preco: 'R$ 29,90',
    precoSub: 'por mês',
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
    nao: [],
    cta: 'Assinar Pro',
    ctaHref: '/login?plano=pro',
  },
  {
    key: 'premium',
    nome: 'Premium',
    preco: 'R$ 49,90',
    precoSub: 'por mês',
    cor: 'green',
    destaque: false,
    recursos: [
      'Tudo do plano Pro',
      'Conselheira IA ilimitada',
      'Multi-entidade (Pessoal / Lar / PJ)',
      'Análises avançadas por entidade',
      'Suporte prioritário via WhatsApp',
      'Acesso antecipado a novas features',
    ],
    nao: [],
    cta: 'Assinar Premium',
    ctaHref: '/login?plano=premium',
  },
]

const faq = [
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Você cancela quando quiser, sem multas. Seu acesso ao plano pago fica ativo até o final do período já pago.',
  },
  {
    q: 'Quais formas de pagamento são aceitas?',
    a: 'PIX, boleto bancário e cartão de crédito. Todos processados via Asaas, plataforma brasileira de pagamentos.',
  },
  {
    q: 'O que acontece se eu não renovar?',
    a: 'Seu plano volta automaticamente para o Básico (gratuito). Seus dados ficam salvos.',
  },
  {
    q: 'Posso fazer upgrade ou downgrade de plano?',
    a: 'Sim, a qualquer momento. Ao fazer upgrade, o novo plano entra em vigor imediatamente. Ao fazer downgrade, a mudança ocorre no próximo ciclo.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Sim. Todos os dados são armazenados em banco de dados criptografado no Brasil (NeonDB). Nunca compartilhamos suas informações financeiras com terceiros.',
  },
]

export default function PlanosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="py-6 px-4 border-b bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg">
            Radar Financeiro
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Entrar →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          Escolha o plano ideal para você
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Comece grátis e evolua quando precisar. Sem surpresas, sem letras miúdas.
        </p>
      </section>

      {/* Planos */}
      <section className="px-4 pb-20 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {planos.map((plano) => (
            <div
              key={plano.key}
              className={`relative rounded-2xl border-2 p-7 flex flex-col ${
                plano.destaque
                  ? 'border-blue-500 shadow-xl bg-white'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plano.destaque && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
                    Mais Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">{plano.nome}</h2>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-gray-900">{plano.preco}</span>
                  <span className="text-gray-400 text-sm ml-1">{plano.precoSub}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plano.recursos.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>
                    {r}
                  </li>
                ))}
                {plano.nao.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-gray-300 font-bold mt-0.5 shrink-0">✕</span>
                    {r}
                  </li>
                ))}
              </ul>

              {plano.cta ? (
                <Link
                  href={plano.ctaHref}
                  className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition ${
                    plano.destaque
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {plano.cta}
                </Link>
              ) : (
                <Link
                  href={plano.ctaHref}
                  className="w-full text-center py-3 rounded-xl font-semibold text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                >
                  Começar grátis
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-20 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          Perguntas frequentes
        </h2>
        <div className="space-y-6">
          {faq.map((item) => (
            <div key={item.q} className="border-b pb-5">
              <h3 className="font-semibold text-gray-900 mb-1.5">{item.q}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 text-center text-sm text-gray-400">
        <div className="space-x-4">
          <Link href="/termos" className="hover:text-gray-600">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-gray-600">Política de privacidade</Link>
          <Link href="/login" className="hover:text-gray-600">Entrar</Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} Radar Financeiro — Todos os direitos reservados</p>
      </footer>
    </div>
  )
}
