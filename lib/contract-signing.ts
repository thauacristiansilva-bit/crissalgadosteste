import { createHash, randomUUID } from "node:crypto"
import { getPostgresPool } from "@/lib/postgres"
import { commercialCycleTerms, EARLY_TERMINATION_PENALTY_PERCENT } from "@/lib/commercial-contract"
import { PRIVACY_VERSION, SUBSCRIPTION_CONTRACT_VERSION, TERMS_VERSION } from "@/lib/legal-documents"
import type { BillingCycle, PaymentMethod } from "@/lib/billing-types"
import { buildSignedContractPdf, parseSignatureJpegDataUrl } from "@/lib/contract-pdf"
import { sendEmailWithPdfAttachment } from "@/lib/transactional-email"

function maskCpf(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "")
  if (digits.length !== 11) return "registrado na conta"
  return `${digits.slice(0,3)}.***.***-${digits.slice(-2)}`
}

export async function signSubscriptionContract(input: {
  userId: string
  email: string
  planCode: string
  billingCycle: BillingCycle
  paymentMethod: PaymentMethod
  signatureDataUrl: string
  termsAccepted: boolean
  privacyAccepted: boolean
  contractAccepted: boolean
  commitmentAccepted: boolean
  ipAddress?: string | null
  userAgent?: string | null
}) {
  if (!input.contractAccepted || !input.termsAccepted || !input.privacyAccepted) throw new Error("Aceite o contrato, os Termos de Uso e o Aviso de Privacidade.")
  if (input.billingCycle !== "monthly" && !input.commitmentAccepted) throw new Error("Confirme a permanência mínima e a regra de cancelamento antes de assinar.")

  const pool = getPostgresPool()
  const userResult = await pool.query<{ name: string; email: string; cpf: string | null; billing_account_id: string | null }>(`
    SELECT u.name, u.email, u.cpf,
      (SELECT id FROM sf_billing_accounts WHERE owner_user_id = u.id LIMIT 1) AS billing_account_id
    FROM sf_users u WHERE u.id = $1 LIMIT 1
  `, [input.userId])
  const user = userResult.rows[0]
  if (!user?.billing_account_id) throw new Error("Conta comercial não encontrada.")

  const planResult = await pool.query<{ id: string; code: string; name: string; monthly_price_cents: number | null; semiannual_price_cents: number | null; annual_price_cents: number | null }>(`
    SELECT id, code, name, monthly_price_cents, semiannual_price_cents, annual_price_cents
    FROM sf_plans WHERE lower(code) = lower($1) AND active = true AND internal = false AND checkout_enabled = true LIMIT 1
  `, [input.planCode])
  const plan = planResult.rows[0]
  if (!plan) throw new Error("Plano comercial indisponível.")

  const amountCents = input.billingCycle === "annual" ? plan.annual_price_cents : input.billingCycle === "semiannual" ? plan.semiannual_price_cents : plan.monthly_price_cents
  if (!amountCents || amountCents <= 0) throw new Error("Valor do plano indisponível para o período escolhido.")
  const terms = commercialCycleTerms(input.billingCycle)
  const signature = parseSignatureJpegDataUrl(input.signatureDataUrl)
  const contractId = randomUUID()
  const signedAt = new Date().toISOString()
  const pdf = buildSignedContractPdf({
    contractId,
    signerName: user.name,
    signerEmail: user.email,
    signerCpfMasked: maskCpf(user.cpf),
    planCode: plan.code,
    planName: plan.name,
    billingCycle: input.billingCycle,
    paymentMethod: input.paymentMethod,
    contractValueCents: amountCents,
    recurringAmountCents: terms.installmentCents,
    commitmentMonths: terms.commitmentMonths,
    signedAtIso: signedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    signatureJpeg: signature.buffer,
    signatureWidth: signature.width,
    signatureHeight: signature.height,
  })
  const pdfSha256 = createHash("sha256").update(pdf).digest("hex")

  await pool.query(`
    INSERT INTO sf_signed_contracts (
      id, billing_account_id, user_id, plan_id, plan_code, billing_cycle, payment_method,
      contract_version, terms_version, privacy_version,
      contract_value_cents, recurring_amount_cents, commitment_months, early_termination_penalty_percent,
      signature_mime, signature_bytes, signature_sha256, signed_pdf, pdf_sha256,
      ip_address, user_agent, signed_at, status, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
      'image/jpeg',$15,$16,$17,$18,$19,$20,$21,'signed',now(),now()
    )
  `, [
    contractId, user.billing_account_id, input.userId, plan.id, plan.code, input.billingCycle, input.paymentMethod,
    SUBSCRIPTION_CONTRACT_VERSION, TERMS_VERSION, PRIVACY_VERSION,
    amountCents, terms.installmentCents, terms.commitmentMonths, EARLY_TERMINATION_PENALTY_PERCENT,
    signature.buffer, signature.sha256, pdf, pdfSha256,
    input.ipAddress || null, input.userAgent || null, signedAt,
  ])

  return { id: contractId, pdfSha256, signedAt }
}

export async function assertSignedContractForCheckout(input: {
  contractId: string
  userId: string
  planCode: string
  billingCycle: BillingCycle
  paymentMethod: PaymentMethod
}) {
  const result = await getPostgresPool().query<{ id: string; checkout_session_id: string | null; subscription_id: string | null }>(`
    SELECT id, checkout_session_id, subscription_id
    FROM sf_signed_contracts
    WHERE id = $1 AND user_id = $2 AND lower(plan_code) = lower($3)
      AND billing_cycle = $4 AND payment_method = $5
      AND status IN ('signed','payment_pending')
    LIMIT 1
  `, [input.contractId, input.userId, input.planCode, input.billingCycle, input.paymentMethod])
  const row = result.rows[0]
  if (!row) throw new Error("Assine o contrato desta contratação antes de continuar para o pagamento.")
  if (row.checkout_session_id || row.subscription_id) throw new Error("Este contrato já foi vinculado a outra tentativa de pagamento. Assine novamente para continuar.")
  return row
}

export async function linkSignedContractToCheckout(input: { contractId: string; userId: string; checkoutSessionId: string; subscriptionId: string }) {
  await getPostgresPool().query(`
    UPDATE sf_signed_contracts
    SET checkout_session_id = $3, subscription_id = $4, status = 'payment_pending', updated_at = now()
    WHERE id = $1 AND user_id = $2 AND checkout_session_id IS NULL AND subscription_id IS NULL
  `, [input.contractId, input.userId, input.checkoutSessionId, input.subscriptionId])
}

export async function getSignedContractPdfForUser(contractId: string, userId: string) {
  const result = await getPostgresPool().query<{ signed_pdf: Buffer; pdf_sha256: string; status: string }>(`
    SELECT signed_pdf, pdf_sha256, status FROM sf_signed_contracts WHERE id = $1 AND user_id = $2 LIMIT 1
  `, [contractId, userId])
  return result.rows[0] || null
}

export async function sendSignedContractAfterPayment(localSubscriptionId: string) {
  const pool = getPostgresPool()
  const result = await pool.query<{
    id: string; signed_pdf: Buffer; email_sent_at: Date | string | null; signer_email: string; signer_name: string;
    plan_code: string; billing_cycle: string; pdf_sha256: string
  }>(`
    SELECT c.id, c.signed_pdf, c.email_sent_at, u.email AS signer_email, u.name AS signer_name,
      c.plan_code, c.billing_cycle, c.pdf_sha256
    FROM sf_signed_contracts c
    INNER JOIN sf_users u ON u.id = c.user_id
    WHERE c.subscription_id = $1
    ORDER BY c.signed_at DESC LIMIT 1
  `, [localSubscriptionId])
  const contract = result.rows[0]
  if (!contract || contract.email_sent_at) return { sent: false, reason: contract ? "already_sent" : "not_found" }

  await pool.query(`UPDATE sf_signed_contracts SET payment_approved_at = COALESCE(payment_approved_at, now()), status = 'approved', updated_at = now() WHERE id = $1`, [contract.id])
  try {
    const sent = await sendEmailWithPdfAttachment({
      to: contract.signer_email,
      subject: "SaborFlow - pagamento aprovado e contrato confirmado",
      html: `<div style="font-family:Arial,sans-serif;color:#292524"><h2>Pagamento aprovado</h2><p>Olá, ${contract.signer_name}.</p><p>Seu pagamento do SaborFlow foi confirmado e o contrato eletrônico está aprovado.</p><p><strong>Plano:</strong> ${contract.plan_code}<br/><strong>Período:</strong> ${contract.billing_cycle}</p><p>O PDF assinado segue anexado a este e-mail para seu arquivo.</p><p style="font-size:12px;color:#78716c">Hash SHA-256 do PDF: ${contract.pdf_sha256}</p></div>`,
      filename: `Contrato-SaborFlow-${contract.id}.pdf`,
      pdf: contract.signed_pdf,
      idempotencyKey: `saborflow-contract-paid/${contract.id}`,
    })
    await pool.query(`UPDATE sf_signed_contracts SET email_sent_at = now(), email_provider_id = $2, email_error = NULL, updated_at = now() WHERE id = $1`, [contract.id, sent.id])
    return { sent: true }
  } catch (error) {
    await pool.query(`UPDATE sf_signed_contracts SET email_error = $2, updated_at = now() WHERE id = $1`, [contract.id, error instanceof Error ? error.message : "Falha no envio do e-mail."]).catch(() => undefined)
    console.error("[SaborFlow Contract] Pagamento aprovado, mas o e-mail do contrato não foi enviado:", error)
    return { sent: false, reason: "email_failed" }
  }
}
