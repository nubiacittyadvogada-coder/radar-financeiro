'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MESES } from '@/lib/utils'

export default function RelatorioPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    setUsuario(JSON.parse(u))
  }, [router])

  // Limpa blob URL anterior quando muda mês/ano
  useEffect(() => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
    }
    setErro('')
  }, [mes, ano])

  async function gerarPdf() {
    if (!usuario) return
    setLoading(true)
    setErro('')
    if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null) }

    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch(`/api/relatorio/${usuario.id}?mes=${mes}&ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ erro: `Erro ${res.status}` }))
        throw new Error(data.erro || `Erro ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  function baixar() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `relatorio-${MESES[mes]}-${ano}.pdf`
    a.click()
  }

  if (!usuario) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700">&larr; Voltar</button>
          <h1 className="text-xl font-bold">Relatório Mensal</h1>
        </div>
        <select
          value={`${mes}-${ano}`}
          onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={`${i + 1}-${ano}`}>{MESES[i + 1]} {ano}</option>
          ))}
        </select>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border text-center">
          <h2 className="text-lg font-semibold mb-4">
            Relatório de {MESES[mes]} / {ano}
          </h2>

          {erro && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {erro}
            </div>
          )}

          <div className="flex justify-center gap-4">
            <button
              onClick={gerarPdf}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Gerando PDF...' : blobUrl ? '↺ Recarregar PDF' : '📄 Gerar PDF'}
            </button>
            {blobUrl && (
              <>
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  Abrir em nova aba
                </a>
                <button
                  onClick={baixar}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
                >
                  ⬇ Download
                </button>
              </>
            )}
          </div>
        </div>

        {blobUrl && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ height: '80vh' }}>
            <iframe
              src={blobUrl}
              className="w-full h-full"
              title="Relatório PDF"
            />
          </div>
        )}
      </main>
    </div>
  )
}
