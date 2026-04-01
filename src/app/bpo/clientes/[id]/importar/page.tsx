'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda, MESES } from '@/lib/utils'

export default function ImportarPage() {
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [cliente, setCliente] = useState<any>(null)
  const [tipo, setTipo] = useState<'receitas' | 'despesas'>('receitas')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.getCliente(clienteId).then(setCliente).catch(() => router.push('/bpo/dashboard'))
  }, [clienteId, router])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!arquivo) return

    setLoading(true)
    setErro('')
    setResultado(null)

    try {
      const data = await api.uploadPlanilha(clienteId, tipo, mes, ano, arquivo)
      setResultado(data)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/bpo/dashboard')} className="text-gray-500 hover:text-gray-700">&larr; Voltar</button>
        <h1 className="text-xl font-bold">
          Importar Planilha {cliente ? `— ${cliente.nomeEmpresa}` : ''}
        </h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <form onSubmit={handleUpload} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo da planilha</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTipo('receitas')}
                className={`flex-1 py-3 rounded-lg border-2 font-medium transition ${
                  tipo === 'receitas' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                Receitas
              </button>
              <button
                type="button"
                onClick={() => setTipo('despesas')}
                className={`flex-1 py-3 rounded-lg border-2 font-medium transition ${
                  tipo === 'despesas' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                Despesas
              </button>
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
              <select value={mes} onChange={(e) => setMes(+e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                {MESES.slice(1).map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <select value={ano} onChange={(e) => setAno(+e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                {[2024, 2025, 2026].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {erro && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{erro}</div>}

          <button
            type="submit"
            disabled={loading || !arquivo}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Processar Planilha'}
          </button>
        </form>

        {/* Resultado */}
        {resultado && (
          <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
            <h2 className="text-lg font-semibold text-green-700">Importação concluída</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-sm text-gray-500">Total linhas</p>
                <p className="text-xl font-bold">{resultado.totalLinhas}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <p className="text-sm text-gray-500">Processadas</p>
                <p className="text-xl font-bold text-green-600">{resultado.linhasProcessadas}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-xl font-bold text-blue-600">{resultado.status}</p>
              </div>
            </div>

            {resultado.erros && (
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-amber-700 mb-1">Erros de processamento:</p>
                <pre className="text-xs text-amber-600 whitespace-pre-wrap">{resultado.erros}</pre>
              </div>
            )}

            {resultado.fechamento && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Fechamento Calculado</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Receita Bruta:</span><span className="font-medium">{formatarMoeda(Number(resultado.fechamento.receitaBruta))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Receita Líquida:</span><span className="font-medium">{formatarMoeda(Number(resultado.fechamento.receitaLiquida))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Margem:</span><span className="font-medium">{Number(resultado.fechamento.percMargem).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Lucro Operacional:</span><span className={`font-medium ${Number(resultado.fechamento.lucroOperacional) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(Number(resultado.fechamento.lucroOperacional))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Lucro Líquido:</span><span className={`font-medium ${Number(resultado.fechamento.lucroLiquido) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(Number(resultado.fechamento.lucroLiquido))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Retirada Sócios:</span><span className="font-medium">{formatarMoeda(Number(resultado.fechamento.retiradaSocios))}</span></div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
