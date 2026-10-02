// Regression checks against the real service with an isolated database adapter.
// No real accounts, messages or production database are used.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { test } = require('node:test')
const root = path.resolve(__dirname, '..')
function load(file, mocks = {}) {
  const exports = {}; const module = { exports }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, module, require: name => name in mocks ? mocks[name] : require(name), process, console, Date, Buffer }, { filename: file })
  return module.exports
}
const basic = load('lib/basic-trial.ts')
const profile = { storeName: 'Loja da Ana', segment: basic.businessSegments[0], experience: basic.systemExperiences[0], dailyOrders: basic.dailyOrderRanges[0] }
function service(options = {}) {
  const calls = []
  const client = { release() {}, async query(sql, params = []) {
    calls.push({ sql, params })
    if (sql.includes("FROM sf_users WHERE id")) return { rows: options.inactive ? [] : [{ id: params[0] }], rowCount: options.inactive ? 0 : 1 }
    if (sql.includes('SELECT organization_id') && sql.includes('FROM sf_demo_environments')) return { rows: [], rowCount: 0 }
    if (sql.includes('d.id AS environment_id')) return { rows: options.reuse ? [{ environment_id: 'env-active', organization_id: 'org-active', trade_name: 'Original', slug: 'teste-original', admin_user_id: 'demo-user', email: 'demo@example.invalid', session_version: 1, expires_at: new Date(Date.now() + 3600000) }] : [], rowCount: options.reuse ? 1 : 0 }
    if (sql.includes("SELECT metadata ->> 'mode'")) return { rows: [{ mode: options.legacy ? 'legacy' : 'basic' }], rowCount: 1 }
    if (sql.includes("SELECT id FROM sf_demo_environments WHERE requested_by_user_id")) return { rows: options.expired ? [{ id: 'old' }] : [], rowCount: options.expired ? 1 : 0 }
    if (sql.includes('SELECT id FROM sf_plans')) return { rows: [{ id: 'demo-plan' }], rowCount: 1 }
    if (sql.includes('COUNT(*)')) return { rows: [{ count: '0' }], rowCount: 1 }
    return { rows: [], rowCount: 0 }
  } }
  const pool = { connect: async () => client, query: (...args) => client.query(...args) }
  return { calls, ...load('lib/demo-db.ts', { '@/lib/basic-trial': basic, '@/lib/postgres': { getPostgresPool: () => pool }, '@/lib/rls-context': { runWithRlsBypass: fn => fn() }, '@/lib/operations': { defaultBusinessHours: [] }, '@/lib/demo-policy': { expireDemoOrganizationIfNeeded: async () => false } }) }
}
test('profile only accepts bounded, known answers', () => {
  assert.equal(basic.parseBasicTrialProfile({ ...profile, storeName: '  Loja  ' }).storeName, 'Loja')
  for (const bad of [null, [], { ...profile, storeName: 'a' }, { ...profile, storeName: 'a'.repeat(81) }, { ...profile, segment: 'admin' }, { ...profile, experience: {} }, { ...profile, dailyOrders: '' }]) assert.throws(() => basic.parseBasicTrialProfile(bad))
})
test('basic creation starts empty, persists profile and disables AI in settings and entitlements', async () => {
  const db = service(); const result = await db.createDemoEnvironment({ kind: 'trial', requestedByUserId: 'owner-1', basicProfile: profile })
  assert.equal(result.reused, false); assert.equal(result.organization.name, profile.storeName)
  assert.ok(result.organization.slug.startsWith('teste-'))
  assert.ok(!db.calls.some(c => /INSERT INTO sf_(products|orders|customer_accounts|ingredients)\s*\(/.test(c.sql)))
  const account = db.calls.find(c => c.sql.includes('INSERT INTO sf_billing_accounts'))
  const rights = JSON.parse(account.params[4]); assert.equal(rights.aiSetup, false); assert.equal(rights.integrations, false); assert.equal(rights.maxProducts, 30)
  const settings = JSON.parse(db.calls.find(c => c.sql.includes('INSERT INTO sf_organization_settings')).params[1])
  assert.equal(settings.acceptingOrders, false); assert.equal(settings.aiPdvEnabled, false); assert.equal(settings.aiFloatingButtonEnabled, false); assert.equal(settings.phone, '')
  const env = db.calls.find(c => c.sql.includes('INSERT INTO sf_demo_environments')); const meta = JSON.parse(env.params[7])
  assert.equal(env.params[5], 'owner-1'); assert.equal(meta.businessProfile.segment, profile.segment); assert.equal(meta.mode, 'basic')
  assert.ok(Math.abs(new Date(result.expiresAt).getTime() - Date.now() - 7*86400000) < 5000)
  for (const table of ['catalog', 'orders', 'customers', 'operations', 'food_composition']) assert.ok(db.calls.some(c => c.sql.includes(`INSERT INTO sf_${table}_state`)))
  assert.equal(db.calls.at(-1).sql, 'COMMIT')
})
test('active trial is reused under the account lock without resetting expiry or data', async () => {
  const db = service({ reuse: true }); const result = await db.createDemoEnvironment({ kind: 'trial', requestedByUserId: 'owner-1', basicProfile: profile })
  assert.equal(result.organization.name, 'Original'); assert.equal(result.reused, true)
  assert.ok(db.calls.some(c => c.sql.includes('pg_advisory_xact_lock') && c.params[0].endsWith('owner-1')))
  const lookup = db.calls.find(c => c.sql.includes('d.id AS environment_id')); assert.equal(lookup.params[0], 'owner-1'); assert.ok(lookup.sql.includes('d.requested_by_user_id = $1'))
  assert.ok(!db.calls.some(c => c.sql.includes('INSERT INTO')))
})
test('resume does not create a new trial and inactive or exhausted accounts cannot create one', async () => {
  for (const [options, input] of [[{}, { resumeOnly: true }], [{ inactive: true }, { basicProfile: profile }], [{ expired: true }, { basicProfile: profile }]]) {
    const db = service(options); await assert.rejects(db.createDemoEnvironment({ kind: 'trial', requestedByUserId: 'owner-1', ...input })); assert.ok(!db.calls.some(c => c.sql.includes('INSERT INTO sf_organizations'))); assert.equal(db.calls.at(-1).sql, 'ROLLBACK')
  }
})
test('a pre-existing full demo is not silently converted or overwritten', async () => {
  const db = service({ reuse: true, legacy: true }); await assert.rejects(db.createDemoEnvironment({ kind: 'trial', requestedByUserId: 'owner-1', basicProfile: profile })); assert.ok(!db.calls.some(c => c.sql.includes('INSERT INTO')))
})
test('public demo keeps its seeded catalog', async () => {
  const db = service(); await db.createDemoEnvironment({ kind: 'public' }); assert.ok(db.calls.some(c => c.sql.includes('INSERT INTO sf_products')))
})
test('basic profile cannot create an anonymous or public environment', async () => {
  const db = service(); await assert.rejects(db.createDemoEnvironment({ kind: 'public', basicProfile: profile })); assert.equal(db.calls.length, 0)
})
test('basic trial blocks direct AI settings changes but permits basic operations', async () => {
  const policy = load('lib/demo-policy.ts', { '@/lib/postgres': { getPostgresPool: () => ({ query: async () => ({ rows: [{ id: 'env', kind: 'trial', status: 'active', organization_id: 'org', expires_at: new Date(Date.now() + 3600000), started_at: new Date(), last_seen_at: new Date(), basic_mode: true }] }) }) } })
  await assert.rejects(policy.assertDemoSettingsPatchAllowed('org', { aiPdvEnabled: true }))
  await assert.rejects(policy.assertDemoSettingsPatchAllowed('org', { chatbotEnabled: true }))
  await assert.rejects(policy.assertDemoSettingsPatchAllowed('org', { autoPrintNewOrders: true }))
  await policy.assertDemoSettingsPatchAllowed('org', { acceptingOrders: true, storeName: 'Loja' })
})
