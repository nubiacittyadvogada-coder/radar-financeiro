'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MESES } from '@/lib/utils'

export default function RelatorioPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [modo, setModo] = useState<'mensal' | 'anual'>('mensal')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [baixando, setBaixando] = useState<string | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    if (JSON.parse(u).tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  async function baixar(tipo: 'excel' | 'pdf') {
    if (!token) return
    setBaixando(tipo)
    const params = new URLSearchParams({ tipo, modo, ano: String(ano), ...(modo === 'mensal' ? { mes: String(mes) } : {}) })
    const res = await fetch(`/api/v2/pessoal/relatorio?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) { alert('Erro ao gerar relatório'); setBaixando(null); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = tipo === 'excel'
      ? `financas-${modo === 'mensal' ? `${MESES[mes]}-${ano}` : ano}.xlsx`
      : `financas-${modo === 'mensal' ? `${MESES[mes]}-${ano}` : ano}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setBaixando(null)
  }

  const anos = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Exportar Relatório</h1>
        <p className="text-sm text-gray-500">Baixe seus dados em Excel ou PDF</p>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Modo */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Período</h2>
          <div className="flex rounded-lg border overflow-hidden text-sm mb-4 w-fit">
            <button onClick={() => setModo('mensal')} className={`px-5 py-2 font-medium ${modo === 'mensal' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Mensal</button>
            <button onClick={() => setModo('anual')} className={`px-5 py-2 font-medium ${modo === 'anual' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Anual</button>
          </div>

          {modo === 'mensal' ? (
            <div className="flex gap-3">
              <select value={mes} onChange={(e) => setMes(+e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{MESES[i + 1]}</option>
                ))}
              </select>
              <select value={ano} onChange={(e) => setAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          ) : (
            <select value={ano} onChange={(e) => setAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm w-full">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        {/* O que inclui */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">O relatório inclui</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>✓ Resumo: receitas, despesas, saldo, taxa de poupança</li>
            <li>✓ Detalhamento por categoria</li>
            <li>✓ Lista completa de transações do extrato</li>
            {modo === 'mensal' && <li>✓ Fatura do cartão de crédito (se importada)</li>}
            {modo === 'anual' && <li>✓ Tabela mês a mês com totais anuais</li>}
            {modo === 'anual' && <li>✓ Ranking de categorias no ano (Excel)</li>}
          </ul>
        </div>

        {/* Botões de download */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => baixar('excel')}
            disabled={!!baixando}
            className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl border-2 border-green-200 hover:border-green-400 hover:shadow-md transition disabled:opacity-50"
          >
            <span className="text-4xl">📊</span>
            <div className="text-center">
              <div className="font-semibold text-gray-800">Excel (.xlsx)</div>
              <div className="text-xs text-gray-500 mt-0.5">Múltiplas abas, fácil de filtrar</div>
            </div>
            {baixando === 'excel' && <span className="text-xs text-green-600 animate-pulse">Gerando...</span>}
          </button>

          <button
            onClick={() => baixar('pdf')}
            disabled={!!baixando}
            className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl border-2 border-red-200 hover:border-red-400 hover:shadow-md transition disabled:opacity-50"
          >
            <span className="text-4xl">📄</span>
            <div className="text-center">
              <div className="font-semibold text-gray-800">PDF</div>
              <div className="text-xs text-gray-500 mt-0.5">Pronto para imprimir ou compartilhar</div>
            </div>
            {baixando === 'pdf' && <span className="text-xs text-red-600 animate-pulse">Gerando...</span>}
          </button>
        </div>

        <p className="text-xs text-center text-gray-400">
          Os arquivos são gerados direto nos seus dados e não ficam salvos em nenhum servidor.
        </p>
      </main>
    </div>
  )
}
