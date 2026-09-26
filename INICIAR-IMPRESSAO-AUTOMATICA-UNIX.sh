#!/bin/sh
# Baixe pelo painel e execute com: sh ~/Downloads/CONECTAR-IMPRESSORA-SABORFLOW.sh
exec python3 - "$@" <<'PY'
import json
import subprocess
import time
import urllib.error
import urllib.request

SERVER = __SABORFLOW_URL__
TOKEN = __SABORFLOW_TOKEN__
HEADERS = {"x-print-token": TOKEN, "x-saborflow-print-version": "2"}


def request(path, payload=None):
    headers = dict(HEADERS)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["content-type"] = "application/json"
    req = urllib.request.Request(SERVER + path, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read(500).decode("utf-8", "replace")
        raise RuntimeError("Servidor HTTP %s: %s" % (exc.code, detail)) from exc


def printers():
    result = subprocess.run(["lpstat", "-p"], capture_output=True, text=True)
    if result.returncode and not result.stdout:
        raise RuntimeError("Nenhuma impressora instalada no sistema (lpstat -p).")
    return [{"name": line.split()[1], "port": "CUPS"}
            for line in result.stdout.splitlines() if line.startswith("printer ") and len(line.split()) > 1]


def receipt(order, settings, customer):
    lines = [settings.get("storeName") or "SaborFlow", "=" * 32,
             "PEDIDO " + str(order.get("code") or ""),
             "FEITO EM: " + str(order.get("createdAtLocal") or ""),
             "RECEBER EM: " + str(order.get("requestedForLocal") or ""),
             "ENTREGA" if order.get("type") == "delivery" else "RETIRADA",
             "CLIENTE: " + str(order.get("customer", {}).get("name") or "")]
    buyer = order.get("customer") or {}
    if buyer.get("phone"):
        lines.append("Telefone: " + str(buyer["phone"]))
    if order.get("type") == "delivery":
        lines += ["=" * 32, "ENDERECO DE ENTREGA", str(buyer.get("address") or "") + ", " + str(buyer.get("number") or "")]
        for key in ("complement", "district", "city"):
            if buyer.get(key):
                lines.append(str(buyer[key]))
    lines += ["=" * 32, "ITENS DO PEDIDO"]
    for item in order.get("items") or []:
        lines.append("%sx %s" % (item.get("quantity"), item.get("name")))
        for choice in item.get("modifiers") or []:
            lines.append("  %s: %s" % (choice.get("groupName"), choice.get("optionName")))
        if customer:
            lines.append("  R$ %.2f" % float(item.get("subtotal") or 0))
    if order.get("notes"):
        lines += ["=" * 32, "OBSERVACOES", str(order["notes"])]
    if customer:
        lines += ["=" * 32, "TOTAL: R$ %.2f" % float(order.get("total") or 0),
                  "Pagamento: " + str(order.get("paymentMethod") or "")]
    lines += ["=" * 32, str(order.get("reference") or ""), "", ""]
    return "\n".join(lines).encode("utf-8")


print("SaborFlow: conector para macOS/Linux iniciado. Mantenha esta janela aberta.", flush=True)
last_report = 0
while True:
    try:
        if time.monotonic() - last_report > 30:
            found = printers()
            request("/api/print-queue/printers", {"printers": found})
            print("Impressoras encontradas: " + (", ".join(p["name"] for p in found) or "nenhuma"), flush=True)
            last_report = time.monotonic()
        queue = request("/api/print-queue")
        settings = queue.get("settings") or {}
        if settings.get("autoPrintNewOrders"):
            available = {p["name"] for p in found}
            chosen = settings.get("printerName") or ""
            if not chosen:
                raise RuntimeError("Escolha uma impressora no painel do SaborFlow.")
            if chosen not in available:
                raise RuntimeError("Impressora '%s' nao encontrada neste computador." % chosen)
            for order in queue.get("orders") or []:
                print("Imprimindo pedido " + str(order.get("code")), flush=True)
                jobs = []
                if settings.get("printKitchenTicket"):
                    jobs += [False] * max(1, min(5, int(settings.get("printCopies") or 1)))
                if settings.get("printCustomerTicket"):
                    jobs.append(True)
                for customer in jobs:
                    done = subprocess.run(["lp", "-d", chosen, "-o", "cpi=10", "-o", "lpi=6"],
                                          input=receipt(order, settings, customer), capture_output=True)
                    if done.returncode:
                        raise RuntimeError(done.stderr.decode("utf-8", "replace"))
                if jobs:
                    request("/api/print-queue", {"orderId": order["id"]})
    except KeyboardInterrupt:
        print("Conector encerrado.")
        break
    except Exception as exc:
        print("Falha temporaria: %s" % exc, flush=True)
    time.sleep(3)
PY
