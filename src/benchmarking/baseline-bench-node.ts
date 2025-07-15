import * as Cord from "@cord.network/sdk";
import "dotenv/config";
import moment from "moment";
import process from "process";

const {
  NETWORK_ADDRESSES,
  NODE_ANCHOR_URIS,
  BATCH_TRANSACTIONS,
  NODE_TRANSACTIONS,
} = process.env;

const txCount = BATCH_TRANSACTIONS ? Number(BATCH_TRANSACTIONS) : 10000;
const transactionsPerNode = NODE_TRANSACTIONS
  ? Number(NODE_TRANSACTIONS)
  : 1000;

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function connectAndGetApis(networkAddresses: string[]) {
  let originalConsoleLog = console.log;
  console.log = () => {};
  const apis = await Promise.all(
    networkAddresses.map(async (address) => {
      await Cord.connect(address);
      return Cord.ConfigService.get("api");
    })
  );

  console.log = originalConsoleLog;

  return apis;
}

const generateIdentitiesWithNonce = async (anchorUris: string[], api: any) => {
  const identitiesWithNonce = await Promise.all(
    anchorUris.map(async (uri) => {
      const keypair = Cord.Utils.Crypto.makeKeypairFromUri(uri, "sr25519");
      const { nonce } = await api.query.system.account(keypair.address);
      return {
        keypair,
        nonce: nonce.toNumber(),
      };
    })
  );

  return identitiesWithNonce;
};

// A method to generate transactions
const createUniqueTransactions = async (totalTxCount: number, api: any) => {
  let txBatch: any[] = [];
  for (let i = 0; i < totalTxCount; i++) {
    const txRemark = api.tx.remark.store(`Hello World! ${i + 1}`);
    txBatch.push(txRemark);
  }
  return txBatch;
};

// A method to distribute transactions
function distributeTransactions(txBatch: any[], networkAddresses: string[]) {
  let distributedTransactions: any[] = [];
  let txIndex = 0;

  // Create a flat list of transactions up to the limit per node
  while (txIndex < txBatch.length) {
    networkAddresses.forEach((address, nodeIndex) => {
      if (txIndex < txBatch.length) {
        const endIdx = Math.min(txIndex + transactionsPerNode, txBatch.length);
        const txChunk = txBatch.slice(txIndex, endIdx);
        if (!distributedTransactions[nodeIndex]) {
          distributedTransactions[nodeIndex] = [];
        }
        distributedTransactions[nodeIndex].push(...txChunk);
        txIndex += txChunk.length;
      }
    });
  }

  // Ensure each node's transactions are split into chunks of up to transactionsPerNode
  return distributedTransactions.map((nodeTxs) => {
    let result: any[] = [];
    for (let i = 0; i < nodeTxs.length; i += transactionsPerNode) {
      result.push(nodeTxs.slice(i, i + transactionsPerNode));
    }
    return result;
  });
}

// A method to process parallel transactions to nodes
const sendTransactionsParallel = async (
  txBatches: any[][],
  identities: any[],
  nodeApis: any,
  networkAddresses: string[]
) => {
  let isReadyTime: any;
  let isBlockTime: any;
  let isFinalizedTime: any;
  let poolStartTimeSet = false;
  let poolStartTime: any;

  console.log(
    `${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} ✨ Total transactions to be sent: ${
      txBatches.flat().length * transactionsPerNode
    }`
  );

  let startTime = moment();
  await Promise.all(
    txBatches.map(async (nodeTxBatches, index) => {
      const api = nodeApis[index];

      for (const txBatch of nodeTxBatches) {
        await new Promise((resolve, reject) => {
          console.log(
            `${moment().format(
              "YYYY-MM-DD HH:mm:ss.SSS"
            )} ✨ Batch ${index} transactions to Node ${index}: ${
              txBatch.flat().length
            }`
          );

          api.tx.utility
            .batchAll(txBatch)
            .signAndSend(
              identities[index].keypair,
              { nonce: identities[index].nonce },
              (result) => {
                if (result.status.isReady) {
                  if (!poolStartTimeSet) {
                    poolStartTimeSet = true;
                    poolStartTime = moment();
                  }
                  isReadyTime = moment();
                  console.log(
                    `${moment().format(
                      "YYYY-MM-DD HH:mm:ss.SSS"
                    )} 🔖 Current status of Node ${index}, Batch ${index} is ${
                      result.status
                    }`
                  );
                }

                if (result.status.isInBlock) {
                  isBlockTime = moment();
                  console.log(
                    `${moment().format(
                      "YYYY-MM-DD HH:mm:ss.SSS"
                    )} 📦 Current status of Node ${index}, Batch ${index} is ${
                      result.status
                    }`
                  );
                }

                if (result.status.isFinalized) {
                  isFinalizedTime = moment();
                  console.log(
                    `${moment().format(
                      "YYYY-MM-DD HH:mm:ss.SSS"
                    )} 🎁 Current status of Node ${index}, Batch ${index} is ${
                      result.status
                    }`
                  );
                  resolve(result);
                }
              }
            )
            .catch((error) => {
              console.error(
                `${moment().format(
                  "YYYY-MM-DD HH:mm:ss.SSS"
                )} 👀 Error sending batch transaction: ${error.message}`
              );
              reject(error);
            });
        });
        identities[index].nonce += 1;
      }
    })
  );

  let isReadyDuration = moment
    .duration(isReadyTime.diff(startTime))
    .as("seconds");
  let isInBlockDuration = moment
    .duration(isBlockTime.diff(isReadyTime))
    .as("seconds");
  let isFinalizedDuration = moment
    .duration(isFinalizedTime.diff(isBlockTime))
    .as("seconds");
  let isReadyToFinalizedDuration = moment
    .duration(isFinalizedTime.diff(isReadyTime))
    .as("seconds");
  let totalDuration = moment
    .duration(isFinalizedTime.diff(startTime))
    .as("seconds");

  console.log(
    `\n${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} 🙌 Duration for Transaction Batch Prep -> Pool (${txCount}): ${isReadyDuration.toFixed(
      3
    )}s`
  );
  console.log(
    `${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} 🙌 Duration from Pool -> Block Authoring (isInBlock, ${txCount}): ${isInBlockDuration.toFixed(
      3
    )}s`
  );
  console.log(
    `${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} 🙌 Duration from Block -> Finality (isFinalized, ${txCount}): ${isFinalizedDuration.toFixed(
      3
    )}s`
  );

  console.log(
    `\n${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} 🙌 Total Duration from Pool -> Finality (isFinalized, ${txCount}): ${isReadyToFinalizedDuration.toFixed(
      3
    )}s`
  );
  console.log(
    `${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} 🙌 CORD Node TPS - Pool -> Finality (tx: ${txCount} nodes: ${
      networkAddresses.length
    }) - ${+(txCount / isReadyToFinalizedDuration).toFixed(0)} `
  );

  console.log(
    `\n${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} 🙌 Total Duration from Tx Prep -> Finality (isFinalized, ${txCount}): ${totalDuration.toFixed(
      3
    )}s`
  );
  console.log(
    `${moment().format(
      "YYYY-MM-DD HH:mm:ss.SSS"
    )} 🙌 CORD Node TPS - Prep -> Finality (tx: ${txCount} nodes: ${
      networkAddresses.length
    }) - ${+(txCount / totalDuration).toFixed(0)} `
  );

  return totalDuration;
};

async function main() {
  const networkAddresses = NETWORK_ADDRESSES
    ? NETWORK_ADDRESSES.split(",")
    : ["ws://127.0.0.1:9944"];
  const anchorUris = NODE_ANCHOR_URIS ? NODE_ANCHOR_URIS.split(",") : [];
  if (
    networkAddresses.length === 0 ||
    anchorUris.length !== networkAddresses.length
  ) {
    console.log(
      "Missing variables or mismatch in count between addresses and URIs"
    );
    return -1;
  }

  // Connect to networks and get APIs
  const apis = await connectAndGetApis(networkAddresses);
  const identities = await generateIdentitiesWithNonce(anchorUris, apis[0]);

  console.log(`\n❄️ CORD Node TPS Benchmarking`);

  console.dir(
    `Env Variables: EndPoints ${networkAddresses}, 
    Accounts ${anchorUris}, 
    Total Transactions ${txCount}, 
    Node Transactions ${transactionsPerNode}`,
    {
      depth: null,
      colors: true,
    }
  );

  // Create a batch of unique transactions
  const txBatch = await createUniqueTransactions(txCount, apis[0]);

  // Distribute transactions across available nodes
  const txBatches = distributeTransactions(txBatch, networkAddresses);

  // Send transactions in parallel to each node, using separate identities
  const totalDuration = await sendTransactionsParallel(
    txBatches,
    identities,
    apis,
    networkAddresses
  );

  apis.forEach(async (api) => await api.disconnect());
}

main()
  .then(() => console.log("\nBye! 👋 👋 👋 "))
  .finally(() => {
    Cord.disconnect();
    process.exit(0);
  });

process.on("SIGINT", async () => {
  console.log("\nBye! 👋 👋 👋 \n");
  Cord.disconnect();
  process.exit(0);
});
