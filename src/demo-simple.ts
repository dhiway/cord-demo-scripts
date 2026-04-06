/**
 * demo-simple.ts
 *
 * Minimal CORD SDK demo — connects, checks balance, creates a registry and one entry.
 * Good starting point for understanding the new SDK (0.9.6-10+).
 *
 * Run:  tsx --no-cache src/demo-simple.ts
 * Env:  NETWORK_ADDRESS  (default: ws://127.0.0.1:9944)
 */

import * as Cord from '@cord.network/sdk'
import { blake2AsHex } from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/keyring'

const EVENT_TIMEOUT = 10_000

async function waitForEvent(
  api: Cord.ApiPromise,
  check: (event: any) => boolean,
  fieldIndex: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let unsub: () => void
    api.query.system.events((events) => {
      events.forEach(({ phase, event }) => {
        if (phase.isApplyExtrinsic && check(event)) {
          resolve(event.data[fieldIndex].toHuman() as string)
          if (unsub) unsub()
        }
      })
    })
      .then((u) => { unsub = u })
      .catch(reject)
    setTimeout(() => { if (unsub) unsub(); reject(new Error('Timeout: event not found')) }, EVENT_TIMEOUT)
  })
}

async function main() {
  console.log('🚀 Starting simple CORD SDK demo...')

  const networkAddress = process.env.NETWORK_ADDRESS || 'ws://127.0.0.1:9944'
  console.log(`🔗 Connecting to: ${networkAddress}`)

  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK })
  await Cord.connect(networkAddress)
  console.log('✅ Connected to CORD network')

  const api = Cord.ConfigService.get('api')
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ])
  console.log(`⛓️  Chain: ${chain}`)
  console.log(`🏷️  Node: ${nodeName} v${nodeVersion}`)

  // Use Alice (pre-funded on dev chains)
  const keyring = new Keyring({ type: 'sr25519' })
  const alice = keyring.createFromUri('//Alice')
  const { data: { free: balance } } = await api.query.system.account(alice.address)
  console.log(`🏦 Alice: ${alice.address}`)
  console.log(`💰 Balance: ${balance.toString()} units`)

  // ── Profile ──────────────────────────────────────────────────────────────────
  console.log('\n📋 Setting profile for Alice...')
  const profileData = Object.entries({ pub_name: 'Alice', pub_email: 'alice@cord.network' })
    .map(([k, v]) => [k, blake2AsHex(v)])
  await Cord.Profile.dispatchSetProfileToChain(profileData, alice)
  const profileId = await waitForEvent(api, (e) => api.events.profile.ProfileSet.is(e), 1)
  console.log(`✅ Profile created: ${profileId}`)

  // ── Registry ─────────────────────────────────────────────────────────────────
  console.log('\n📂 Creating a registry...')
  const blob = JSON.stringify({ name: 'Simple Demo Registry', createdAt: new Date().toISOString() })
  const hash = await Cord.Registry.getDigestFromRawData(blob)
  const registryProps = await Cord.Registry.registryCreateProperties(hash, blob)
  await Cord.Registry.dispatchCreateToChain(registryProps, alice)
  const registryId = await waitForEvent(api, (e) => api.events.registry.RegistryCreated.is(e), 0)
  console.log(`✅ Registry: ${registryId}`)

  // ── Entry ─────────────────────────────────────────────────────────────────────
  console.log('\n📄 Creating an entry...')
  const entryBlob = JSON.stringify({ id: 'entry-001', data: 'Hello, CORD!', ts: Date.now() })
  const entryHash = await Cord.Registry.getDigestFromRawData(entryBlob)
  const entryProps = await Cord.Entry.createEntriesProperties(registryId, entryHash, entryBlob)
  await Cord.Entry.dispatchCreateEntryToChain(entryProps, alice)
  const entryId = await waitForEvent(api, (e) => api.events.entry.RegistryEntryCreated.is(e), 2)
  console.log(`✅ Entry: ${entryId}`)

  // ── Verify ───────────────────────────────────────────────────────────────────
  console.log('\n🔍 Verifying entry...')
  const result = await Cord.Entry.verifyAgainstInputProperties(entryId, entryHash, profileId, registryId)
  console.log(result.isValid ? '✅ Entry is VALID!' : `🚫 Verification failed: ${result.message}`)

  console.log('\n✅ Simple demo completed!')
}

main()
  .then(() => {
    Cord.disconnect()
    console.log('👋 Disconnected')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    Cord.disconnect()
    process.exit(1)
  })
