// Security regression tests. Uses an isolated database adapter and never sends messages.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const { randomUUID } = require("node:crypto")
const { test } = require("node:test")
const root = path.resolve(__dirname,"..")

function load(file, replacements={}) {
  const location = path.join(root,file)
  const code = ts.transpileModule(fs.readFileSync(location,"utf8"),{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true } }).outputText
  const mod = new Module(location,module)
  mod.paths = module.paths
  const original = mod.require.bind(mod)
  mod.require = (name) => Object.hasOwn(replacements,name) ? replacements[name] : original(name)
  mod._compile(code,location)
  return mod.exports
}
const crypto = load("lib/security/delivery-code-crypto.ts")
const user = "11111111-1111-4111-8111-111111111111"
const secret = "isolated-regression-test-only"
const email = "owner@example.com"

function fixture(options={}) {
  const binding = crypto.deliveryBinding("login-browser-A")
  const id = randomUUID()
  const row = { id,user_id:user,channel:"email",purpose:"login",recipient:email,binding_hash:binding,code_hash:crypto.hashDeliveryCode(secret,id,user,binding,"012345"),attempts:0,used:false,sent:true,expired:false,...options }
  let queries = 0
  let contactExists = true
  let enrolled = false
  const client = {
    release() {},
    async query(sql, params=[]) {
      queries++
      if (["BEGIN","COMMIT","ROLLBACK"].includes(sql) || sql.startsWith("SELECT pg_advisory")) return { rows:[],rowCount:0 }
      if (sql.startsWith("SELECT id,channel,purpose")) return { rows:params[0] === row.id && params[1] === row.user_id ? [{ ...row,valid:!row.used && row.sent && !row.expired }] : [] }
      if (sql.startsWith("SELECT u.email")) return { rows:[{ email }],rowCount:1 }
      if (sql.startsWith("SELECT 1 FROM sf_mfa_delivery_contacts")) return { rows:contactExists ? [{}] : [],rowCount:contactExists ? 1 : 0 }
      if (sql.startsWith("UPDATE sf_mfa_delivery_codes SET attempts")) { row.attempts++;return { rowCount:1 } }
      if (sql.startsWith("UPDATE sf_mfa_delivery_codes SET used_at")) { row.used=true;return { rowCount:1 } }
      if (sql.startsWith("INSERT INTO sf_mfa_delivery_contacts")) { enrolled=true;return { rowCount:1 } }
      throw new Error(`Unexpected test query: ${sql}`)
    },
  }
  const service = load("lib/security/delivery-codes.ts", {
    "@/lib/postgres":{ getPostgresPool:() => ({ connect:async () => client }) },
    "@/lib/rls-context":{ runWithRlsUserContext:(_,fn) => fn() },
    "@/lib/integration-providers":{ dispatchIntegrationMessage:() => { throw new Error("Messages must never be sent by these tests.") } },
    "./delivery-code-crypto":crypto,
  })
  const consume = (overrides={}) => service.consumeDeliveryCode({ userId:user,id,code:"012345",purpose:"login",binding:"login-browser-A",...overrides })
  return { row,consume,contactRemoved:() => { contactExists=false },enrolled:() => enrolled,queries:() => queries }
}

// No production secret or provider credentials are read or printed.
process.env.SESSION_SECRET = secret
process.env.AUTH_DELIVERY_CODES_ENABLED = "true"
process.env.AUTH_RESEND_API_KEY = "test-never-used"
process.env.AUTH_EMAIL_FROM = "test@example.com"

test("a valid delivered code is accepted exactly once",async () => {
  const f=fixture(); assert.equal(await f.consume(),true);assert.equal(await f.consume(),false)
})
test("a code cannot move between accounts, login challenges or purposes",async () => {
  for (const override of [{ userId:randomUUID() },{ binding:"login-browser-B" },{ purpose:"enroll" }]) {
    const f=fixture();assert.equal(await f.consume(override),false);assert.equal(f.row.used,false)
  }
})
test("expired, unsent and previously used codes cannot authenticate",async () => {
  for (const state of [{ expired:true },{ sent:false },{ used:true }]) assert.equal(await fixture(state).consume(),false)
})
test("five wrong attempts invalidate the code even if the next code is correct",async () => {
  const f=fixture();for(let i=0;i<5;i++) assert.equal(await f.consume({ code:"999999" }),false)
  assert.equal(f.row.attempts,5);assert.equal(await f.consume(),false)
})
test("removing a confirmed contact prevents a pending login code from being used",async () => {
  const f=fixture();f.contactRemoved();assert.equal(await f.consume(),false)
})
test("changed email cannot authenticate through the previous email",async () => {
  assert.equal(await fixture({ recipient:"old@example.com" }).consume(),false)
})
test("enrollment only confirms a code in its initiating session",async () => {
  const f=fixture({ purpose:"enroll" });assert.equal(await f.consume({ purpose:"enroll",binding:"different-session" }),false)
  assert.equal(f.enrolled(),false);assert.equal(await f.consume({ purpose:"enroll" }),true);assert.equal(f.enrolled(),true)
})
test("malformed IDs and codes never reach the database",async () => {
  const f=fixture();assert.equal(await f.consume({ id:"------------------------------------" }),false)
  assert.equal(await f.consume({ code:"01234a" }),false);assert.equal(f.queries(),0)
})
test("phone input preserves the country code and masks contact details",() => {
  assert.equal(crypto.normalizeDeliveryPhone("(99) 98104-8054"),"+5599981048054")
  assert.equal(crypto.normalizeDeliveryPhone("+55 99 98104-8054"),"+5599981048054")
  assert.throws(() => crypto.normalizeDeliveryPhone("123"));assert.throws(() => crypto.deliveryChannel("whatsapp"))
  assert.equal(crypto.maskedRecipient("email",email),"o•••@example.com")
  assert.equal(crypto.maskedRecipient("sms","+5599981048054").includes("98104"),false)
})
