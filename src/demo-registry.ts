/**
 * demo-registry.ts
 *
 * Demonstrates the Registry lifecycle using the new CORD SDK (0.9.6-10+):
 *   - Profile creation for accounts
 *   - Registry create / update / archive / restore
 *   - Delegate add / remove
 *
 * Run:  yarn demo-registry
 * Env:  NETWORK_ADDRESS  (default: ws://127.0.0.1:9944)
 *       STASH_URI        (default: //Alice)
 */

import * as Cord from '@cord.network/sdk'
import { blake2AsHex } from '@polkadot/util-crypto'
import { Keyring } from '@polkadot/keyring'
import { createAccount } from './utils/createAccount'

const TRANSFER_AMOUNT = 13 * 10 ** 12 // 13 WAY

async function main() {
  const networkAddress = process.env.NETWORK_ADDRESS || 'ws://127.0.0.1:9944'
  const stashUri = process.env.STASH_URI || '//Alice'

  console.log(`\n🏦 Connecting to CORD network at ${networkAddress}...`)
  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK })
  await Cord.connect(networkAddress)

  const api = Cord.ConfigService.get('api')
  const runtimeVersion = api.runtimeVersion
  console.log(
    `✅ Connected to CORD runtime: ${runtimeVersion.specName} (v${runtimeVersion.specVersion})`
  )

  // ── Accounts ────────────────────────────────────────────────────────────────
  console.log('\n👤 Setting up accounts...')
  const keyring = new Keyring({ type: 'sr25519' })
  const stash = keyring.createFromUri(stashUri)
  console.log(`🏦 Stash: ${stash.address}`)

  const { account: account1 } = createAccount()
  const { account: account2 } = createAccount()
  const { account: account3 } = createAccount()
  console.log(`🏦 Account 1: ${account1.address}`)
  console.log(`🏦 Account 2: ${account2.address}`)
  console.log(`🏦 Account 3: ${account3.address}`)

  // ── Fund accounts ───────────────────────────────────────────────────────────
  console.log('\n💸 Funding accounts from stash...')
  const fundTxs = [account1, account2, account3].map((acc) =>
    api.tx.balances.transferKeepAlive(acc.address, TRANSFER_AMOUNT)
  )
  let i = 1
  for (const tx of fundTxs) {
    await new Promise<void>((resolve, reject) => {
      tx.signAndSend(stash, ({ status, dispatchError }) => {
        if (dispatchError) reject(new Error(`Funding account-${i} failed: ${dispatchError}`))
        else if (status.isInBlock) { console.log(`✅ Funded account-${i}`); resolve() }
      }).catch(reject)
    })
    i++
  }

  // ── Profiles ─────────────────────────────────────────────────────────────────
  console.log('\n📝 Creating profiles...')

  const hashProfile = (data: Record<string, string>) =>
    Object.entries(data).map(([k, v]) => [k, blake2AsHex(v)])

  await Cord.Profile.dispatchSetProfileToChain(
    hashProfile({ pub_name: 'Account 1', pub_email: 'account1@example.com' }),
    account1
  )
  console.log('✅ Profile for Account 1 created')

  await Cord.Profile.dispatchSetProfileToChain(
    hashProfile({ pub_name: 'Account 2', pub_email: 'account2@example.com' }),
    account2
  )
  console.log('✅ Profile for Account 2 created')

  await Cord.Profile.dispatchSetProfileToChain(
    hashProfile({ pub_name: 'Account 3', pub_email: 'account3@example.com' }),
    account3
  )
  console.log('✅ Profile for Account 3 created')

  // ── Create Registry ─────────────────────────────────────────────────────────
  console.log('\n🔄 Creating Registry...')
  const blob1 = JSON.stringify({ name: 'Demo Registry', owner: 'Account 1' })
  const txHash1 = await Cord.Registry.getDigestFromRawData(blob1)
  const registryProps = await Cord.Registry.registryCreateProperties(txHash1, blob1)
  console.dir(registryProps, { depth: 3, colors: true })

  await Cord.Registry.dispatchCreateToChain(registryProps, account1)

  // Listen for RegistryCreated event to capture the registry identifier
  const registryId: string = await new Promise((resolve, reject) => {
    let unsub: () => void
    api.query.system.events((events) => {
      events.forEach(({ phase, event }) => {
        if (phase.isApplyExtrinsic && api.events.registry.RegistryCreated.is(event)) {
          resolve(event.data[0].toHuman() as string)
          if (unsub) unsub()
        }
      })
    })
      .then((u) => { unsub = u })
      .catch(reject)
    setTimeout(() => { if (unsub) unsub(); reject(new Error('Timeout: RegistryCreated event')) }, 10_000)
  })
  console.log(`✅ Registry created: ${registryId}`)

  // ── Transfer Creator ────────────────────────────────────────────────────────
  console.log('\n🔄 Transferring registry creator to Account 2...')
  await Cord.Registry.dispatchUpdateCreator(registryId, account2.address, account1)
  console.log('✅ Registry creator updated to Account 2')

  // ── Update Registry Hash ────────────────────────────────────────────────────
  console.log('\n🔄 Updating registry blob...')
  const blob2 = JSON.stringify({ name: 'Demo Registry (updated)', owner: 'Account 2' })
  const txHash2 = await Cord.Registry.getDigestFromRawData(blob2)
  const updateProps = await Cord.Registry.registryUpdateHashProperties(registryId, txHash2, blob2)
  await Cord.Registry.dispatchUpdateRegistryHashToChain(updateProps, account2)
  console.log('✅ Registry hash updated')

  // ── Add Delegate ─────────────────────────────────────────────────────────────
  console.log('\n📝 Adding Account 3 as delegate (Entry + Delegate roles)...')
  await Cord.Registry.dispatchAddDelegateToChain(
    registryId,
    account3.address,
    [Cord.RegistryPermissionVariant.Entry, Cord.RegistryPermissionVariant.Delegate],
    account2
  )
  console.log('✅ Delegate added')

  // ── Remove Delegate ──────────────────────────────────────────────────────────
  console.log('\n📝 Removing Account 3 delegate...')
  await Cord.Registry.dispatchRemoveDelegateToChain(registryId, account3.address, account2)
  console.log('✅ Delegate removed')

  // ── Archive Registry ─────────────────────────────────────────────────────────
  console.log('\n📦 Archiving registry...')
  await Cord.Registry.dispatchArchiveRegistryToChain(registryId, account2)
  console.log('✅ Registry archived')

  // ── Restore Registry ─────────────────────────────────────────────────────────
  console.log('\n♻️  Restoring registry...')
  await Cord.Registry.dispatchRestoreRegistryToChain(registryId, account2)
  console.log('✅ Registry restored')

  console.log('\n🎉 Registry demo completed successfully!')
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
