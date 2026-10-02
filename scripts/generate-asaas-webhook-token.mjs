import { randomBytes } from "node:crypto"
console.log(`whsec_${randomBytes(32).toString("hex")}`)
