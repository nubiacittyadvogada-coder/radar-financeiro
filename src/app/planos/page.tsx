'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

function CupomInput({ planoKey }: { planoKey: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle')
  const [mensagem, setMensagem] = useState('')
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null)

  useEffect(() => {
    try {
      const u = localStorage.getItem('radar_usuario')
      const t = localStorage.getItem('radar_token')
      if (u && t) setUsuarioLogado({ usuario: JSON.parse(u), token: t })
    } catch {}
  }, [])

  async function handleAplicar() {
    const cod = codigo.toUpperCase().trim()
    if (!cod) return

    if (!usuarioLogado) {
      // Redireciona para cadastro com plano e cupom
      router.push(`/cadastro?plano=${planoKey}&cupom=${cod}`)
      return
    }

    setStatus('loading')
    setMensagem('')
    try {
      const res = await fetch(`/api/v2/assinatura/cupom?codigo=${cod}`, {
        headers: { Authorization: `Bearer ${usuarioLogado.token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('erro')
        setMensagem(data.erro || 'Cupom inválido')
        return
      }
      setStatus('ok')
      setMensagem(data.descricao || `${data.diasTrial} dias grátis no plano ${planoKey}!`)

      // Se trial, aplica direto
      if (data.tipo === 'trial') {
        const assinarRes = await fetch('/api/v2/assinatura/assinar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${usuarioLogado.token}`,
          },
          body: JSON.stringify({ plano: planoKey, cupomCodigo: cod }),
        })
        const assinarData = await assinarRes.json()
        if (assinarData.trial) {
          setMensagem(`Trial ativado! Plano ${planoKey} grátis por ${data.diasTrial} dias.`)
          setTimeout(() => router.push('/pessoal/dashboard'), 2000)
        }
      }
    } catch {
      setStatus('erro')
      setMensagem('Erro ao validar cupom')
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition"
      >
        {aberto ? '▲ Fechar cupom' : '🏷️ Tem um cupom?'}
      </button>

      {aberto && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setStatus('idle'); setMensagem('') }}
            placeholder="Ex: TESTE30"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-green-400 transition"
            onKeyDown={(e) => e.key === 'Enter' && handleAplicar()}
          />
          <button
            type="button"
            onClick={handleAplicar}
            disabled={status === 'loading' || !codigo.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            {status === 'loading' ? '...' : 'Aplicar'}
          </button>
        </div>
      )}

      {mensagem && (
        <p className={`mt-1.5 text-xs font-medium ${status === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
          {status === 'ok' ? '✓ ' : '✕ '}{mensagem}
        </p>
      )}
    </div>
  )
}

export default function PlanosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="py-6 px-4 border-b bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <span>📊</span>
            <span>Radar Financeiro</span>
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
                  ? 'border-green-500 shadow-xl bg-white'
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
                <>
                  <Link
                    href={plano.ctaHref}
                    className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition ${
                      plano.destaque
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {plano.cta}
                  </Link>
                  <CupomInput planoKey={plano.key} />
                </>
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
