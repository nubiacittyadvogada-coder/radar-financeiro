'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda, MESES } from '@/lib/utils'

export default function PessoalOrcamentoPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ categoriaId: '', valorMeta: '' })

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarCategorias(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/v2/pessoal/orcamento?mes=${mes}&ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setOrcamentos(await res.json())
    setLoading(false)
  }, [token, mes, ano])

  useEffect(() => { carregar() }, [carregar])

  async function carregarCategorias(t: string) {
    const res = await fetch('/api/v2/pessoal/categorias', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setCategorias(await res.json())
  }

  async function salvarOrcamento() {
    if (!token || !form.categoriaId || !form.valorMeta) return
    const res = await fetch('/api/v2/pessoal/orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ categoriaId: form.categoriaId, mes, ano, valorMeta: Number(form.valorMeta) }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ categoriaId: '', valorMeta: '' })
      carregar()
    }
  }

  async function remover(id: string) {
    if (!token) return
    await fetch(`/api/v2/pessoal/orcamento?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    carregar()
  }

  const totalMeta = orcamentos.reduce((s, o) => s + Number(o.valorMeta), 0)
  const totalGasto = orcamentos.reduce((s, o) => s + (o.valorGastoReal || 0), 0)

  const catSemOrcamento = categorias.filter(
    (c) => c.tipo === 'despesa' && !orcamentos.find((o) => o.categoriaId === c.id)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orçamento</h1>
          <p className="text-sm text-gray-500">
            Meta: {formatarMoeda(totalMeta)} · Gasto: {formatarMoeda(totalGasto)}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={`${mes}-${ano}`}
            onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={`${i + 1}-${ano}`}>{MESES[i + 1]} {ano}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Meta
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Resumo */}
        {orcamentos.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Meta total', value: totalMeta, color: 'text-gray-800' },
              { label: 'Gasto até agora', value: totalGasto, color: 'text-gray-800' },
              { label: 'Disponível', value: totalMeta - totalGasto, color: totalMeta - totalGasto >= 0 ? 'text-green-600' : 'text-red-500' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border text-center">
                <div className="text-xs text-gray-500 mb-1">{k.label}</div>
                <div className={`text-lg font-bold ${k.color}`}>{formatarMoeda(k.value)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h2 className="font-bold mb-4">Definir meta de orçamento</h2>
              <div className="space-y-3">
                <select
                  value={form.categoriaId}
                  onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Selecionar categoria *</option>
                  {catSemOrcamento.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Valor da meta (R$) *"
                  value={form.valorMeta}
                  onChange={(e) => setForm({ ...form, valorMeta: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                <button onClick={salvarOrcamento} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : orcamentos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-500 mb-4">Nenhuma meta definida para {MESES[mes]}/{ano}.</p>
            <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium">
              Definir metas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orcamentos.map((o) => {
              const gasto = o.valorGastoReal || 0
              const meta = Number(o.valorMeta)
              const pct = meta > 0 ? Math.min(100, (gasto / meta) * 100) : 0
              const estourou = pct >= 100
              const quaseEstourou = pct >= 80 && pct < 100

              return (
                <div key={o.id} className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">{o.categoria?.nome}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        estourou ? 'bg-red-100 text-red-600' :
                        quaseEstourou ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {pct.toFixed(0)}%
                      </span>
                      <button onClick={() => remover(o.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${estourou ? 'bg-red-500' : quaseEstourou ? 'bg-yellow-400' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Gasto: <strong className={estourou ? 'text-red-500' : 'text-gray-700'}>{formatarMoeda(gasto)}</strong></span>
                    <span>Meta: <strong className="text-gray-700">{formatarMoeda(meta)}</strong></span>
                    <span>Restante: <strong className={estourou ? 'text-red-500' : 'text-gray-700'}>{formatarMoeda(meta - gasto)}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
