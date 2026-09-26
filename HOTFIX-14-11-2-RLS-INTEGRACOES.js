const fs = require("fs")

const file = "app/api/admin/integrations/actions/route.ts"

if (!fs.existsSync(file)) {
  throw new Error(`Arquivo nao encontrado: ${file}`)
}

const original = fs.readFileSync(file, "utf8")

if (original.includes("HOTFIX_RLS_INTEGRATIONS_14112")) {
  console.log("Hotfix 14.11.2 ja esta aplicado.")
  process.exit(0)
}

const importAnchor = `import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { getVerifiedTenantSession } from "@/lib/tenant-access"`

const importReplacement = `import { integrationsRequestIsSameOrigin } from "@/lib/integrations-request"
import { runWithTenantRlsScope } from "@/lib/rls-context"
import { getVerifiedTenantSession } from "@/lib/tenant-access"

// HOTFIX_RLS_INTEGRATIONS_14112`

if ((original.split(importAnchor).length - 1) !== 1) {
  throw new Error("Nao encontrei o ponto exato do import. Nenhum arquivo foi alterado.")
}

const oldBlock = `  try {
    let result: unknown = null
    switch (body.action) {
      case "upsert_connection":
        result = await upsertIntegrationConnection(session, body)
        break
      case "set_connection_status":
        result = await setIntegrationConnectionStatus(session, body)
        break
      case "delete_connection":
        result = await deleteIntegrationConnection(session, body.connectionId)
        break
      case "enqueue_campaign":
        result = await enqueueCrmCampaign(session, body)
        break
      case "cancel_job":
        result = await cancelIntegrationJob(session, body.jobId)
        break
      default:
        return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 })
    }
    return NextResponse.json({ ok: true, result })
  } catch (error) {`

const newBlock = `  try {
    return await runWithTenantRlsScope(
      [session.organizationId],
      session.userId,
      async () => {
        let result: unknown = null

        switch (body.action) {
          case "upsert_connection":
            result = await upsertIntegrationConnection(session, body)
            break
          case "set_connection_status":
            result = await setIntegrationConnectionStatus(session, body)
            break
          case "delete_connection":
            result = await deleteIntegrationConnection(session, body.connectionId)
            break
          case "enqueue_campaign":
            result = await enqueueCrmCampaign(session, body)
            break
          case "cancel_job":
            result = await cancelIntegrationJob(session, body.jobId)
            break
          default:
            return NextResponse.json(
              { error: "Ação não reconhecida." },
              { status: 400 },
            )
        }

        return NextResponse.json({ ok: true, result })
      },
      "tenant-session",
    )
  } catch (error) {`

if ((original.split(oldBlock).length - 1) !== 1) {
  throw new Error("Nao encontrei o bloco exato das acoes. Nenhum arquivo foi alterado.")
}

let next = original.replace(importAnchor, importReplacement)
next = next.replace(oldBlock, newBlock)

if (!next.includes("runWithTenantRlsScope(")) {
  throw new Error("Validacao do escopo RLS falhou. Nenhum arquivo foi alterado.")
}

fs.copyFileSync(file, `${file}.bak14112`)
fs.writeFileSync(file, next, "utf8")

console.log("")
console.log("==============================================")
console.log("HOTFIX 14.11.2 APLICADO")
console.log("==============================================")
console.log("- Acoes de integracoes agora executam dentro do tenant RLS")
console.log("- organization_id e user_id sao aplicados explicitamente")
console.log("- Corrige INSERT/UPDATE bloqueados por FORCE RLS")
console.log("- Nao altera politicas RLS")
console.log("- Nao usa bypass")
console.log("- Nenhuma migration necessaria")
console.log("")
console.log("Backup criado:")
console.log(`${file}.bak14112`)
console.log("")
console.log("Agora execute: npm run build")
console.log("")
