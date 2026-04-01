'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda, MESES } from '@/lib/utils'

export default function HistoricoPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [fechamentos, setFechamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    setUsuario(parsed)
    api.getHistorico(parsed.id, 24)
      .then(setFechamentos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700">&larr; Voltar</button>
        <h1 className="text-xl font-bold">Histórico de Fechamentos</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-gray-500">Carregando...</p>
        ) : fechamentos.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-500">Nenhum fechamento disponível.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Receita</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lucro Op.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lucro Líq.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Caixa</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fechamentos.map((f: any) => (
                  <tr
                    key={f.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => { router.push(`/dashboard?mes=${f.mes}&ano=${f.ano}`) }}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {MESES[f.mes]} / {f.ano}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatarMoeda(Number(f.receitaBruta))}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${Number(f.lucroOperacional) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatarMoeda(Number(f.lucroOperacional))}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${Number(f.lucroLiquido) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatarMoeda(Number(f.lucroLiquido))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {f.saldoFinal ? formatarMoeda(Number(f.saldoFinal)) : 'N/D'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.pdfUrl ? (
                        <a
                          href={api.getRelatorioUrl(usuario?.id || '', f.mes, f.ano)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
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
