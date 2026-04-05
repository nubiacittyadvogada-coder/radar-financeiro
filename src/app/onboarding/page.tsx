'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [modos, setModos] = useState<string[]>([])
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [telefoneAlerta, setTelefoneAlerta] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    const usuario = JSON.parse(u)
    if (usuario.tipo !== 'usuario') { router.push('/login'); return }
    // Se já tem modos configurados, redireciona (respeitando ?redirect)
    const params = new URLSearchParams(window.location.search)
    const redirectUrl = params.get('redirect')
    const plano = params.get('plano')
    if (usuario.temEmpresa || usuario.temPessoal) {
      if (redirectUrl && plano) {
        router.push(`${redirectUrl}?plano=${plano}`)
      } else if (usuario.temEmpresa) {
        router.push('/empresa/dashboard')
      } else {
        router.push('/pessoal/dashboard')
      }
      return
    }
  }, [router])

  function toggleModo(m: string) {
    setModos((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])
  }

  async function handleContinuar() {
    if (modos.length === 0) { setErro('Selecione pelo menos um modo'); return }
    if (modos.includes('empresa') && !nomeEmpresa.trim()) {
      setErro('Informe o nome da empresa')
      return
    }
    setErro('')
    setLoading(true)

    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch('/api/v2/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          modos,
          empresa: modos.includes('empresa') ? { nomeEmpresa, telefoneAlerta } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)

      localStorage.setItem('radar_token', data.token)
      localStorage.setItem('radar_usuario', JSON.stringify(data.usuario))

      const params = new URLSearchParams(window.location.search)
      const redirectUrl = params.get('redirect')
      const plano = params.get('plano')

      if (redirectUrl && plano) {
        router.push(`${redirectUrl}?plano=${plano}`)
      } else if (modos.includes('empresa')) {
        router.push('/empresa/dashboard')
      } else {
        router.push('/pessoal/dashboard')
      }
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Como você quer usar o Radar?</h1>
            <p className="text-gray-500 mt-2">Selecione um ou ambos os modos</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => toggleModo('empresa')}
              className={`p-6 rounded-xl border-2 text-left transition ${
                modos.includes('empresa')
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-3">🏢</div>
              <div className="font-semibold text-gray-900">Empresa</div>
              <div className="text-sm text-gray-500 mt-1">
                DRE, contas a pagar, IA financeira, cobrança de inadimplentes
              </div>
            </button>

            <button
              onClick={() => toggleModo('pessoal')}
              className={`p-6 rounded-xl border-2 text-left transition ${
                modos.includes('pessoal')
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-3">👤</div>
              <div className="font-semibold text-gray-900">Pessoal</div>
              <div className="text-sm text-gray-500 mt-1">
                Transações, orçamento, metas, projetos e conselheira IA
              </div>
            </button>
          </div>

          {modos.includes('empresa') && (
            <div className="space-y-4 mb-6 p-4 bg-blue-50 rounded-xl">
              <h3 className="font-medium text-gray-800">Dados da empresa</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da empresa *
                </label>
                <input
                  type="text"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  placeholder="Ex: NC Advogados"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp para alertas
                </label>
                <input
                  type="text"
                  value={telefoneAlerta}
                  onChange={(e) => setTelefoneAlerta(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  placeholder="5531999096712"
                />
                <p className="text-xs text-gray-500 mt-1">Formato internacional: 55 + DDD + número</p>
              </div>
            </div>
          )}

          {erro && (
            <div className="mb-4 bg-red-50 text-red-600 px-4 py-2.5 rounded-lg text-sm">{erro}</div>
          )}

          <button
            onClick={handleContinuar}
            disabled={loading || modos.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Configurando...' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
