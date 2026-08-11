import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const mount =
  (process.env.RAILWAY_VOLUME_MOUNT_PATH || "").trim()

const dataFile =
  process.env.DATA_FILE ||
  (mount
    ? path.join(mount, "store.json")
    : path.join(process.cwd(), "data", "store.json"))

console.log(`RAILWAY_VOLUME_MOUNT_PATH=${mount || "(ausente)"}`)
console.log(`DATA_FILE=${dataFile}`)

try {
  const raw = await fs.readFile(dataFile, "utf8")
  const data = JSON.parse(raw)

  console.log("store.json: OK")
  console.log(
    `categories=${Array.isArray(data.categories) ? data.categories.length : 0}`,
  )
  console.log(
    `products=${Array.isArray(data.products) ? data.products.length : 0}`,
  )
  console.log(
    `orders=${Array.isArray(data.orders) ? data.orders.length : 0}`,
  )
  console.log(
    `customerAccounts=${Array.isArray(data.customerAccounts) ? data.customerAccounts.length : 0}`,
  )
} catch (error) {
  console.error("store.json: NÃO ENCONTRADO/INVÁLIDO")
  console.error(
    error instanceof Error ? error.message : error,
  )
  process.exit(1)
}
