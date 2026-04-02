'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda, formatarPercentual, MESES } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function EmpresaHistoricoPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ultimos, setUltimos] = useState(12)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/v2/empresa/historico?ultimos=${ultimos}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setHistorico(await res.json())
    setLoading(false)
  }, [token, ultimos])

  useEffect(() => { carregar() }, [carregar])

  const grafico = historico.map((h) => ({
    mes: `${MESES[h.mes]}/${String(h.ano).slice(2)}`,
    receita: Number(h.receitaBruta),
    lucro: Number(h.lucroLiquido),
    margem: Number(h.margemContribuicao),
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Histórico Financeiro</h1>
        <select
          value={ultimos}
          onChange={(e) => setUltimos(+e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
          <option value={24}>Últimos 24 meses</option>
        </select>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : historico.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Nenhum dado disponível ainda.</div>
        ) : (
          <>
            {/* Gráfico */}
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <h2 className="font-semibold text-gray-800 mb-4">Evolução mensal</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={grafico} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatarMoeda(v)} />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro Líquido" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Mês</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Receita Bruta</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Rec. Líquida</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Margem</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Lucro Líq.</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">% Lucro</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...historico].reverse().map((h, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/empresa/dashboard?mes=${h.mes}&ano=${h.ano}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{MESES[h.mes]} {h.ano}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatarMoeda(h.receitaBruta)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatarMoeda(h.receitaLiquida)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatarMoeda(h.margemContribuicao)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${Number(h.lucroLiquido) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatarMoeda(h.lucroLiquido)}
                      </td>
                      <td className={`px-4 py-3 text-right ${Number(h.percLucroLiq) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatarPercentual(h.percLucroLiq)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
