'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CadastroPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [plano, setPlano] = useState<string | null>(null)
  const [cupom, setCupom] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setPlano(params.get('plano'))
    setCupom(params.get('cupom'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha !== confirmar) { setErro('As senhas não coincidem'); return }
    if (senha.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres'); return }
    setLoading(true)

    try {
      const res = await fetch('/api/v2/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao cadastrar')

      localStorage.setItem('radar_token', data.token)
      localStorage.setItem('radar_usuario', JSON.stringify(data.usuario))
      document.cookie = `radar_sessao=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`

      // Se veio com plano, vai para assinatura. Se tem cupom trial, aplica antes.
      if (plano && cupom) {
        // Tenta aplicar cupom trial diretamente
        try {
          const r = await fetch('/api/v2/assinatura/assinar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
            body: JSON.stringify({ plano, cupomCodigo: cupom }),
          })
          const d = await r.json()
          if (d.trial) {
            router.push('/onboarding?trial=1&plano=' + plano)
            return
          }
        } catch {}
        router.push(`/onboarding?redirect=/pessoal/assinatura&plano=${plano}`)
      } else if (plano) {
        router.push(`/onboarding?redirect=/pessoal/assinatura&plano=${plano}`)
      } else {
        router.push('/onboarding')
      }
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Radar Financeiro</h1>
            {plano ? (
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${plano === 'premium' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {cupom ? `🎟️ Trial grátis — Plano ${plano === 'pro' ? 'Pro' : 'Premium'}` : `⭐ Assinar plano ${plano === 'pro' ? 'Pro' : 'Premium'}`}
                </span>
                <p className="text-gray-400 text-xs mt-1">Crie sua conta para continuar</p>
              </div>
            ) : (
              <p className="text-gray-500 mt-2">Crie sua conta gratuita</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Seu nome"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            {erro && (
              <div className="bg-red-50 text-red-600 px-4 py-2.5 rounded-lg text-sm">{erro}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
