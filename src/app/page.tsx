'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    try {
      const token = localStorage.getItem('radar_token')
      const usuario = localStorage.getItem('radar_usuario')
      if (token && usuario) {
        setUsuarioLogado(JSON.parse(usuario))
      }
    } catch {}
    setCarregando(false)
  }, [])

  function getDashboardLink(u: any) {
    if (u?.tipo === 'usuario') {
      if (u.temEmpresa) return '/empresa/dashboard'
      return '/pessoal/dashboard'
    }
    if (u?.tipo === 'cliente') return '/dashboard'
    return '/bpo/dashboard'
  }

  const ctaHref = usuarioLogado ? getDashboardLink(usuarioLogado) : '/cadastro'
  const ctaLabel = usuarioLogado ? 'Ir para o app →' : 'Começar grátis'

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-xl text-gray-900 shrink-0">
            <span className="text-2xl">📊</span>
            <span>Radar Financeiro</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#funcionalidades" className="hover:text-green-600 transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-green-600 transition">Planos</a>
            <Link href="/login" className="hover:text-green-600 transition">Entrar</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden md:block text-sm text-gray-600 hover:text-gray-900 transition">
              Entrar
            </Link>
            {!carregando && (
              <Link
                href={ctaHref}
                className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition shadow-sm whitespace-nowrap"
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-green-950 text-white">
        {/* background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-green-700/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-900/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left: copy */}
            <div className="flex-1 text-center lg:text-left max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-full px-4 py-1.5 text-sm font-medium text-green-300 mb-6">
                <span>✨</span>
                <span>Novo: Conselheira IA financeira</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                Seu dinheiro.{' '}
                <span className="text-green-400">Seu controle.</span>{' '}
                Sua decisão.
              </h1>

              <p className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                Importe seus extratos, categorize gastos, defina metas e receba análises da IA — tudo em um só lugar. Para você e sua empresa.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start mb-6">
                <Link
                  href="/cadastro"
                  className="w-full sm:w-auto bg-green-500 hover:bg-green-400 text-white font-bold px-8 py-3.5 rounded-xl transition shadow-lg shadow-green-500/25 text-base"
                >
                  Começar grátis
                </Link>
                <a
                  href="#planos"
                  className="w-full sm:w-auto border border-white/30 hover:border-white/60 text-white font-semibold px-8 py-3.5 rounded-xl transition text-base text-center"
                >
                  Ver planos
                </a>
              </div>

              <p className="text-sm text-gray-500">
                Sem cartão de crédito · Cancele quando quiser · LGPD compliant
              </p>
            </div>

            {/* Right: dashboard mockup */}
            <div className="flex-1 w-full max-w-md lg:max-w-none">
              <div className="relative bg-gray-800/80 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-5 backdrop-blur">
                {/* Mockup header */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-gray-500 font-mono">radar-financeiro.app/pessoal/dashboard</span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-gray-700/60 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Receitas</p>
                    <p className="text-lg font-bold text-green-400">R$ 12.430</p>
                    <p className="text-xs text-green-500 mt-0.5">+8,2% este mês</p>
                  </div>
                  <div className="bg-gray-700/60 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Despesas</p>
                    <p className="text-lg font-bold text-red-400">R$ 8.920</p>
                    <p className="text-xs text-red-400 mt-0.5">-3,1% vs ant.</p>
                  </div>
                  <div className="bg-gray-700/60 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Saldo</p>
                    <p className="text-lg font-bold text-white">R$ 3.510</p>
                    <p className="text-xs text-gray-400 mt-0.5">disponível</p>
                  </div>
                </div>

                {/* Mini bar chart */}
                <div className="bg-gray-700/40 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-300">Fluxo mensal</span>
                    <span className="text-xs text-gray-500">Último trimestre</span>
                  </div>
                  <div className="flex items-end gap-2 h-16">
                    {[
                      { receita: 75, despesa: 60 },
                      { receita: 60, despesa: 70 },
                      { receita: 85, despesa: 55 },
                      { receita: 90, despesa: 65 },
                      { receita: 70, despesa: 50 },
                      { receita: 100, despesa: 72 },
                    ].map((bar, i) => (
                      <div key={i} className="flex-1 flex items-end gap-0.5">
                        <div
                          className="flex-1 bg-green-500/70 rounded-sm"
                          style={{ height: `${bar.receita}%` }}
                        />
                        <div
                          className="flex-1 bg-red-400/60 rounded-sm"
                          style={{ height: `${bar.despesa}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-green-500/70 rounded-sm" />
                      <span className="text-xs text-gray-400">Receitas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-red-400/60 rounded-sm" />
                      <span className="text-xs text-gray-400">Despesas</span>
                    </div>
                  </div>
                </div>

                {/* IA chat preview */}
                <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🤖</span>
                    <span className="text-xs font-semibold text-green-300">Conselheira IA</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    "Seus gastos com alimentação subiram 23% este mês. Sugiro revisar o orçamento da categoria para os próximos 30 dias."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF NUMBERS ── */}
      <section className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <p className="text-center text-sm text-gray-500 font-medium mb-8 uppercase tracking-wider">
            Usado por advogados, autônomos e pequenas empresas
          </p>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-extrabold text-green-600">500+</p>
              <p className="text-sm text-gray-500 mt-1">importações processadas</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-green-600">R$ 2M+</p>
              <p className="text-sm text-gray-500 mt-1">analisados pela plataforma</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-green-600">98%</p>
              <p className="text-sm text-gray-500 mt-1">de satisfação dos usuários</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funcionalidades" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block bg-green-50 text-green-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
            Funcionalidades
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Tudo que você precisa para<br className="hidden sm:block" /> dominar suas finanças
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Do controle pessoal à gestão empresarial — em uma única plataforma intuitiva.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: '📊',
              title: 'Dashboard completo',
              desc: 'Visão geral de receitas, despesas e saldo com gráficos em tempo real. Acompanhe sua evolução mês a mês.',
            },
            {
              icon: '🤖',
              title: 'Conselheira IA',
              desc: 'Faça perguntas sobre suas finanças e receba análises personalizadas com insights acionáveis.',
            },
            {
              icon: '📄',
              title: 'Importação inteligente',
              desc: 'PDF, Excel e fatura de cartão com categorização automática. Sem digitação manual.',
            },
            {
              icon: '💑',
              title: 'Planejamento a dois',
              desc: 'Controle de gastos do casal com visão por titular. Transparência financeira para os dois.',
            },
            {
              icon: '📦',
              title: 'Parcelas CC',
              desc: 'Mapa completo de parcelamentos e compromisso futuro. Saiba exatamente o que está comprometido.',
            },
            {
              icon: '🏢',
              title: 'Modo empresa',
              desc: 'DRE, contas a pagar, cobranças e relatórios PDF profissionais. Ideal para autônomos e escritórios.',
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="group relative bg-white border border-gray-200 rounded-2xl p-6 hover:border-green-300 hover:shadow-lg transition-all duration-200"
            >
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-green-100 transition">
                {feat.icon}
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{feat.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MINI PRICING ── */}
      <section id="planos" className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-green-50 text-green-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              Planos
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
              Preço justo, sem pegadinhas
            </h2>
            <p className="text-lg text-gray-500">
              Comece grátis e faça upgrade quando precisar de mais.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Básico */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7 flex flex-col">
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Básico</p>
                <p className="text-4xl font-extrabold text-gray-900">Grátis</p>
                <p className="text-sm text-gray-400 mt-1">para sempre</p>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Dashboard e transações</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Até 3 importações/mês</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Orçamento mensal básico</li>
                <li className="flex items-center gap-2"><span className="text-gray-300">✕</span> <span className="text-gray-400">Conselheira IA</span></li>
                <li className="flex items-center gap-2"><span className="text-gray-300">✕</span> <span className="text-gray-400">Relatórios PDF</span></li>
              </ul>
              <Link href="/cadastro" className="text-center border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
                Criar conta grátis
              </Link>
            </div>

            {/* Pro */}
            <div className="relative bg-white border-2 border-green-500 rounded-2xl p-7 flex flex-col shadow-xl">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
                  Mais Popular
                </span>
              </div>
              <div className="mb-5">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Pro</p>
                <p className="text-4xl font-extrabold text-gray-900">R$ 29,90</p>
                <p className="text-sm text-gray-400 mt-1">por mês</p>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Pessoal + Empresa simultâneos</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Importações ilimitadas</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Conselheira IA — 30 consultas/mês</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Relatórios PDF completos</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Controle de parcelas CC</li>
              </ul>
              <Link href="/planos" className="text-center bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-sm">
                Assinar Pro
              </Link>
            </div>

            {/* Premium */}
            <div className="bg-white border border-gray-200 rounded-2xl p-7 flex flex-col">
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Premium</p>
                <p className="text-4xl font-extrabold text-gray-900">R$ 49,90</p>
                <p className="text-sm text-gray-400 mt-1">por mês</p>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Tudo do plano Pro</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Conselheira IA ilimitada</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Multi-entidade (Pessoal/Lar/PJ)</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Análises avançadas por entidade</li>
                <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Suporte prioritário WhatsApp</li>
              </ul>
              <Link href="/planos" className="text-center bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-sm">
                Assinar Premium
              </Link>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/planos" className="text-green-600 font-semibold hover:underline text-sm">
              Ver todos os planos e comparação completa →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-green-700 py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Pronto para ter controle financeiro de verdade?
          </h2>
          <p className="text-green-100 text-lg mb-8">
            Comece grátis hoje — sem compromisso
          </p>
          <Link
            href="/cadastro"
            className="inline-block bg-white text-green-700 font-bold px-10 py-4 rounded-xl text-base hover:bg-green-50 transition shadow-lg"
          >
            Criar conta grátis
          </Link>
          <p className="mt-5 text-green-200 text-sm">
            Já tem conta?{' '}
            <Link href="/login" className="underline hover:text-white transition">
              Entre aqui
            </Link>
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-950 text-gray-400 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-bold text-white text-lg mb-1">
              <span>📊</span>
              <span>Radar Financeiro</span>
            </div>
            <p className="text-sm text-gray-500">Controle financeiro inteligente para você e sua empresa.</p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/planos" className="hover:text-white transition">Planos</Link>
            <Link href="/termos" className="hover:text-white transition">Termos</Link>
            <Link href="/privacidade" className="hover:text-white transition">Privacidade</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-gray-800 text-center text-sm text-gray-600">
          © 2026 Radar Financeiro — Todos os direitos reservados.
        </div>
      </footer>
    </div>
  )
}
