'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

export default function PessoalConfiguracoesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)
  const [form, setForm] = useState({
    metaEconomiasMensal: '',
    diaFechamento: '1',
  })

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregar(t)
  }, [router])

  async function carregar(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/pessoal/configuracoes', {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (res.ok) {
      const data = await res.json()
      setForm({
        metaEconomiasMensal: data.metaEconomiasMensal ? String(data.metaEconomiasMensal) : '',
        diaFechamento: String(data.diaFechamento || 1),
      })
    }
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSalvando(true)
    setOk(false)
    const res = await fetch('/api/v2/pessoal/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        metaEconomiasMensal: form.metaEconomiasMensal || null,
        diaFechamento: Number(form.diaFechamento),
      }),
    })
    setSalvando(false)
    if (res.ok) setOk(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Configurações Pessoais</h1>
        <p className="text-sm text-gray-500">Preferências da sua conta pessoal</p>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : (
          <form onSubmit={salvar} className="space-y-6">
            {/* Meta de economia */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="font-semibold text-gray-800 mb-1">Meta de economia mensal</h2>
              <p className="text-sm text-gray-500 mb-4">
                Quanto você quer poupar por mês. Aparece no dashboard e nas sugestões da IA.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.metaEconomiasMensal}
                  onChange={(e) => setForm({ ...form, metaEconomiasMensal: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              {form.metaEconomiasMensal && Number(form.metaEconomiasMensal) > 0 && (
                <p className="text-xs text-green-600 mt-2">
                  Meta: {formatarMoeda(Number(form.metaEconomiasMensal))} / mês
                </p>
              )}
            </div>

            {/* Dia de fechamento */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="font-semibold text-gray-800 mb-1">Dia de fechamento do período</h2>
              <p className="text-sm text-gray-500 mb-4">
                Dia do mês em que começa um novo período financeiro. Padrão: dia 1.
              </p>
              <select
                value={form.diaFechamento}
                onChange={(e) => setForm({ ...form, diaFechamento: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Dia {i + 1}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                Limitado ao dia 28 para funcionar em todos os meses.
              </p>
            </div>

            {ok && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                Configurações salvas com sucesso.
              </div>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
