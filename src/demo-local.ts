/**
 * demo-local.ts
 *
 * Interactive step-by-step demo using the new CORD SDK (0.9.6-10+).
 * Uses Registry + Entry + Profile (no DIDs required).
 *
 * Run:  tsx --no-cache src/demo-local.ts
 * Env:  NETWORK_ADDRESS  (default: ws://127.0.0.1:9944)
 *       STASH_URI        (default: //Alice)
 */

import readline from 'readline'
import * as Cord from '@cord.network/sdk'
import { DokenHistory } from '@cord.network/utils'
import { blake2AsHex } from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/keyring'
import { createAccount } from './utils/createAccount'

const TRANSFER_AMOUNT = 30 * 10 ** 12 // 30 WAY
const EVENT_TIMEOUT = 10_000

// ── Helpers ──────────────────────────────────────────────────────────────────

async function pause(msg = 'Press Enter to continue...'): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise<void>((resolve) => rl.question(msg, () => { rl.close(); resolve() }))
}

function hashProfile(data: Record<string, string>) {
  return Object.entries(data).map(([k, v]) => [k, blake2AsHex(v)])
}

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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const networkAddress = process.env.NETWORK_ADDRESS || 'ws://127.0.0.1:9944'
  const stashUri = process.env.STASH_URI || '//Alice'

  console.log('🚀 CORD Interactive Demo (Registry + Entry)')
  console.log(`🔗 Network: ${networkAddress}`)
  console.log('───────────────────────────────────────────')

  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK })
  await Cord.connect(networkAddress)

  const api = Cord.ConfigService.get('api')
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ])
  console.log(`⛓️  Chain: ${chain}  |  Node: ${nodeName} v${nodeVersion}`)

  // ── Step 1: Accounts ────────────────────────────────────────────────────────
  console.log('\n═══ Step 1: Accounts ═══')
  const keyring = new Keyring({ type: 'sr25519' })
  const stash = keyring.createFromUri(stashUri)
  console.log(`🏦 Stash (${stashUri}): ${stash.address}`)

  const { account: issuer } = createAccount()
  const { account: holder } = createAccount()
  console.log(`🏛  Issuer : ${issuer.address}`)
  console.log(`👤 Holder : ${holder.address}`)

  console.log('\n💸 Funding issuer and holder from stash...')
  for (const [idx, acc] of [issuer, holder].entries()) {
    await new Promise<void>((resolve, reject) => {
      api.tx.balances
        .transferKeepAlive(acc.address, TRANSFER_AMOUNT)
        .signAndSend(stash, ({ status, dispatchError }) => {
          if (dispatchError) reject(new Error(`Funding failed: ${dispatchError}`))
          else if (status.isInBlock) { console.log(`✅ Funded account ${idx + 1}`); resolve() }
        })
        .catch(reject)
    })
  }
  console.log('✅ Accounts funded!')
  await pause()

  // ── Step 2: Profiles ─────────────────────────────────────────────────────────
  console.log('\n═══ Step 2: Profiles ═══')
  await Cord.Profile.dispatchSetProfileToChain(
    hashProfile({ pub_name: 'Issuer Org', pub_email: 'issuer@example.com' }),
    issuer
  )
  const issuerId = await waitForEvent(api, (e) => api.events.profile.ProfileSet.is(e), 1)
  console.log(`✅ Issuer profile: ${issuerId}`)

  await Cord.Profile.dispatchSetProfileToChain(
    hashProfile({ pub_name: 'Credential Holder', pub_email: 'holder@example.com' }),
    holder
  )
  const holderId = await waitForEvent(api, (e) => api.events.profile.ProfileSet.is(e), 1)
  console.log(`✅ Holder profile: ${holderId}`)
  await pause()

  // ── Step 3: Registry ─────────────────────────────────────────────────────────
  console.log('\n═══ Step 3: Create Registry ═══')
  const registryBlob = JSON.stringify({
    title: 'Academic Credentials',
    description: 'Registry for issuing academic credentials',
    version: '1.0',
  })
  const registryHash = await Cord.Registry.getDigestFromRawData(registryBlob)
  const registryProps = await Cord.Registry.registryCreateProperties(registryHash, registryBlob)
  console.dir(registryProps, { depth: 3, colors: true })

  await Cord.Registry.dispatchCreateToChain(registryProps, issuer)
  const registryId = await waitForEvent(
    api,
    (e) => api.events.registry.RegistryCreated.is(e),
    0
  )
  console.log(`✅ Registry created: ${registryId}`)
  await pause()

  // ── Step 4: Create Entry (Credential) ────────────────────────────────────────
  console.log('\n═══ Step 4: Issue Credential (Entry) ═══')
  const credentialBlob = JSON.stringify({
    credentialType: 'BachelorOfScience',
    subject: 'Holder',
    issuedOn: new Date().toISOString(),
    grade: 'A',
    validUntil: '2030-12-31',
  })
  const credentialHash = await Cord.Registry.getDigestFromRawData(credentialBlob)
  const entryProps = await Cord.Entry.createEntriesProperties(registryId, credentialHash, credentialBlob)
  console.dir(entryProps, { depth: 3, colors: true })

  await Cord.Entry.dispatchCreateEntryToChain(entryProps, issuer)
  const entryId = await waitForEvent(
    api,
    (e) => api.events.entry.RegistryEntryCreated.is(e),
    2
  )
  console.log(`✅ Credential issued: ${entryId}`)
  await pause()

  // ── Step 5: Verify Credential ─────────────────────────────────────────────────
  console.log('\n═══ Step 5: Verify Credential ═══')
  const verifyResult = await Cord.Entry.verifyAgainstInputProperties(
    entryId,
    credentialHash,
    issuerId,
    registryId
  )
  if (verifyResult.isValid) {
    console.log(`✅ Credential is VALID! 🎉`)
  } else {
    console.log(`🚫 Credential verification failed: ${verifyResult.message}`)
  }
  await pause()

  // ── Step 6: Update Credential ─────────────────────────────────────────────────
  console.log('\n═══ Step 6: Update Credential ═══')
  const updatedBlob = JSON.stringify({
    credentialType: 'BachelorOfScience',
    subject: 'Holder',
    issuedOn: new Date().toISOString(),
    grade: 'A+',
    validUntil: '2031-12-31',
    amendment: 'Grade revised after re-evaluation',
  })
  const updatedHash = await Cord.Registry.getDigestFromRawData(updatedBlob)
  const updateProps = await Cord.Entry.updateEntriesProperties(registryId, entryId, updatedHash, updatedBlob)
  await Cord.Entry.dispatchUpdateEntryToChain(updateProps, issuer)
  console.log('✅ Credential updated')
  await pause()

  // ── Step 7: Revoke ────────────────────────────────────────────────────────────
  console.log('\n═══ Step 7: Revoke Credential ═══')
  await Cord.Entry.dispatchRevokeEntryToChain(registryId, entryId, issuer)
  const revokedDetails = await Cord.Entry.fetchRegistryEntryDetailsFromChain(entryId)
  console.log(revokedDetails.revoked ? `✅ Credential revoked` : `🚫 Revocation not applied`)

  // Verify after revoke — should fail
  const revokedVerify = await Cord.Entry.verifyAgainstInputProperties(
    entryId,
    updatedHash,
    issuerId,
    registryId
  )
  console.log(
    revokedVerify.isValid
      ? '⚠️  Verification still passed (unexpected)'
      : `✅ Verification correctly rejected revoked credential`
  )
  await pause()

  // ── Step 8: Reinstate ─────────────────────────────────────────────────────────
  console.log('\n═══ Step 8: Reinstate Credential ═══')
  await Cord.Entry.dispatchReinstateEntryToChain(registryId, entryId, issuer)
  const reinstatedDetails = await Cord.Entry.fetchRegistryEntryDetailsFromChain(entryId)
  console.log(!reinstatedDetails.revoked ? `✅ Credential reinstated` : `🚫 Reinstatement not applied`)
  await pause()

  // ── Step 9: Doken State History ───────────────────────────────────────────────
  console.log('\n═══ Step 9: State History ═══')
  const history = await DokenHistory.queryAllDokenStateHistory(api, entryId)
  console.log('📜 Full state history:', history)

  console.log('\n🎉 Interactive demo completed!')
  console.log('📊 View on explorer: https://apps.cord.network/?rpc=ws%3A%2F%2F127.0.0.1%3A9944#/explorer')
}

main()
  .then(() => {
    console.log('\nBye! 👋')
    Cord.disconnect()
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    Cord.disconnect()
    process.exit(1)
  })
