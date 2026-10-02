const apiKey = process.env.RESEND_API_KEY?.trim()
const from = process.env.RESEND_FROM_EMAIL?.trim()
const to = process.env.CONTRACT_TEST_EMAIL?.trim()
if (!apiKey) throw new Error("RESEND_API_KEY não configurada.")
if (!from) throw new Error("RESEND_FROM_EMAIL não configurado.")
if (!to) throw new Error("CONTRACT_TEST_EMAIL não configurado.")
const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from, to: [to], subject: "SaborFlow - teste de e-mail de contrato", html: "<p>Integração de e-mail do contrato funcionando.</p>" }),
})
const payload = await response.json().catch(() => ({}))
console.log(JSON.stringify({ ok: response.ok, status: response.status, response: payload }, null, 2))
if (!response.ok) process.exit(1)
