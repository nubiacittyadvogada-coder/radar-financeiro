'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda, MESES } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

export default function ClientePainelPage() {
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [cliente, setCliente] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getCliente(clienteId),
      api.getHistorico(clienteId, 6),
      api.getAlertas(clienteId),
    ])
      .then(([c, h, a]) => { setCliente(c); setHistorico(h); setAlertas(a) })
      .catch(() => router.push('/bpo/dashboard'))
      .finally(() => setLoading(false))
  }, [clienteId, router])

  const ultimo = historico[0]
  const dadosGrafico = [...historico].reverse().map((h) => ({
    periodo: `${MESES[h.mes]?.substring(0, 3)}/${String(h.ano).substring(2)}`,
    receita: Number(h.receitaBruta),
    lucroOp: Number(h.lucroOperacional),
    lucroLiq: Number(h.lucroLiquido),
  }))

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Carregando...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/bpo/dashboard')} className="text-gray-500 hover:text-gray-700">&larr; Voltar</button>
          <div>
            <h1 className="text-xl font-bold">{cliente?.nomeEmpresa}</h1>
            <p className="text-sm text-gray-500">{cliente?.responsavel} — {cliente?.setor}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/bpo/clientes/${clienteId}/importar`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Importar Planilha</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Resumo último período */}
        {ultimo ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Receita Bruta', valor: formatarMoeda(Number(ultimo.receitaBruta)), cor: 'text-blue-600' },
              { label: 'Lucro Operacional', valor: formatarMoeda(Number(ultimo.lucroOperacional)), cor: Number(ultimo.lucroOperacional) >= 0 ? 'text-green-600' : 'text-red-600' },
              { label: 'Lucro Líquido', valor: formatarMoeda(Number(ultimo.lucroLiquido)), cor: Number(ultimo.lucroLiquido) >= 0 ? 'text-green-600' : 'text-red-600' },
              { label: 'Retirada', valor: formatarMoeda(Number(ultimo.retiradaSocios)), cor: 'text-gray-700' },
              { label: 'Caixa Final', valor: ultimo.saldoFinal ? formatarMoeda(Number(ultimo.saldoFinal)) : 'N/D', cor: 'text-cyan-600' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl p-4 shadow-sm border">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-lg font-bold ${item.cor}`}>{item.valor}</p>
                <p className="text-xs text-gray-400 mt-1">{MESES[ultimo.mes]}/{ultimo.ano}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500">Nenhum fechamento disponível. Importe a primeira planilha.</p>
          </div>
        )}

        {/* Gráfico */}
        {dadosGrafico.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Evolução</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="periodo" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                <Line type="monotone" dataKey="receita" stroke="#3b82f6" name="Receita" strokeWidth={2} />
                <Line type="monotone" dataKey="lucroOp" stroke="#10b981" name="Lucro Op." strokeWidth={2} />
                <Line type="monotone" dataKey="lucroLiq" stroke="#f59e0b" name="Lucro Líq." strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Alertas</h2>
            {alertas.map((a: any) => (
              <div key={a.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-medium text-red-800">{a.titulo}</p>
                <p className="text-sm text-red-600 mt-1">{a.mensagem}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabela de histórico */}
        {historico.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Receita</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lucro Op.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lucro Líq.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Caixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{MESES[f.mes]} / {f.ano}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatarMoeda(Number(f.receitaBruta))}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${Number(f.lucroOperacional) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(Number(f.lucroOperacional))}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${Number(f.lucroLiquido) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(Number(f.lucroLiquido))}</td>
                    <td className="px-4 py-3 text-sm text-right">{f.saldoFinal ? formatarMoeda(Number(f.saldoFinal)) : 'N/D'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
