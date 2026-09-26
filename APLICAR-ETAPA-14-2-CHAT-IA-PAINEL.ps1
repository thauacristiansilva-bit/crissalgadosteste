$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ETAPA 14.2 - CHAT IA NO PAINEL ==="
Write-Host ""

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do projeto SaborFlow."
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)

  $dir = Split-Path $Path -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }

  $clean = $Content.TrimEnd() + [Environment]::NewLine
  [System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) $Path),
    $clean,
    [System.Text.UTF8Encoding]::new($false)
  )
}

Write-Utf8NoBom "components\admin\ai-chat-panel.tsx" @'
"use client"

import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

type ApiResponse = {
  ok?: boolean
  reply?: string
  error?: string
  usage?: {
    totalTokens?: number
  }
}

const welcome: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Eu sou a SaborFlow IA. Como posso ajudar?",
}

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function AiChatPanel() {
  const [messages, setMessages] =
    useState<Message[]>([welcome])
  const [text, setText] = useState("")
  const [sending, setSending] =
    useState(false)
  const [error, setError] = useState("")
  const [tokens, setTokens] =
    useState<number | null>(null)
  const inputRef =
    useRef<HTMLTextAreaElement>(null)

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== "welcome")
        .slice(-5)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  )

  async function send() {
    const clean = text.trim()

    if (!clean || sending) return

    if (clean.length > 4000) {
      setError(
        "A mensagem pode ter no máximo 4.000 caracteres.",
      )
      return
    }

    const localMessage: Message = {
      id: id(),
      role: "user",
      content: clean,
    }

    const requestHistory = [
      ...history,
      {
        role: "user" as const,
        content: clean,
      },
    ].slice(-6)

    setMessages((current) => [
      ...current,
      localMessage,
    ])
    setText("")
    setError("")
    setSending(true)

    try {
      const response = await fetch(
        "/api/admin/ai/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: requestHistory,
          }),
        },
      )

      const payload =
        (await response.json()) as ApiResponse

      if (
        !response.ok ||
        !payload.ok ||
        !payload.reply
      ) {
        throw new Error(
          payload.error ||
            "Não foi possível obter resposta da IA.",
        )
      }

      setMessages((current) => [
        ...current,
        {
          id: id(),
          role: "assistant",
          content: payload.reply || "",
        },
      ])

      setTokens(
        typeof payload.usage?.totalTokens ===
          "number"
          ? payload.usage.totalTokens
          : null,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao conversar com a IA.",
      )
    } finally {
      setSending(false)
      setTimeout(
        () => inputRef.current?.focus(),
        0,
      )
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void send()
  }

  function keyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault()
      void send()
    }
  }

  function clear() {
    if (sending) return
    setMessages([welcome])
    setText("")
    setError("")
    setTokens(null)
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#08090B",
        color: "#F7F7F7",
        padding: "20px",
      }}
    >
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <div>
            <div
              style={{
                color: "#FF5A2F",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              SaborFlow
            </div>
            <h1
              style={{
                margin: "4px 0 0",
                fontSize: "26px",
              }}
            >
              Assistente IA
            </h1>
          </div>

          <button
            type="button"
            onClick={clear}
            disabled={sending}
            style={{
              border: "1px solid #343840",
              borderRadius: "10px",
              padding: "9px 12px",
              background: "#14161A",
              color: "#F7F7F7",
              cursor: "pointer",
            }}
          >
            Limpar
          </button>
        </header>

        <div
          style={{
            overflow: "hidden",
            border: "1px solid #2B2E34",
            borderRadius: "18px",
            background: "#111317",
          }}
        >
          <div
            style={{
              minHeight: "470px",
              maxHeight: "62vh",
              overflowY: "auto",
              padding: "18px",
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent:
                    message.role === "user"
                      ? "flex-end"
                      : "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "11px 13px",
                    borderRadius: "14px",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.45,
                    background:
                      message.role === "user"
                        ? "#FF5A2F"
                        : "#202329",
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {sending ? (
              <div
                style={{
                  color: "#9EA3AD",
                  fontSize: "14px",
                }}
              >
                Pensando...
              </div>
            ) : null}
          </div>

          <form
            onSubmit={submit}
            style={{
              borderTop: "1px solid #2B2E34",
              padding: "14px",
            }}
          >
            <textarea
              ref={inputRef}
              rows={3}
              maxLength={4000}
              value={text}
              disabled={sending}
              placeholder="Digite sua mensagem..."
              onChange={(event) =>
                setText(event.target.value)
              }
              onKeyDown={keyDown}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                border: "1px solid #343840",
                borderRadius: "12px",
                padding: "12px",
                background: "#08090B",
                color: "#F7F7F7",
                font: "inherit",
                outline: "none",
              }}
            />

            {error ? (
              <p
                style={{
                  margin: "8px 0 0",
                  color: "#FF9A88",
                  fontSize: "14px",
                }}
              >
                {error}
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginTop: "10px",
              }}
            >
              <small
                style={{
                  color: "#9EA3AD",
                }}
              >
                {tokens !== null
                  ? `${tokens.toLocaleString("pt-BR")} tokens na última resposta`
                  : "Enter envia • Shift+Enter quebra linha"}
              </small>

              <button
                type="submit"
                disabled={sending || !text.trim()}
                style={{
                  border: 0,
                  borderRadius: "10px",
                  padding: "10px 16px",
                  background: "#FF5A2F",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  opacity:
                    sending || !text.trim()
                      ? 0.55
                      : 1,
                  cursor:
                    sending || !text.trim()
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
'@

Write-Utf8NoBom "app\admin\ia\page.tsx" @'
import { redirect } from "next/navigation"

import {
  AiChatPanel,
} from "@/components/admin/ai-chat-panel"
import {
  getVerifiedTenantSession,
} from "@/lib/tenant-access"

export const dynamic = "force-dynamic"

export default async function AdminAiPage() {
  const session =
    await getVerifiedTenantSession()

  if (!session) {
    redirect("/login")
  }

  return <AiChatPanel />
}
'@

Write-Host ""
Write-Host "Arquivos preparados:"
Write-Host "  - components\admin\ai-chat-panel.tsx"
Write-Host "  - app\admin\ia\page.tsx"
Write-Host ""

git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check falhou."
}

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) {
  throw "typecheck falhou."
}

npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw "build falhou."
}

git restore -- next-env.d.ts 2>$null

Write-Host ""
Write-Host "ETAPA 14.2 CHAT IA APROVADO - BUILD OK"
Write-Host ""
