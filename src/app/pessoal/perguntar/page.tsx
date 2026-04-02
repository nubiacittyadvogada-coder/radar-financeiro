'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MESES } from '@/lib/utils'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function PessoalPerguntarPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [pergunta, setPergunta] = useState('')
  const [loading, setLoading] = useState(false)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarHistorico(t)
  }, [router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function carregarHistorico(t: string) {
    const res = await fetch('/api/v2/pessoal/perguntar', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) {
      const data = await res.json()
      const flat: Msg[] = []
      data.slice().reverse().forEach((c: any) => {
        flat.push({ role: 'user', content: c.pergunta })
        flat.push({ role: 'assistant', content: c.resposta })
      })
      setMsgs(flat)
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!pergunta.trim() || !token) return
    const p = pergunta
    setPergunta('')
    setMsgs((prev) => [...prev, { role: 'user', content: p }])
    setLoading(true)
    try {
      const res = await fetch('/api/v2/pessoal/perguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pergunta: p, mes, ano }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setMsgs((prev) => [...prev, { role: 'assistant', content: data.resposta }])
    } catch (err: any) {
      setMsgs((prev) => [...prev, { role: 'assistant', content: `Erro: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const sugestoes = [
    'Estou gastando mais do que deveria?',
    'Em qual categoria estou gastando mais?',
    'Como posso economizar mais este mês?',
    'Estou no caminho certo para atingir minhas metas?',
    'O que posso cortar para guardar mais?',
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Conselheira IA</h1>
          <p className="text-sm text-gray-500">Pergunte sobre suas finanças pessoais</p>
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

      <div className="flex-1 overflow-auto px-4 py-6 max-w-3xl mx-auto w-full">
        {msgs.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💚</div>
            <p className="text-gray-500 mb-6">Sua conselheira financeira pessoal. Pergunte qualquer coisa!</p>
            <div className="grid grid-cols-1 gap-2">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  onClick={() => setPergunta(s)}
                  className="text-left px-4 py-2.5 bg-white border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-sm'
                  : 'bg-white border text-gray-800 rounded-bl-sm shadow-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-gray-400">
                Analisando suas finanças...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="bg-white border-t px-4 py-4 max-w-3xl mx-auto w-full">
        <form onSubmit={enviar} className="flex gap-3">
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Faça sua pergunta..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !pergunta.trim()}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}
