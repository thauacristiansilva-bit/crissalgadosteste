export async function sendEmailWithPdfAttachment(input: {
  to: string
  subject: string
  html: string
  filename: string
  pdf: Buffer
  idempotencyKey: string
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "SaborFlow <contratos@resend.dev>"
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada.")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      attachments: [{
        filename: input.filename,
        content: input.pdf.toString("base64"),
        content_type: "application/pdf",
      }],
    }),
  })
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string }
  if (!response.ok) throw new Error(payload.message || payload.name || `Falha ao enviar e-mail (${response.status}).`)
  return { id: payload.id || null }
}
