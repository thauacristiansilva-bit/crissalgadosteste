import { NextResponse } from "next/server"
import { getVerifiedTenantSession, canManageCatalog } from "@/lib/tenant-access"
import { canManageOrganizationSettings } from "@/lib/tenant-permissions"
import { requestIsSameOrigin } from "@/lib/security/request-security"
import { getTenantCategories, getTenantProducts } from "@/lib/catalog-db"
import { getTenantSettings } from "@/lib/organization-db"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getBillingSnapshotForOrganization } from "@/lib/billing-db"
import { applySetupPlan, signSetupPreview, validateSetupPlan, verifySetupPreview } from "@/lib/ai/store-setup"
import { getPostgresPool } from "@/lib/postgres"
import { randomUUID } from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return json({ error: "Origem não permitida." }, 403)
  const session = await getVerifiedTenantSession().catch(() => null)
  if (!session) return json({ error: "Faça login no painel." }, 401)
  if (!canManageCatalog(session.role) || !canManageOrganizationSettings(session.role)) return json({ error: "Esta ação exige permissão para catálogo e configurações." }, 403)
  if (process.env.AI_SETUP_ENABLED !== "true") return json({ error: "O assistente de cadastro ainda não está habilitado neste servidor." }, 503)

  const org = session.organizationId
  const account = await runWithTenantRlsScope([org], session.userId, () => getBillingSnapshotForOrganization(org), "tenant-session")
  if (!account.account || !account.subscription || !["active", "trialing"].includes(account.subscription.status)) return json({ error: "É preciso ter uma assinatura ativa para usar o assistente." }, 403)

  const raw = await request.text()
  if (Buffer.byteLength(raw) > 64_000) return json({ error: "Pedido grande demais." }, 413)
  let body: Record<string, unknown>
  try { body = JSON.parse(raw) as Record<string, unknown> } catch { return json({ error: "Pedido inválido." }, 400) }

  try {
    if (body.action === "apply") {
      if (typeof body.previewToken !== "string" || !verifySetupPreview(body.previewToken, org, session.userId)) return json({ error: "Prévia expirada. Gere novamente antes de aplicar." }, 400)
      const plan = validateSetupPlan(body.plan)
      const snapshot = await runWithTenantRlsScope([org], session.userId, () => getBillingSnapshotForOrganization(org), "tenant-session")
      const existing = await runWithTenantRlsScope([org], session.userId, () => getTenantProducts(org, { includeInactive: true }), "tenant-session")
      const newCount = plan.products.filter((product) => !existing.some((item) => item.name.toLowerCase() === product.name.toLowerCase() && item.category.toLowerCase() === product.category.toLowerCase())).length
      if (snapshot.entitlements.maxProducts !== null && snapshot.usage.products + newCount > snapshot.entitlements.maxProducts) return json({ error: "O plano excede o limite de produtos da sua assinatura." }, 403)
      const result = await runWithTenantRlsScope([org], session.userId, () => applySetupPlan(org, plan), "tenant-session")
      return json({ ok: true, ...result })
    }
    if (body.action !== "preview" || typeof body.prompt !== "string" || body.prompt.trim().length < 12 || body.prompt.length > 10_000) return json({ error: "Descreva a loja e os produtos em até 10 mil caracteres." }, 400)
    const key = process.env.GEMINI_API_KEY?.trim()
    if (!key) return json({ error: "Configure GEMINI_API_KEY no Railway para habilitar a geração." }, 503)

    // O contador no banco protege o custo da geração, inclusive com 2 réplicas no Railway.
    const period = new Date().toISOString().slice(0, 10)
    const usage = await runWithTenantRlsScope([org], session.userId, async () => {
      const pool = getPostgresPool()
      await pool.query("INSERT INTO sf_usage_counters (id,billing_account_id,organization_id,counter_key,period_key,value) VALUES ($4,$1,$2,'ai_setup_previews',$3,0) ON CONFLICT DO NOTHING", [account.account!.id,org,period,randomUUID()])
      return pool.query("UPDATE sf_usage_counters SET value=value+1,updated_at=now() WHERE billing_account_id=$1 AND organization_id=$2 AND counter_key='ai_setup_previews' AND period_key=$3 AND value < 10 RETURNING value", [account.account!.id,org,period])
    }, "tenant-session")
    if (!usage.rows.length) return json({ error: "Limite de 10 gerações por dia atingido. Tente amanhã." }, 429)

    const context = await runWithTenantRlsScope([org], session.userId, async () => {
      const [settings, categories, products] = await Promise.all([getTenantSettings(org), getTenantCategories(org), getTenantProducts(org)])
      return { name: settings?.storeName, categories: categories.map((c) => c.name), products: products.map((p) => ({ name: p.name, category: p.category })) }
    }, "tenant-session")

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 75_000)
    let generated: unknown
    try {
      const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash"
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, signal: controller.signal, cache: "no-store",
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `Você ajuda uma loja a cadastrar site público e cardápio. Responda SOMENTE um JSON válido com chaves store, categories, groups, products. store: name,slogan,welcomeTitle,welcomeText,aboutTitle,aboutText,primaryColor,secondaryColor,phone,whatsapp,openingHours,clientAccountsEnabled (true/false/null se não solicitado). categories: nomes. groups: name,description,required,minSelect,maxSelect,selectionMode ('unique' ou 'bundle'),options [{name,priceDelta}]. products: name,description,category,price,featured,groups (nomes),suggestions (nomes de outros produtos gerados). Preços não fornecidos pelo usuário: use 0; não invente endereço, horário, fotos, promoções ou contatos. Para combos: bundle, escolha mínima indicada pelo usuário e máximo de sabores por unidade; opções podem se repetir e máximo multiplica pela quantidade comprada. Reuse nomes de grupos em vários produtos. Não ultrapasse 20 categorias, 20 grupos, 50 produtos, 60 opções/grupo. Se faltar dado, retorne listas vazias para esses itens. Faça sugestões apenas entre os produtos apresentados no JSON.` }] },
          contents: [{ role: "user", parts: [{ text: `Empresa atual: ${JSON.stringify(context)}\nInstrução do administrador: ${body.prompt}` }] }],
          generationConfig: { temperature: 0.25, responseMimeType: "application/json", maxOutputTokens: 8192 },
        }),
      })
      const payload = await response.json() as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      if (!response.ok) throw new Error(`Gemini ${response.status}: ${payload.error?.message?.slice(0, 160) || "falha na geração"}`)
      generated = JSON.parse(payload.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "")
    } finally { clearTimeout(timer) }
    const plan = validateSetupPlan(generated)
    return json({ ok: true, plan, previewToken: signSetupPreview(org, session.userId, Date.now() + 30 * 60_000) })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao preparar o cadastro." }, 400)
  }
}
