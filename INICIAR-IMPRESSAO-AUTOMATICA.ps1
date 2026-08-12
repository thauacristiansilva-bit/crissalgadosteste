param(
  [string]$ServerUrl = "",
  [string]$Token = "",
  [string]$PrinterName = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " SABORFLOW - AGENTE DE IMPRESSAO AUTOMATICA" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not $ServerUrl) {
  $ServerUrl = Read-Host "URL do SaborFlow (ex.: https://seu-app.up.railway.app)"
}

if (-not $Token) {
  $Token = Read-Host "Token do agente criado em Conta e seguranca"
}

if (-not $PrinterName) {
  Write-Host "`nImpressoras encontradas:" -ForegroundColor Yellow

  try {
    Get-Printer |
      Select-Object -ExpandProperty Name |
      ForEach-Object {
        Write-Host " - $_"
      }
  } catch {
    Write-Host "Nao foi possivel listar impressoras automaticamente."
  }

  $PrinterName = Read-Host "Nome exato da impressora (vazio = usar configuracao/impresso padrao)"
}

$ServerUrl = $ServerUrl.TrimEnd('/')
$headers = @{
  "x-print-token" = $Token
}

function Money([double]$value) {
  return ('R$ {0:N2}' -f $value)
}

function Build-Ticket(
  $order,
  $settings,
  [bool]$customerCopy
) {
  $receive = if ($order.requestedForLocal) { [string]$order.requestedForLocal } else { ([datetime]$order.requestedFor).ToLocalTime().ToString("dd/MM/yyyy HH:mm") }
  $lines = New-Object System.Collections.Generic.List[string]

  $lines.Add(($settings.storeName).ToUpper())
  $lines.Add("================================")
  $lines.Add("PEDIDO $($order.code)")
  $lines.Add("Receber: $receive")
  $lines.Add($(if ($order.type -eq 'delivery') { 'DELIVERY' } else { 'RETIRADA' }))
  $lines.Add("Cliente: $($order.customer.name)")
  $lines.Add("Telefone: $($order.customer.phone)")

  if ($order.type -eq 'delivery') {
    $lines.Add("Endereco: $($order.customer.address), $($order.customer.number)")

    if ($order.customer.district) {
      $lines.Add("Bairro: $($order.customer.district)")
    }

    if ($order.deliveryZoneName) {
      $lines.Add("Area: $($order.deliveryZoneName)")
    }
  }

  $lines.Add("--------------------------------")

  foreach ($item in $order.items) {
    if ($customerCopy) {
      $lines.Add("$($item.quantity)x $($item.name)  $(Money([double]$item.subtotal))")
    } else {
      $lines.Add("$($item.quantity)x $($item.name)")
    }
  }

  if ($order.notes) {
    $lines.Add("--------------------------------")
    $lines.Add("OBS: $($order.notes)")
  }

  if ($customerCopy) {
    $lines.Add("--------------------------------")

    if ([double]$order.discount -gt 0) {
      $lines.Add("Desconto: -$(Money([double]$order.discount))")
    }

    if ([double]$order.deliveryFee -gt 0) {
      $lines.Add("Entrega: $(Money([double]$order.deliveryFee))")
    }

    $lines.Add("TOTAL: $(Money([double]$order.total))")
    $lines.Add("Pagamento: $($order.paymentMethod)")
  }

  $lines.Add("================================")
  $lines.Add($order.reference)

  return ($lines -join [Environment]::NewLine)
}

function Send-Print([string]$text, [string]$effectivePrinter) {
  if ([string]::IsNullOrWhiteSpace($effectivePrinter)) {
    $text | Out-Printer
  } else {
    $text | Out-Printer -Name $effectivePrinter
  }
}

Write-Host "`nAgente ativo. O token define qual empresa pode ser consultada." -ForegroundColor Green
Write-Host "Consultando novos pedidos a cada 3 segundos...`n" -ForegroundColor Gray

$shownOrganization = ""

while ($true) {
  try {
    $queue = Invoke-RestMethod `
      -Uri "$ServerUrl/api/print-queue" `
      -Headers $headers `
      -Method Get `
      -TimeoutSec 20

    if (
      $queue.organization.name -and
      $queue.organization.name -ne $shownOrganization
    ) {
      $shownOrganization = $queue.organization.name
      Write-Host "Empresa: $shownOrganization" -ForegroundColor Cyan
    }

    if (-not $queue.settings.autoPrintNewOrders) {
      Start-Sleep -Seconds 5
      continue
    }

    $effectivePrinter = $PrinterName

    if (
      [string]::IsNullOrWhiteSpace($effectivePrinter) -and
      $queue.settings.printerName
    ) {
      $effectivePrinter = $queue.settings.printerName
    }

    foreach ($order in @($queue.orders)) {
      Write-Host "Novo pedido: $($order.code)" -ForegroundColor Yellow

      $copies = [Math]::Max(
        1,
        [int]$queue.settings.printCopies
      )

      if ($queue.settings.printKitchenTicket) {
        $ticket = Build-Ticket $order $queue.settings $false

        1..$copies | ForEach-Object {
          Send-Print $ticket $effectivePrinter
        }
      }

      if ($queue.settings.printCustomerTicket) {
        $ticketCustomer = Build-Ticket $order $queue.settings $true
        Send-Print $ticketCustomer $effectivePrinter
      }

      Invoke-RestMethod `
        -Uri "$ServerUrl/api/print-queue" `
        -Headers $headers `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
          orderId = $order.id
        } | ConvertTo-Json) |
        Out-Null

      Write-Host "Pedido $($order.code) impresso e confirmado." -ForegroundColor Green
    }
  } catch {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] Falha temporaria: $($_.Exception.Message)" -ForegroundColor Red
  }

  Start-Sleep -Seconds 3
}
