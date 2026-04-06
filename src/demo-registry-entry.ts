/**
 * demo-registry-entry.ts
 *
 * Demonstrates the full Registry + Entry lifecycle using the new CORD SDK (0.9.6-10+):
 *   - Profile creation
 *   - Registry creation
 *   - Entry create / update / verify / revoke / reinstate / transfer ownership
 *   - Hash-based lookup of entries
 *   - Doken state history query
 *
 * Run:  yarn demo-registry-entry
 * Env:  NETWORK_ADDRESS  (default: ws://127.0.0.1:9944)
 *       STASH_URI        (default: //Alice)
 */

import * as Cord from '@cord.network/sdk'
import { DokenHistory } from '@cord.network/utils'
import { blake2AsHex } from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/keyring'
import { createAccount } from './utils/createAccount'

const TRANSFER_AMOUNT = 30 * 10 ** 12 // 30 WAY
const EVENT_TIMEOUT = 10_000 // 10 s

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashProfile(data: Record<string, string>) {
  return Object.entries(data).map(([k, v]) => [k, blake2AsHex(v)])
}

async function waitForEvent(
  api: Cord.ApiPromise,
  eventCheck: (event: any) => boolean,
  fieldIndex: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    let unsub: () => void
    api.query.system.events((events) => {
      events.forEach(({ phase, event }) => {
        if (phase.isApplyExtrinsic && eventCheck(event)) {
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

async function getEntriesByTxHash(
  api: Cord.ApiPromise,
  txHash: string
): Promise<{ registry_id: string; registry_entry_id: string | null }[]> {
  const entries = await api.query.entry.hashToIdentifier.entries()
  return entries
    .filter(([key]) => (key.args[0] as any).toHex() === txHash)
    .map(([key, value]) => ({
      registry_id: (key.args[1] as any).toHuman() as string,
      registry_entry_id: (value as any).isNone ? null : (value as any).unwrap().toHuman() as string,
    }))
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const networkAddress = process.env.NETWORK_ADDRESS || 'ws://127.0.0.1:9944'
  const stashUri = process.env.STASH_URI || '//Alice'

  console.log(`\n🏦 Connecting to CORD at ${networkAddress}...`)
  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK })
  await Cord.connect(networkAddress)

  const api = Cord.ConfigService.get('api')
  console.log(
    `✅ Connected to ${api.runtimeVersion.specName} (v${api.runtimeVersion.specVersion})`
  )

  // ── Accounts ────────────────────────────────────────────────────────────────
  console.log('\n👤 Generating accounts...')
  const keyring = new Keyring({ type: 'sr25519' })
  const stash = keyring.createFromUri(stashUri)

  const accounts = [createAccount(), createAccount()].map(({ account }, idx) => {
    console.log(`🏦 Account ${idx + 1}: ${account.address}`)
    return account
  })

  // ── Fund ─────────────────────────────────────────────────────────────────────
  console.log('\n💸 Funding accounts...')
  for (const [idx, acc] of accounts.entries()) {
    await new Promise<void>((resolve, reject) => {
      api.tx.balances
        .transferKeepAlive(acc.address, TRANSFER_AMOUNT)
        .signAndSend(stash, ({ status, dispatchError }) => {
          if (dispatchError) reject(new Error(`Funding account ${idx + 1} failed: ${dispatchError}`))
          else if (status.isInBlock) { console.log(`✅ Funded account ${idx + 1}`); resolve() }
        })
        .catch(reject)
    })
  }

  // ── Profiles ─────────────────────────────────────────────────────────────────
  console.log('\n📝 Creating profiles...')
  await Cord.Profile.dispatchSetProfileToChain(
    hashProfile({ pub_name: 'Account 1', pub_email: 'account1@example.com' }),
    accounts[0]
  )
  const profileId1 = await waitForEvent(
    api,
    (e) => api.events.profile.ProfileSet.is(e),
    1
  )
  console.log(`✅ Profile 1: ${profileId1}`)

  await Cord.Profile.dispatchSetProfileToChain(
    hashProfile({ pub_name: 'Account 2', pub_email: 'account2@example.com' }),
    accounts[1]
  )
  const profileId2 = await waitForEvent(
    api,
    (e) => api.events.profile.ProfileSet.is(e),
    1
  )
  console.log(`✅ Profile 2: ${profileId2}`)

  // ── Create Registry ─────────────────────────────────────────────────────────
  console.log('\n🔄 Creating registry...')
  const registryBlob = JSON.stringify({ title: 'User Credentials', description: 'Demo registry' })
  const registryHash = await Cord.Registry.getDigestFromRawData(registryBlob)
  const registryProps = await Cord.Registry.registryCreateProperties(registryHash, registryBlob)
  await Cord.Registry.dispatchCreateToChain(registryProps, accounts[0])

  const registryId = await waitForEvent(
    api,
    (e) => api.events.registry.RegistryCreated.is(e),
    0
  )
  console.log(`✅ Registry created: ${registryId}`)

  // ── Create Entry ─────────────────────────────────────────────────────────────
  console.log('\n📝 Creating entry...')
  const entryBlob = JSON.stringify({ credentialId: 'cred-001', issuedTo: 'Account 1', validUntil: '2026-12-31' })
  const entryHash = await Cord.Registry.getDigestFromRawData(entryBlob)
  const entryProps = await Cord.Entry.createEntriesProperties(registryId, entryHash, entryBlob)
  await Cord.Entry.dispatchCreateEntryToChain(entryProps, accounts[0])

  const entryId = await waitForEvent(
    api,
    (e) => api.events.entry.RegistryEntryCreated.is(e),
    2
  )
  console.log(`✅ Entry created: ${entryId}`)

  // ── Update Entry ─────────────────────────────────────────────────────────────
  console.log('\n🔄 Updating entry...')
  const updatedBlob = JSON.stringify({ credentialId: 'cred-001', issuedTo: 'Account 1', validUntil: '2027-06-30' })
  const updatedHash = await Cord.Registry.getDigestFromRawData(updatedBlob)
  const updateProps = await Cord.Entry.updateEntriesProperties(registryId, entryId, updatedHash, updatedBlob)
  await Cord.Entry.dispatchUpdateEntryToChain(updateProps, accounts[0])
  console.log('✅ Entry updated')

  // ── Verify Entry ─────────────────────────────────────────────────────────────
  console.log('\n🔍 Verifying entry...')
  const verifyResult = await Cord.Entry.verifyAgainstInputProperties(
    entryId,
    updatedHash,
    profileId1,
    registryId
  )
  console.log(
    verifyResult.isValid
      ? `✅ Verification passed: ${entryId}`
      : `🚫 Verification failed: ${verifyResult.message}`
  )

  // ── Revoke Entry ─────────────────────────────────────────────────────────────
  console.log('\n🛑 Revoking entry...')
  await Cord.Entry.dispatchRevokeEntryToChain(registryId, entryId, accounts[0])
  const revokedDetails = await Cord.Entry.fetchRegistryEntryDetailsFromChain(entryId)
  console.log(
    revokedDetails.revoked
      ? `✅ Entry ${entryId} is revoked`
      : `🚫 Revocation not applied`
  )

  // ── Reinstate Entry ───────────────────────────────────────────────────────────
  console.log('\n♻️  Reinstating entry...')
  await Cord.Entry.dispatchReinstateEntryToChain(registryId, entryId, accounts[0])
  const reinstatedDetails = await Cord.Entry.fetchRegistryEntryDetailsFromChain(entryId)
  console.log(
    !reinstatedDetails.revoked
      ? `✅ Entry ${entryId} is active`
      : `🚫 Reinstatement not applied`
  )

  // ── Transfer Ownership ────────────────────────────────────────────────────────
  console.log('\n🔄 Transferring entry ownership to Account 2...')
  await Cord.Registry.dispatchAddDelegateToChain(
    registryId,
    accounts[1].address,
    [Cord.RegistryPermissionVariant.Entry],
    accounts[0]
  )
  await Cord.Entry.dispatchUpdateOwnershipToChain(registryId, entryId, accounts[1].address, accounts[0])
  const ownerDetails = await Cord.Entry.fetchRegistryEntryDetailsFromChain(entryId)
  // Check if owner was transferred - SDK returns owner separately from creator
  const currentOwner = ownerDetails.owner || ownerDetails.creator
  console.log(
    currentOwner === accounts[1].address || currentOwner === profileId2
      ? `✅ Ownership transferred to Account 2 (${accounts[1].address})`
      : `🚫 Ownership not updated: got ${currentOwner}, expected ${accounts[1].address} or ${profileId2}`
  )

  // ── Hash-based lookup ─────────────────────────────────────────────────────────
  console.log(`\n🔍 Looking up entries by hash: ${entryHash}`)
  const matches = await getEntriesByTxHash(api, entryHash)
  console.log('✅ Matches:', matches)

  // ── Doken State History ───────────────────────────────────────────────────────
  console.log('\n📜 Querying Doken state history...')
  const history = await DokenHistory.queryAllDokenStateHistory(api, entryId)
  console.log('✅ History:', history)

  console.log('\n🎉 Registry + Entry demo completed successfully!')
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
