$ErrorActionPreference = "Stop"

$arquivo = "components/admin/admin-dashboard.tsx"
$baseCommit = "87279a5"
$tempNode = Join-Path $env:TEMP "saborflow-fix-order-sound.cjs"

if (-not (Test-Path $arquivo)) {
  throw "Arquivo nao encontrado: $arquivo"
}

Write-Host "1/4 Restaurando a versao UTF-8 correta do painel..."
git restore --source=$baseCommit --worktree -- "$arquivo"
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao restaurar $arquivo a partir do commit $baseCommit"
}

Write-Host "2/4 Reaplicando o alerta sonoro usando Node.js/UTF-8..."

$nodeScript = @'
const fs = require("fs");

const file = "components/admin/admin-dashboard.tsx";
let content = fs.readFileSync(file, "utf8");

function replaceExact(oldText, newText, label) {
  if (!content.includes(oldText)) {
    throw new Error("Trecho nao encontrado: " + label);
  }
  content = content.replace(oldText, newText);
  console.log("OK:", label);
}

replaceExact(
  'import { useEffect, useMemo, useState } from "react"',
  'import { useEffect, useMemo, useRef, useState } from "react"',
  "adicionar useRef"
);

replaceExact(
  '  const [loggingOut, setLoggingOut] = useState(false)',
`  const [loggingOut, setLoggingOut] = useState(false)
  const [orderSoundEnabled, setOrderSoundEnabled] = useState(false)
  const orderSoundEnabledRef = useRef(false)
  const seenOrderIdsRef = useRef<Set<number>>(
    new Set(initialData.orders.map((order) => order.id)),
  )
  const audioContextRef = useRef<AudioContext | null>(null)`,
  "estado do alerta sonoro"
);

replaceExact(
`  useEffect(() => {
    let active = true
    let lastFullRefresh = 0`,
`  const getOrderAudioContext = () => {
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
    let lastFullRefresh = 0`,
  "motor de som e preferencia persistente"
);

replaceExact(
`    const mergeRecentOrders = (incoming: Order[]) => {
      setOrders((current) => {
        const incomingIds = new Set(incoming.map((order) => order.id))
        return [
          ...incoming,
          ...current.filter((order) => !incomingIds.has(order.id)),
        ]
      })
    }`,
`    const notifyNewOrders = (incoming: Order[]) => {
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
    }`,
  "detectar novos pedidos no refresh ao vivo"
);

replaceExact(
  '      if (Array.isArray(data.orders)) setOrders(data.orders)',
`      if (Array.isArray(data.orders)) {
        notifyNewOrders(data.orders)
        setOrders(data.orders)
      }`,
  "detectar novos pedidos no refresh completo"
);

replaceExact(
  '<OrganizationSwitcher fallbackName={settings.storeName} variant="compact" />',
  '<OrganizationSwitcher fallbackName={settings.storeName} variant="compact" /><button onClick={toggleOrderSound} type="button" className={`rounded-2xl border px-3 py-2 text-xs font-black transition ${orderSoundEnabled ? "bg-emerald-50 text-emerald-700" : "bg-white text-gray-500 hover:bg-gray-50"}`} style={{ borderColor: orderSoundEnabled ? "#a7f3d0" : saborFlowBrand.border }} aria-label={orderSoundEnabled ? "Desativar som de novos pedidos" : "Ativar som de novos pedidos"} title={orderSoundEnabled ? "Som de novos pedidos ligado" : "Som de novos pedidos desligado"}>{orderSoundEnabled ? "Som ON" : "Som OFF"}</button>',
  "botao Som ON/OFF"
);

content = content.replace(/\r?\n+$/, "\n");
fs.writeFileSync(file, content, "utf8");

console.log("UTF-8 preservado e som reaplicado.");
'@

[System.IO.File]::WriteAllText(
  $tempNode,
  $nodeScript,
  (New-Object System.Text.UTF8Encoding($false))
)

node $tempNode
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao reaplicar o alerta sonoro."
}

Remove-Item $tempNode -Force -ErrorAction SilentlyContinue

Write-Host "3/4 Verificando caracteres corrompidos..."
$texto = [System.IO.File]::ReadAllText($arquivo, [System.Text.Encoding]::UTF8)
$marcadores = @("Ã", "Â", "ï¿½", "�")
$encontrados = @()

foreach ($m in $marcadores) {
  if ($texto.Contains($m)) {
    $encontrados += $m
  }
}

if ($encontrados.Count -gt 0) {
  throw "Ainda existem sinais de encoding corrompido no arquivo: $($encontrados -join ', ')"
}

Write-Host "4/4 git diff --check..."
git diff --check -- "$arquivo"
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema."
}

Write-Host ""
Write-Host "CORRECAO DE ENCODING APLICADA."
Write-Host "- textos em portugues restaurados"
Write-Host "- alerta Som ON/OFF mantido"
Write-Host "- arquivo salvo em UTF-8"
Write-Host "- ainda nao foi feito commit nem deploy"
