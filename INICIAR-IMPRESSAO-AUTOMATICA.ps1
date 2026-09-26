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

if (-not $PrinterName) { Write-Host "Escolha a impressora no painel do SaborFlow. Ate la, sera usada a padrao do Windows." -ForegroundColor Yellow }

$ServerUrl = $ServerUrl.TrimEnd('/')
$headers = @{
  "x-print-token" = $Token
  "x-saborflow-print-version" = "2"
}
Write-Host "Conector SaborFlow versao 2 - cupom destacado." -ForegroundColor Green

# Desenha o cupom na largura do rolo. Out-Printer aplica o layout da pagina
# padrao do Windows e reduz o texto a uma coluna no centro do papel termico.
Add-Type -ReferencedAssemblies @('System.Drawing.dll') -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;

public sealed class SaborFlowReceiptLine {
  public string Text { get; set; }
  public string Style { get; set; }
  public SaborFlowReceiptLine(string text, string style) { Text = text ?? ""; Style = style ?? "Normal"; }
}

public sealed class SaborFlowReceiptPrinter {
  private readonly List<SaborFlowReceiptLine> lines;
  private int nextLine;
  private readonly int width;
  public SaborFlowReceiptPrinter(List<SaborFlowReceiptLine> lines, int width) { this.lines = lines; this.width = width; }

  public static void Print(List<SaborFlowReceiptLine> lines, string name, int widthMm) {
    using (var doc = new PrintDocument()) {
      if (!String.IsNullOrWhiteSpace(name)) doc.PrinterSettings.PrinterName = name;
      if (!doc.PrinterSettings.IsValid) throw new Exception("Impressora nao encontrada no Windows: " + name);
      int rollWidth = (int)Math.Round(widthMm * 100.0 / 25.4);
      doc.DefaultPageSettings.PaperSize = new PaperSize("SaborFlow recibo", rollWidth, 1100);
      doc.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
      doc.PrintController = new StandardPrintController();
      var renderer = new SaborFlowReceiptPrinter(lines, rollWidth);
      doc.PrintPage += renderer.Draw;
      doc.Print();
    }
  }

  private void Draw(object sender, PrintPageEventArgs e) {
    var g = e.Graphics;
    g.TranslateTransform(-e.PageSettings.HardMarginX, -e.PageSettings.HardMarginY);
    float left = 10, available = width - 20, y = 8, bottom = e.PageBounds.Height - 12;
    using (var normal = new Font("Arial", 10.5f, FontStyle.Regular))
    using (var bold = new Font("Arial", 12f, FontStyle.Bold))
    using (var large = new Font("Arial", 16f, FontStyle.Bold))
    using (var brush = new SolidBrush(Color.Black))
    using (var border = new Pen(Color.Black, 1.5f)) {
      while (nextLine < lines.Count) {
        var line = lines[nextLine];
        bool important = line.Style == "Title" || line.Style == "Alert";
        var font = important ? large : line.Style == "Normal" || line.Style == "Sub" ? normal : bold;
        float inset = line.Style == "Sub" ? 12 : 0;
        float textWidth = available - inset - (important ? 10 : 0);
        var format = new StringFormat(StringFormat.GenericTypographic);
        format.Trimming = StringTrimming.None;
        var measured = g.MeasureString(line.Text.Length == 0 ? " " : line.Text, font, new SizeF(textWidth, 900), format);
        float height = Math.Max(font.GetHeight(g) + 3, measured.Height + 5) + (important ? 8 : 0);
        if (y + height > bottom && y > 8) { e.HasMorePages = true; return; }
        if (important) g.DrawRectangle(border, left, y, available, height - 2);
        g.DrawString(line.Text, font, brush, new RectangleF(left + inset + (important ? 5 : 0), y + (important ? 3 : 0), textWidth, height), format);
        y += height;
        nextLine++;
      }
    }
    e.HasMorePages = false;
  }
}
'@

function Money([double]$value) {
  return ('R$ {0:N2}' -f $value)
}

function Build-Ticket(
  $order,
  $settings,
  [bool]$customerCopy
) {
  $receive = if ($order.requestedForLocal) { [string]$order.requestedForLocal } else { ([datetime]$order.requestedFor).ToLocalTime().ToString("dd/MM/yyyy HH:mm") }
  $lines = New-Object 'System.Collections.Generic.List[SaborFlowReceiptLine]'
  function Add-Line([string]$text, [string]$style = 'Normal') { $lines.Add([SaborFlowReceiptLine]::new($text, $style)) }

  Add-Line (([string]$settings.storeName).ToUpper()) 'Section'
  Add-Line "PEDIDO $($order.code)" 'Title'
  if ($order.createdAtLocal) { Add-Line "FEITO EM: $($order.createdAtLocal)" 'Section' }
  Add-Line "RECEBER EM: $receive" 'Alert'
  Add-Line $(if ($order.type -eq 'delivery') { 'ENTREGA' } else { 'RETIRADA' }) 'Alert'
  Add-Line "CLIENTE: $($order.customer.name)" 'Section'
  if ($order.customer.phone) { Add-Line "Telefone: $($order.customer.phone)" }

  if ($order.type -eq 'delivery') {
    Add-Line 'ENDERECO DE ENTREGA' 'Alert'
    Add-Line "$($order.customer.address), $($order.customer.number)" 'Section'
    if ($order.customer.complement) { Add-Line "Complemento: $($order.customer.complement)" 'Section' }

    if ($order.customer.district) {
      Add-Line "Bairro: $($order.customer.district)" 'Section'
    }
    if ($order.customer.city) { Add-Line "Cidade: $($order.customer.city)" }

    if ($order.deliveryZoneName) {
      Add-Line "Area: $($order.deliveryZoneName)"
    }
  }

  Add-Line 'ITENS DO PEDIDO' 'Alert'

  foreach ($item in $order.items) {
    if ($customerCopy) {
      Add-Line "$($item.quantity)x $($item.name)  $(Money([double]$item.subtotal))" 'Item'
    } else {
      Add-Line "$($item.quantity)x $($item.name)" 'Item'
    }
    foreach ($modifier in $item.modifiers) {
      $detail = "  - $($modifier.groupName): $($modifier.optionName)"
      if ($customerCopy -and -not $modifier.included -and [double]$modifier.priceDelta -gt 0) {
        $detail += " (+$(Money([double]$modifier.priceDelta)))"
      }
      Add-Line $detail 'Sub'
    }
  }

  if ($order.notes) {
    Add-Line 'OBSERVACOES' 'Alert'
    Add-Line ([string]$order.notes) 'Section'
  }

  if ($customerCopy) {
    Add-Line "Subtotal: $(Money([double]$order.subtotal))"

    if ([double]$order.discount -gt 0) {
      Add-Line "Desconto: -$(Money([double]$order.discount))"
    }
    if ([double]$order.cashbackUsed -gt 0) { Add-Line "Cashback: -$(Money([double]$order.cashbackUsed))" }

    if ([double]$order.deliveryFee -gt 0) {
      Add-Line "Entrega: $(Money([double]$order.deliveryFee))"
    }

    Add-Line "TOTAL: $(Money([double]$order.total))" 'Alert'
    Add-Line "Pagamento: $($order.paymentMethod)"
    if ($order.changeFor) { Add-Line "Troco para: $($order.changeFor)" }
  }

  Add-Line ([string]$order.reference)

  return ,$lines
}

function Send-Print($ticket, [string]$effectivePrinter, [int]$paperWidthMm) {
  [SaborFlowReceiptPrinter]::Print($ticket, $effectivePrinter, $paperWidthMm)
}

Write-Host "`nAgente ativo. O token define qual empresa pode ser consultada." -ForegroundColor Green
Write-Host "Consultando novos pedidos a cada 3 segundos...`n" -ForegroundColor Gray

$shownOrganization = ""
$lastPrinterReport = [datetime]::MinValue

while ($true) {
  try {
    if (((Get-Date) - $lastPrinterReport).TotalSeconds -ge 30) {
      try {
        $printers = @(Get-Printer | ForEach-Object { @{ name = [string]$_.Name; port = [string]$_.PortName } })
        $body = @{ printers = $printers } | ConvertTo-Json -Depth 4 -Compress
        Invoke-RestMethod -Uri "$ServerUrl/api/print-queue/printers" -Headers $headers -Method Post -ContentType "application/json" -Body $body -TimeoutSec 15 | Out-Null
        $lastPrinterReport = Get-Date
      } catch {
        Write-Host "Nao foi possivel atualizar lista de impressoras: $($_.Exception.Message)" -ForegroundColor Yellow
        $lastPrinterReport = Get-Date
      }
    }
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
      $paperWidthMm = [int]$queue.settings.printerPaperWidthMm
      if ($paperWidthMm -notin @(50, 58, 80)) { $paperWidthMm = 80 }

      $copies = [Math]::Max(
        1,
        [int]$queue.settings.printCopies
      )

      if ($queue.settings.printKitchenTicket) {
        $ticket = Build-Ticket $order $queue.settings $false

        1..$copies | ForEach-Object {
          Send-Print $ticket $effectivePrinter $paperWidthMm
        }
      }

      if ($queue.settings.printCustomerTicket) {
        $ticketCustomer = Build-Ticket $order $queue.settings $true
        Send-Print $ticketCustomer $effectivePrinter $paperWidthMm
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
