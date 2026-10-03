async function main() {
  const base = String(
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    "",
  ).replace(/\/+$/, "")

  const secret = String(process.env.CRON_SECRET || "")

  if (!base) {
    throw new Error("APP_PUBLIC_URL nao configurada.")
  }
  if (!secret) {
    throw new Error("CRON_SECRET nao configurada.")
  }

  const response = await fetch(
    `${base}/api/cron/marketing-publications`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    },
  )

  const text = await response.text()
  console.log(text)

  if (!response.ok) {
    throw new Error(
      `Cron retornou HTTP ${response.status}.`,
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
