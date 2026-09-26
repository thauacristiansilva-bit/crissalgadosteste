$ErrorActionPreference = "Stop"

$arquivo = "components\admin\admin-dashboard.tsx"

if (-not (Test-Path $arquivo)) {
  throw "Arquivo nao encontrado: $arquivo"
}

$conteudo = Get-Content $arquivo -Raw
$original = $conteudo

function Replace-Exact {
  param(
    [string]$Old,
    [string]$New,
    [string]$Label
  )

  if (-not $script:conteudo.Contains($Old)) {
    throw "Nao encontrei o trecho esperado para: $Label"
  }

  $script:conteudo = $script:conteudo.Replace($Old, $New)
  Write-Host "OK: $Label"
}

# 1) useRef
Replace-Exact `
  'import { useEffect, useMemo, useState } from "react"' `
  'import { useEffect, useMemo, useRef, useState } from "react"' `
  "adicionar useRef"

# 2) Estado e referencias do som
$oldState = '  const [loggingOut, setLoggingOut] = useState(false)'
$newState = @'
  const [loggingOut, setLoggingOut] = useState(false)
  const [orderSoundEnabled, setOrderSoundEnabled] = useState(false)
  const orderSoundEnabledRef = useRef(false)
  const seenOrderIdsRef = useRef<Set<number>>(
    new Set(initialData.orders.map((order) => order.id)),
  )
  const audioContextRef = useRef<AudioContext | null>(null)
'@

Replace-Exact $oldState $newState "estado do alerta sonoro"

# 3) Funcoes do som antes do effect principal de atualizacao
$anchor = @'
  useEffect(() => {
    let active = true
    let lastFullRefresh = 0
'@

$insert = @'
  const getOrderAudioContext = () => {
    if (typeof window === "undefined") return null
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }).webkitAudioContext

    if (!AudioContextConstructor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    return audioContextRef.current
  }

  const unlockOrderSound = async () => {
    const context = getOrderAudioContext()
    if (!context) return
    if (context.state === "suspended") {
      await context.resume().catch(() => undefined)
    }
  }

  const playNewOrderSound = async () => {
    if (!orderSoundEnabledRef.current) return

    const context = getOrderAudioContext()
    if (!context) return

    if (context.state === "suspended") {
      await context.resume().catch(() => undefined)
    }

    if (context.state !== "running") return

    const start = context.currentTime

    const playTone = (
      frequency: number,
      offset: number,
      duration: number,
    ) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(
        frequency,
        start + offset,
      )

      gain.gain.setValueAtTime(
        0.0001,
        start + offset,
      )
      gain.gain.exponentialRampToValueAtTime(
        0.18,
        start + offset + 0.015,
      )
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + offset + duration,
      )

      oscillator.connect(gain)
      gain.connect(context.destination)

      oscillator.start(start + offset)
      oscillator.stop(start + offset + duration)
    }

    playTone(880, 0, 0.18)
    playTone(1174.66, 0.22, 0.22)
  }

  const toggleOrderSound = () => {
    const next = !orderSoundEnabledRef.current
    orderSoundEnabledRef.current = next
    setOrderSoundEnabled(next)
    window.localStorage.setItem(
      "saborflow-order-sound",
      next ? "on" : "off",
    )

    if (next) {
      void unlockOrderSound().then(() =>
        playNewOrderSound(),
      )
    }
  }

  useEffect(() => {
    const enabled =
      window.localStorage.getItem(
        "saborflow-order-sound",
      ) === "on"

    orderSoundEnabledRef.current = enabled
    setOrderSoundEnabled(enabled)

    if (!enabled) return

    const unlock = () => {
      void unlockOrderSound()
    }

    window.addEventListener("pointerdown", unlock, {
      once: true,
    })
    window.addEventListener("keydown", unlock, {
      once: true,
    })

    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  useEffect(() => {
    let active = true
    let lastFullRefresh = 0
'@

Replace-Exact $anchor $insert "motor de som e preferencia persistente"

# 4) Detectar pedidos realmente novos
$oldMerge = @'
    const mergeRecentOrders = (incoming: Order[]) => {
      setOrders((current) => {
        const incomingIds = new Set(incoming.map((order) => order.id))
        return [
          ...incoming,
          ...current.filter((order) => !incomingIds.has(order.id)),
        ]
      })
    }
'@

$newMerge = @'
    const notifyNewOrders = (incoming: Order[]) => {
      const newPendingOrders = incoming.filter(
        (order) =>
          order.status === "pending" &&
          !seenOrderIdsRef.current.has(order.id),
      )

      incoming.forEach((order) => {
        seenOrderIdsRef.current.add(order.id)
      })

      if (newPendingOrders.length > 0) {
        void playNewOrderSound()
      }
    }

    const mergeRecentOrders = (incoming: Order[]) => {
      notifyNewOrders(incoming)

      setOrders((current) => {
        const incomingIds = new Set(incoming.map((order) => order.id))
        return [
          ...incoming,
          ...current.filter((order) => !incomingIds.has(order.id)),
        ]
      })
    }
'@

Replace-Exact $oldMerge $newMerge "detectar novos pedidos no refresh ao vivo"

# 5) Detectar novos pedidos tambem no refresh completo
$oldFull = '      if (Array.isArray(data.orders)) setOrders(data.orders)'
$newFull = @'
      if (Array.isArray(data.orders)) {
        notifyNewOrders(data.orders)
        setOrders(data.orders)
      }
'@

Replace-Exact $oldFull $newFull "detectar novos pedidos no refresh completo"

# 6) Botao de ligar/desligar som no cabecalho
$oldSwitcher = '<OrganizationSwitcher fallbackName={settings.storeName} variant="compact" />'
$newSwitcher = @'
<OrganizationSwitcher fallbackName={settings.storeName} variant="compact" /><button onClick={toggleOrderSound} type="button" className={`rounded-2xl border px-3 py-2 text-xs font-black transition ${orderSoundEnabled ? "bg-emerald-50 text-emerald-700" : "bg-white text-gray-500 hover:bg-gray-50"}`} style={{ borderColor: orderSoundEnabled ? "#a7f3d0" : saborFlowBrand.border }} aria-label={orderSoundEnabled ? "Desativar som de novos pedidos" : "Ativar som de novos pedidos"} title={orderSoundEnabled ? "Som de novos pedidos ligado" : "Som de novos pedidos desligado"}>{orderSoundEnabled ? "Som ON" : "Som OFF"}</button>
'@

Replace-Exact $oldSwitcher $newSwitcher "botao Som ON/OFF"

# Validacoes basicas
$required = @(
  'const [orderSoundEnabled, setOrderSoundEnabled] = useState(false)',
  'const seenOrderIdsRef = useRef<Set<number>>',
  'const playNewOrderSound = async () =>',
  'order.status === "pending"',
  'saborflow-order-sound',
  'Som ON',
  'Som OFF'
)

foreach ($token in $required) {
  if (-not $conteudo.Contains($token)) {
    throw "Validacao falhou. Token ausente: $token"
  }
}

try {
  Set-Content -Path $arquivo -Value $conteudo -Encoding utf8
  Write-Host ""
  Write-Host "ALTERACAO APLICADA COM SUCESSO."
  Write-Host "Arquivo: $arquivo"
  Write-Host ""
  Write-Host "Comportamento:"
  Write-Host "- Som so toca para pedido novo com status pending."
  Write-Host "- Pedidos que ja estavam na tela nao disparam som."
  Write-Host "- Preferencia Som ON/OFF fica salva no navegador."
  Write-Host "- Ao ativar Som ON, toca um teste curto."
  Write-Host "- Nao usa arquivo de audio externo."
  Write-Host ""
  Write-Host "Ainda nao foi feito commit nem deploy."
}
catch {
  Set-Content -Path $arquivo -Value $original -Encoding utf8
  throw
}
