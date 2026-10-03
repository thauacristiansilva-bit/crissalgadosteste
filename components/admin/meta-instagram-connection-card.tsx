"use client"

import {
  useEffect,
  useState,
} from "react"

import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Unplug,
} from "lucide-react"

type Connection = {
  connected: boolean
  pageName?: string
  username?: string
  accountType?: string
  tokenExpiresAt?: string | null
  connectedAt?: string | null
}

export function MetaInstagramConnectionCard() {
  const [
    configured,
    setConfigured,
  ] = useState(false)

  const [
    connection,
    setConnection,
  ] =
    useState<Connection | null>(
      null,
    )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    message,
    setMessage,
  ] = useState("")

  async function refresh() {
    setLoading(true)

    try {
      const response =
        await fetch(
          "/api/meta/instagram/status",
          {
            cache: "no-store",
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Erro ao verificar Instagram.",
        )
      }

      setConfigured(
        Boolean(data.configured),
      )

      setConnection(
        data.connection ||
        null,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao verificar Instagram.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function disconnect() {
    if (
      !window.confirm(
        "Desconectar o Instagram desta empresa?",
      )
    ) {
      return
    }

    const response =
      await fetch(
        "/api/meta/instagram/disconnect",
        {
          method: "POST",
        },
      )

    const data =
      await response.json()

    if (!response.ok) {
      setMessage(
        data.error ||
        "Nao foi possivel desconectar.",
      )
      return
    }

    setConnection(null)
    setMessage(
      "Instagram desconectado.",
    )
  }

  const connected =
    Boolean(connection?.connected)

  return (
    <section className="rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-orange-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-fuchsia-700">
            Publicacao automatica
          </p>

          <h2 className="mt-1 text-lg font-black text-gray-950">
            Instagram
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
            Conexao direta pelo
            Instagram Business Login.
            Nao depende de Pagina do
            Facebook. Feed e Story
            entram na fila automatica
            do Sabor Flow.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>

              <button
                type="button"
                onClick={disconnect}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700"
              >
                <Unplug className="h-4 w-4" />
                Desconectar
              </button>
            </>
          ) : (
            <a
              href="/api/meta/instagram/connect"
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-white ${
                configured
                  ? "bg-fuchsia-600 hover:bg-fuchsia-700"
                  : "pointer-events-none bg-gray-400"
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              Conectar Instagram
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white bg-white/80 p-3">
          <span className="text-[11px] font-black uppercase text-gray-400">
            Estado
          </span>

          <div className="mt-1 flex items-center gap-2 text-sm font-black">
            {connected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Conectado
              </>
            ) : configured ? (
              "Aguardando conexao"
            ) : (
              "Instagram Login ainda nao configurado no Railway"
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white bg-white/80 p-3">
          <span className="text-[11px] font-black uppercase text-gray-400">
            Conta
          </span>

          <p className="mt-1 text-sm font-black text-gray-800">
            {connection?.username
              ? `@${connection.username}`
              : "Nenhuma conta"}
          </p>
        </div>

        <div className="rounded-xl border border-white bg-white/80 p-3">
          <span className="text-[11px] font-black uppercase text-gray-400">
            Automacao
          </span>

          <p className="mt-1 text-sm font-black text-gray-800">
            Feed + Story
          </p>
        </div>
      </div>

      {!configured && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          Configure no Railway:
          META_INSTAGRAM_APP_ID,
          META_INSTAGRAM_APP_SECRET,
          META_TOKEN_ENCRYPTION_KEY
          e APP_PUBLIC_URL.
          Mantenha META_APP_ID e
          META_APP_SECRET existentes
          para as outras integracoes.
        </div>
      )}

      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-800">
        O Status do WhatsApp continua
        assistido. O Sabor Flow nao
        tenta automatizar o Status por
        meios nao oficiais.
      </div>

      {message && (
        <p className="mt-3 text-xs font-bold text-gray-700">
          {message}
        </p>
      )}
    </section>
  )
}
