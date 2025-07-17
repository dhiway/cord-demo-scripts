import * as Cord from '@cord.network/sdk';
import { ApiPromise } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { blake2AsHex, mnemonicGenerate } from '@polkadot/util-crypto';
import { BN } from '@polkadot/util';
import * as readline from 'readline';
import * as fs from 'fs';

const TIMEOUT = 120_000; // 120s timeout for event listeners
const BATCH_SIZE = 100; // Process 100 digests per batch
const BATCH_DELAY_MS = 1000; // 1s delay between batches
const TRANSFER_AMOUNT = new BN(5_000_000).mul(new BN(10).pow(new BN(12))); // 5 million WAY (12 decimals)

/**
 * Gets the current nonce for an account and returns it as a BN.
 * @param api - CORD API instance.
 * @param address - Account address.
 * @returns Current nonce as BN.
 */
async function getCurrentNonce(api: ApiPromise, address: string): Promise<BN> {
  const accountInfo = await api.query.system.account(address);
  return new BN(accountInfo.nonce.toString());
}

/**
 * Waits for a specific chain event and extracts a field from its data.
 * @param api - CORD API instance.
 * @param eventCheck - Function to check if an event matches.
 * @param fieldIndex - Index of the field to extract from event data.
 * @returns Promise resolving to the extracted field value.
 */
async function waitForEvent(api: ApiPromise, eventCheck: (event: any) => boolean, fieldIndex: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let unsubscribe: () => void;
    api.query.system.events((events: any) => {
      events.forEach(({ phase, event }: { phase: any; event: any }) => {
        if (phase.isApplyExtrinsic && eventCheck(event)) {
          console.log('Event found:', event.toHuman());
          const fieldValue = event.data[fieldIndex].toHuman();
          resolve(fieldValue);
          if (unsubscribe) unsubscribe();
        }
      });
    }).then((unsub: () => void) => {
      unsubscribe = unsub;
    }).catch((error: Error) => {
      reject(new Error(`Event subscription failed: ${error.message}`));
    });

    setTimeout(() => {
      if (unsubscribe) unsubscribe();
      reject(new Error('Timeout: Event not found'));
    }, TIMEOUT);
  });
}

/**
 * Reads digests from a file in batches using a stream.
 * @param filePath - Path to the input file.
 * @param batchSize - Number of digests per batch.
 * @yields Array of hex digests (up to batchSize).
 */
async function* readDigestsInBatches(filePath: string, batchSize: number): AsyncGenerator<string[]> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let batch: string[] = [];
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    const match = line.match(/0x[0-9a-fA-F]{64}/);
    if (match) {
      batch.push(match[0]);
    } else {
      console.warn(`Skipping invalid line ${lineCount}: ${line}`);
    }

    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }

  console.log(`Processed ${lineCount} lines`);
}

/**
 * Submits a batch of registry entry transactions without waiting for block inclusion.
 * @param api - CORD API instance.
 * @param registryId - Registry URI.
 * @param digests - Array of hex digests to anchor.
 * @param signer - Signing account.
 * @param nonce - Nonce for the transaction.
 * @returns Transaction hash of the batch.
 */
async function submitBatch(api: ApiPromise, registryId: string, digests: string[], signer: any, nonce: BN): Promise<string> {
  const batchTxs: any[] = [];
  for (const [index, digest] of digests.entries()) {
    const entryBlob = {
      digest,
      batchIndex: index,
    };
    const entryStringifiedBlob = JSON.stringify(entryBlob);
    const entryTxHash = digest; // Use digest as txHash

    const entryProperties = await Cord.Entry.createEntriesProperties(
      registryId,
      entryTxHash,
      entryStringifiedBlob
    );

    const tx = api.tx.entry.create(entryProperties.registryId, entryProperties.tx_hash, entryProperties.blob);
    batchTxs.push(tx);
  }

  const batchTx = api.tx.utility.batch(batchTxs);
  return new Promise((resolve, reject) => {
    batchTx.signAndSend(signer, { nonce }, ({ txHash }: { txHash: any }) => {
      const hash = txHash.toHex();
      console.log(`✅ Batch submitted with hash: ${hash}, nonce: ${nonce.toString()}`);
      resolve(hash);
    }).catch(reject);
  });
}

/**
 * Delays execution for a specified time.
 * @param ms - Delay in milliseconds.
 * @returns Promise that resolves after the delay.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const networkAddress = process.env.NETWORK_ADDRESS || 'wss://weave1.testnet.cord.network';
  const stashUri = process.env.STASH_URI || '0xa456bbffe088bfe39695d603ca8a85c70b866a4633619e70831f7bf16491d74b//1';
  const inputFile = process.env.INPUT_FILE || './demo/src/digests.txt';

  try {
    // Connect to CORD
    console.log(`\n🏦 Connecting to CORD at ${networkAddress}...`);
    Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK });
    await Cord.connect(networkAddress);

    const api = Cord.ConfigService.get('api') as ApiPromise;
    console.log(`✅ Connected to ${api.runtimeVersion.specName} (v${api.runtimeVersion.specVersion})`);

    // Initialize keyring
    const keyring = new Keyring({ type: 'sr25519' });

    // Create new account with mnemonic
    console.log('\n👤 Creating new account...');
    const mnemonic = mnemonicGenerate(12); // Generate 12-word mnemonic
    const newAccount = keyring.addFromMnemonic(mnemonic, {}, 'sr25519');
    console.log(`✅ New account created:`);
    console.log(`  Address: ${newAccount.address}`);
    console.log(`  Public Key: 0x${Buffer.from(newAccount.publicKey).toString('hex')}`);
    console.log(`  Mnemonic: ${mnemonic}`);
    console.log('⚠️ Save the mnemonic securely! It is required to recover the account.');

    // Initialize stash account for funding
    const stash = keyring.createFromUri(stashUri);
    console.log(`🏦 Stash: ${stash.address}`);

    // Fund new account with 5 million WAY
    console.log(`\n💸 Funding new account with 5 million WAY...`);
    const stashNonce = await getCurrentNonce(api, stash.address);
    const transferTx = api.tx.balances.transferKeepAlive(newAccount.address, TRANSFER_AMOUNT);
    await new Promise((resolve, reject) => {
      transferTx.signAndSend(stash, { nonce: stashNonce }, ({ status, dispatchError, events }: { status: any; dispatchError: any; events: any }) => {
        if (dispatchError) {
          reject(new Error(`Funding failed: ${dispatchError}`));
        } else if (status.isInBlock) {
          events.forEach(({ event }: { event: any }) => {
            if (api.events.balances.Transfer.is(event)) {
              console.log(`✅ Funding successful: 5 million WAY transferred to ${newAccount.address}, nonce: ${stashNonce.toString()}`);
              resolve();
            }
          });
        }
      }).catch(reject);
    });

    // Initialize nonce for new account
    let currentNonce = await getCurrentNonce(api, newAccount.address);

    // Create profile
    console.log('\n📝 Creating profile for new account...');
    await Cord.Profile.dispatchSetProfileToChain(
      Object.entries({
        pub_name: 'Navneet SSC'
      }).map(([key, value]) => [key, blake2AsHex(value as string)]),
      newAccount,
      { nonce: currentNonce }
    );
    const profileIdentifier = await waitForEvent(
      api,
      (event) => api.events.profile.ProfileSet.is(event),
      1
    );
    console.log(`✅ Profile set with ID: ${profileIdentifier}, nonce: ${currentNonce.toString()}`);
    currentNonce = currentNonce.add(new BN(1)); // Increment nonce

    // Create registry
    console.log('\n🔄 Creating registry...');
    const registryBlob = {
      title: 'Registry for Navneet HSC Data',
    };
    const registryStringifiedBlob = JSON.stringify(registryBlob);
    const registryTxHash = await Cord.Registry.getDigestFromRawData(registryStringifiedBlob);

    const registryProperties = await Cord.Registry.registryCreateProperties(
      registryTxHash,
      registryStringifiedBlob
    );
    await Cord.Registry.dispatchCreateToChain(registryProperties, newAccount, { nonce: currentNonce });

    const registryId = await waitForEvent(
      api,
      (event) => api.events.registry.RegistryCreated.is(event),
      0
    );
    console.log(`✅ Registry created with URI: ${registryId}, nonce: ${currentNonce.toString()}`);
    currentNonce = currentNonce.add(new BN(1)); // Increment nonce

    // Process digests in batches
    console.log(`\n📖 Processing digests from ${inputFile} in batches of ${BATCH_SIZE}...`);
    let batchCount = 0;
    let totalDigests = 0;

    for await (const digests of readDigestsInBatches(inputFile, BATCH_SIZE)) {
      batchCount++;
      totalDigests += digests.length;
      console.log(`\n📝 Batch ${batchCount}: Anchoring ${digests.length} digests (Total: ${totalDigests})...`);

      try {
        const batchTxHash = await submitBatch(api, registryId, digests, newAccount, currentNonce);
        console.log(`✅ Batch ${batchCount} transaction hash: ${batchTxHash}`);
        currentNonce = currentNonce.add(new BN(1)); // Increment nonce
      } catch (error) {
        console.error(`❌ Batch ${batchCount} failed: ${(error as Error).message}`);
        // Continue with next batch, do not increment nonce on failure
        const failedOutput = fs.createWriteStream('failed_digests.txt', { flags: 'a' });
        digests.forEach((digest) => failedOutput.write(`${digest}\n`));
        failedOutput.end();
      }

      // Delay to prevent overwhelming the transaction pool
      await delay(BATCH_DELAY_MS);
    }

    console.log(`\n✅ Completed processing ${batchCount} batches with ${totalDigests} digests`);

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    throw error;
  } finally {
    console.log('\n🔌 Disconnecting from CORD...');
    await Cord.disconnect();
    console.log('✅ Disconnected');
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', (error as Error).message);
  process.exit(1);
}  );
