const { Client } = require("pg")

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date)

  const get = (type) =>
    parts.find((part) => part.type === type)?.value || ""

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    day: weekdayMap[get("weekday")] ?? -1,
  }
}

async function main() {
  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_PUBLIC_URL/DATABASE_URL nao encontrada.")
  }

  const client = new Client({
    connectionString,
    ...(process.env.DATABASE_PUBLIC_URL
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  })

  await client.connect()

  try {
    const result = await client.query(`
      SELECT
        p.id,
        p.organization_id,
        o.name AS organization_name,
        p.product_id,
        prod.name AS product_name,
        prod.price AS normal_price,
        p.promotional_price,
        p.starts_on,
        p.ends_on,
        p.days_of_week,
        p.start_time::text,
        p.end_time::text,
        p.recurring_weekly,
        p.active,
        p.highlight,
        p.label,
        COALESCE(s.timezone, 'America/Sao_Paulo') AS timezone,
        p.created_at,
        p.updated_at
      FROM sf_product_promotions p
      INNER JOIN sf_products prod
        ON prod.organization_id = p.organization_id
       AND prod.id = p.product_id
      LEFT JOIN sf_organizations o
        ON o.id = p.organization_id
      LEFT JOIN sf_organization_settings s
        ON s.organization_id = p.organization_id
      ORDER BY p.updated_at DESC
      LIMIT 20
    `)

    if (!result.rows.length) {
      console.log("NENHUMA PROMOCAO ENCONTRADA.")
      return
    }

    console.log("")
    console.log("==============================================")
    console.log("DIAGNOSTICO DAS PROMOCOES")
    console.log("==============================================")

    for (const row of result.rows) {
      const now = zonedParts(new Date(), row.timezone)
      const days = Array.isArray(row.days_of_week)
        ? row.days_of_week.map(Number)
        : []

      const startDate = row.starts_on
        ? new Date(row.starts_on).toISOString().slice(0, 10)
        : null

      const endDate = row.ends_on
        ? new Date(row.ends_on).toISOString().slice(0, 10)
        : null

      const startTime = String(row.start_time || "").slice(0, 5)
      const endTime = String(row.end_time || "").slice(0, 5)

      const checks = {
        active: Boolean(row.active),
        priceLower:
          Number(row.promotional_price) < Number(row.normal_price),
        startDateOk:
          !startDate || now.date >= startDate,
        endDateOk:
          !endDate || now.date <= endDate,
        weekdayOk:
          days.includes(now.day),
        timeOk:
          now.time >= startTime && now.time <= endTime,
      }

      const promotionActiveNow =
        checks.active &&
        checks.priceLower &&
        checks.startDateOk &&
        checks.endDateOk &&
        checks.weekdayOk &&
        checks.timeOk

      console.log("")
      console.log("----------------------------------------------")
      console.log(`Empresa: ${row.organization_name || row.organization_id}`)
      console.log(`Produto: ${row.product_name} (id ${row.product_id})`)
      console.log(`Preco normal: ${Number(row.normal_price).toFixed(2)}`)
      console.log(`Preco promocional: ${Number(row.promotional_price).toFixed(2)}`)
      console.log(`Ativa no admin: ${row.active}`)
      console.log(`Destaque: ${row.highlight}`)
      console.log(`Rotulo: ${row.label}`)
      console.log(`Timezone: ${row.timezone}`)
      console.log(`Agora na loja: ${now.date} ${now.time} | dia ${now.day}`)
      console.log(`Data inicial: ${startDate || "sem limite"}`)
      console.log(`Data final: ${endDate || "sem limite"}`)
      console.log(`Dias permitidos: [${days.join(", ")}]`)
      console.log(`Horario: ${startTime} ate ${endTime}`)
      console.log("")
      console.log("Validacoes:")
      console.log(checks)
      console.log("")
      console.log(
        promotionActiveNow
          ? "RESULTADO: PROMOCAO DEVERIA ESTAR ATIVA PARA O CLIENTE."
          : "RESULTADO: PROMOCAO NAO ESTA ATIVA PARA O CLIENTE."
      )
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("")
  console.error("ERRO NO DIAGNOSTICO:")
  console.error(error)
  process.exit(1)
})
