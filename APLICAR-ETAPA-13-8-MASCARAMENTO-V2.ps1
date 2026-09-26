$ErrorActionPreference = "Stop"

$nodeFile = Join-Path $env:TEMP "saborflow-etapa-13-8-v2.cjs"

$node = @'
const fs = require("fs");

const files = {
  tenant: "lib/tenant-admin-data.ts",
  customersApi: "app/api/admin/customers/route.ts",
  customersPanel: "components/admin/customers-panel.tsx",
  dashboard: "components/admin/admin-dashboard.tsx",
};

const original = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [
    key,
    fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
  ]),
);

const next = { ...original };

function replaceExact(content, oldText, newText, label) {
  if (!content.includes(oldText)) {
    throw new Error("Trecho nao encontrado: " + label);
  }
  console.log("OK:", label);
  return content.replace(oldText, newText);
}

// 1) Backend tenant: valores financeiros nao chegam ao navegador sem finance.view.
next.tenant = replaceExact(
  next.tenant,
`    summary: canOrders ? data.summary : emptySummary(),
    orders: canOrders ? data.orders : [],`,
`    summary: canOrders
      ? {
          ...data.summary,
          revenue: canFinance ? data.summary.revenue : 0,
          todayRevenue: canFinance ? data.summary.todayRevenue : 0,
        }
      : emptySummary(),
    orders: canOrders ? data.orders : [],`,
  "mascarar faturamento no backend",
);

next.tenant = replaceExact(
  next.tenant,
`    customers: canCustomers ? data.customers : [],`,
`    customers: canCustomers
      ? canFinance
        ? data.customers
        : data.customers.map((customer) => ({
            ...customer,
            totalSpent: 0,
          }))
      : [],`,
  "mascarar total gasto de clientes no backend",
);

// 2) API clientes: somente sessao tenant verificada, sem fallback legado.
next.customersApi = next.customersApi.replace(
  'import { isAdminAuthenticated } from "@/lib/auth"\n',
  "",
);

next.customersApi = replaceExact(
  next.customersApi,
`import {
  createCustomerAccount as createLegacyCustomerAccount,
  getCustomers as getLegacyCustomers,
  safeCustomer,
  syncLegacyCustomerAccountFromTenant,
} from "@/lib/db"`,
`import {
  syncLegacyCustomerAccountFromTenant,
} from "@/lib/db"`,
  "remover imports legados inseguros",
);

next.customersApi = replaceExact(
  next.customersApi,
`import {
  getSettings,
} from "@/lib/db"
import { canManageCustomers } from "@/lib/tenant-permissions"`,
`import {
  getTenantSettings,
} from "@/lib/organization-db"
import {
  canManageCustomers,
  canViewFinance,
} from "@/lib/tenant-permissions"`,
  "usar settings tenant e permissao financeira",
);

next.customersApi = replaceExact(
  next.customersApi,
`export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "N\u00e3o autorizado." },
      { status: 401 },
    )
  }

  const body =`,
`export async function POST(request: Request) {
  const session = await getVerifiedTenantSession()

  if (!session) {
    return NextResponse.json(
      { error: "Sessao administrativa invalida ou expirada." },
      { status: 401 },
    )
  }

  const body =`,
  "exigir sessao tenant verificada",
);

const tenantReadyBlock =
  /  const session = await getVerifiedTenantSession\(\)\n  const tenantReady =\n    session &&\n    \(await isTenantCustomersReady\([\s\S]*?  const settings = await getSettings\(\)/;

if (!tenantReadyBlock.test(next.customersApi)) {
  throw new Error("Trecho nao encontrado: bloco tenantReady");
}

next.customersApi = next.customersApi.replace(
  tenantReadyBlock,
`  const tenantReady = await isTenantCustomersReady(
    session.organizationId,
  ).catch(() => false)

  if (!tenantReady) {
    return NextResponse.json(
      { error: "Cadastro de clientes temporariamente indisponivel." },
      { status: 503 },
    )
  }

  if (!canManageCustomers(session.role)) {
    return NextResponse.json(
      { error: "Seu perfil nao pode cadastrar clientes." },
      { status: 403 },
    )
  }

  const settings = await getTenantSettings(session.organizationId)`,
);
console.log("OK: remover fallback legado da API");

next.customersApi = replaceExact(
  next.customersApi,
`      const account =
        session && tenantReady
          ? await createTenantCustomerAccount(
              session.organizationId,
              {
                cpf: item.cpf || "",
                pin: item.pin || "",
                name: item.name || "",
                phone: item.phone || "",
                email: item.email || "",
                defaultCity: settings.city,
                defaultState: settings.state,
              },
            )
          : await createLegacyCustomerAccount({
              cpf: item.cpf || "",
              pin: item.pin || "",
              name: item.name || "",
              phone: item.phone || "",
              email: item.email || "",
            })`,
`      const account = await createTenantCustomerAccount(
        session.organizationId,
        {
          cpf: item.cpf || "",
          pin: item.pin || "",
          name: item.name || "",
          phone: item.phone || "",
          email: item.email || "",
          defaultCity: settings.city,
          defaultState: settings.state,
        },
      )`,
  "remover cadastro legado",
);

next.customersApi = replaceExact(
  next.customersApi,
`      if (
        session &&
        tenantReady &&
        (await isCurrentDeploymentOrganization(
          session.organizationId,
        ))
      ) {`,
`      if (
        await isCurrentDeploymentOrganization(
          session.organizationId,
        )
      ) {`,
  "sincronizacao legada apenas apos autorizacao",
);

next.customersApi = replaceExact(
  next.customersApi,
`      created.push(
        session && tenantReady
          ? safeTenantCustomer(account)
          : safeCustomer(account),
      )`,
`      created.push(safeTenantCustomer(account))`,
  "retorno seguro do cliente criado",
);

next.customersApi = replaceExact(
  next.customersApi,
`  const customers =
    session && tenantReady
      ? await getTenantCustomers(session.organizationId)
      : await getLegacyCustomers()

  return NextResponse.json(
    {
      created,
      errors,
      customers,
    },`,
`  const customers = await getTenantCustomers(
    session.organizationId,
  )
  const canFinance = canViewFinance(session.role)
  const safeCustomers = canFinance
    ? customers
    : customers.map((customer) => ({
        ...customer,
        totalSpent: 0,
      }))

  return NextResponse.json(
    {
      created,
      errors,
      customers: safeCustomers,
    },`,
  "mascarar totalSpent na resposta da API",
);

// 3) Painel clientes: sem total gasto na tabela/CSV para quem nao tem finance.view.
const downloadRegex =
  /function downloadCsv\(customers: CustomerSummary\[\]\) \{[\s\S]*?\n\}\n\nfunction splitCsvLine/;

if (!downloadRegex.test(next.customersPanel)) {
  throw new Error("Trecho nao encontrado: downloadCsv");
}

next.customersPanel = next.customersPanel.replace(
  downloadRegex,
`function downloadCsv(
  customers: CustomerSummary[],
  canViewFinancialData: boolean,
) {
  const header = canViewFinancialData
    ? ["Nome", "Telefone", "CPF final", "Pontos", "Pedidos", "Total gasto", "Segmento", "Status", "Ultimo pedido"]
    : ["Nome", "Telefone", "CPF final", "Pontos", "Pedidos", "Segmento", "Status", "Ultimo pedido"]

  const rows = customers.map((customer) =>
    canViewFinancialData
      ? [
          customer.name,
          customer.phone,
          customer.cpfLast4 || "",
          customer.loyaltyPoints,
          customer.orders,
          customer.totalSpent.toFixed(2),
          segmentLabel[customer.segment],
          lifecycleLabel[customer.lifecycle],
          customer.lastOrderAt,
        ]
      : [
          customer.name,
          customer.phone,
          customer.cpfLast4 || "",
          customer.loyaltyPoints,
          customer.orders,
          segmentLabel[customer.segment],
          lifecycleLabel[customer.lifecycle],
          customer.lastOrderAt,
        ],
  )

  const content =
    "\\ufeff" +
    [header, ...rows]
      .map((row) => row.map(csvEscape).join(";"))
      .join("\\r\\n")
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = \`clientes-\${new Date().toISOString().slice(0, 10)}.csv\`
  a.click()
  URL.revokeObjectURL(url)
}

function splitCsvLine`,
);
console.log("OK: proteger CSV de clientes");

next.customersPanel = replaceExact(
  next.customersPanel,
`export function CustomersPanel({ customers, onCustomersChanged }: { customers: CustomerSummary[]; onCustomersChanged: (customers: CustomerSummary[]) => void }) {`,
`export function CustomersPanel({
  customers,
  onCustomersChanged,
  canViewFinancialData,
}: {
  customers: CustomerSummary[]
  onCustomersChanged: (customers: CustomerSummary[]) => void
  canViewFinancialData: boolean
}) {`,
  "adicionar permissao financeira ao CustomersPanel",
);

next.customersPanel = replaceExact(
  next.customersPanel,
`onClick={() => downloadCsv(filtered)}`,
`onClick={() => downloadCsv(filtered, canViewFinancialData)}`,
  "proteger exportacao CSV",
);

next.customersPanel = replaceExact(
  next.customersPanel,
`<th className="px-5 py-3">Total gasto</th>`,
`{canViewFinancialData && <th className="px-5 py-3">Total gasto</th>}`,
  "ocultar coluna financeira",
);

next.customersPanel = replaceExact(
  next.customersPanel,
`<td className="px-5 py-4 font-black">{money(customer.totalSpent)}</td>`,
`{canViewFinancialData && <td className="px-5 py-4 font-black">{money(customer.totalSpent)}</td>}`,
  "ocultar total gasto",
);

// 4) Dashboard: card financeiro mascarado e permissao repassada.
next.dashboard = replaceExact(
  next.dashboard,
`  const visibleNavItems = useMemo(`,
`  const canViewFinancialData = permissionListHas(
    operationalPermissions,
    "finance.view",
  )
  const visibleNavItems = useMemo(`,
  "calcular permissao financeira no dashboard",
);

next.dashboard = replaceExact(
  next.dashboard,
`{ label: "Faturamento hoje", value: formatCurrency(summary.todayRevenue), icon: DollarSign, description: "Pedidos n\u00e3o cancelados", cls: "text-violet-700 bg-violet-50" }`,
`{ label: "Faturamento hoje", value: canViewFinancialData ? formatCurrency(summary.todayRevenue) : "Restrito", icon: DollarSign, description: canViewFinancialData ? "Pedidos n\u00e3o cancelados" : "Requer permissao financeira", cls: "text-violet-700 bg-violet-50" }`,
  "mascarar card de faturamento",
);

next.dashboard = replaceExact(
  next.dashboard,
`<CustomersPanel customers={customers} onCustomersChanged={setCustomers} />`,
`<CustomersPanel customers={customers} onCustomersChanged={setCustomers} canViewFinancialData={canViewFinancialData} />`,
  "repassar permissao ao painel de clientes",
);

// Validacao antes de escrever qualquer arquivo.
const checks = [
  [next.tenant.includes("todayRevenue: canFinance ? data.summary.todayRevenue : 0"), "summary backend"],
  [next.tenant.includes("totalSpent: 0"), "clientes backend"],
  [!next.customersApi.includes("isAdminAuthenticated"), "API sem auth legado"],
  [!next.customersApi.includes("createLegacyCustomerAccount"), "API sem cadastro legado"],
  [next.customersApi.includes("canViewFinance(session.role)"), "API mascara financeiro"],
  [next.customersPanel.includes("canViewFinancialData: boolean"), "prop painel"],
  [next.dashboard.includes('"finance.view"'), "permissao dashboard"],
  [next.dashboard.includes('"Restrito"'), "mascara visual"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error("Validacao falhou: " + label);
}

// So agora grava os quatro arquivos.
for (const [key, file] of Object.entries(files)) {
  fs.writeFileSync(file, next[key].replace(/\n+$/, "\n"), "utf8");
}

console.log("");
console.log("ETAPA 13.8 APLICADA.");
console.log("- CPF permanece mascarado pelos 4 ultimos digitos.");
console.log("- Faturamento agregado e totalSpent sao zerados no backend sem finance.view.");
console.log("- Tabela e CSV ocultam Total gasto sem permissao.");
console.log("- API de clientes exige sessao tenant verificada.");
console.log("- UTF-8 preservado.");
console.log("- Ainda nao foi feito commit nem deploy.");
'@

[System.IO.File]::WriteAllText(
  $nodeFile,
  $node,
  (New-Object System.Text.UTF8Encoding($false))
)

node $nodeFile
$exitCode = $LASTEXITCODE
Remove-Item $nodeFile -Force -ErrorAction SilentlyContinue

if ($exitCode -ne 0) {
  throw "Falha ao aplicar a Etapa 13.8."
}

git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema."
}
