import * as Cord from "@cord.network/sdk";
import moment from "moment";
import "dotenv/config";
import process from "process";

const { NETWORK_ADDRESS, ANCHOR_URI } = process.env;

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
};

async function main() {
  const networkAddress = NETWORK_ADDRESS;
  const anchorUri = ANCHOR_URI;
  if (!anchorUri || !networkAddress) {
    console.log("Missing variables");
    return -1;
  }
  console.log("Env Variables: ", networkAddress);
  // Temporarily suppress console.log
  let originalConsoleLog = console.log;
  console.log = () => {};
  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK });

  await Cord.connect(networkAddress);
  const api = Cord.ConfigService.get("api");
  // Restore console.log
  console.log = originalConsoleLog;
  const txCount = 5_000;

  // Step 1: Setup Identities
  console.log(`\n❄️  Identities`);
  const networkAuthorityIdentity = Cord.Utils.Crypto.makeKeypairFromUri(
    anchorUri,
    "sr25519",
  );

  // Step 2: Create assets on-chain
  console.log = () => {};
  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_READY });
  console.log = originalConsoleLog;

  console.log(`\n❄️  Transaction Benchmarking (Baseline)  `);

  let tx_batch: any = [];
  let startTxPrep = moment();

  for (let j = 0; j < txCount; j++) {
    try {
      const txRemark = api.tx.remark.store(`Hello World! ${j + 1}`);
      tx_batch.push(txRemark);
      process.stdout.write(
        "  🔖  Preparing " +
          (j + 1) +
          " transactions took " +
          moment.duration(moment().diff(startTxPrep)).as("seconds").toFixed(3) +
          "s\r",
      );
    } catch (e: any) {
      console.log(e.errorCode, "-", e.message);
    }
  }
  console.log("\n");

  // let nonce = await api.rpc.system.accountNextIndex(networkAuthorityIdentity.address);
  // let ancStartTime = moment();
  // for (let i = 0; i < tx_batch.length; i++) {
  //   try {
  //     await tx_batch[i].signAndSend(networkAuthorityIdentity, {nonce: nonce.addn(i+1)});
  //   } catch (e: any) {
  //     console.log(e.errorCode, "-", e.message);
  //   }
  //   process.stdout.write(
  //     "  🎁  Anchoring " +
  //       (i + 1) +
  //       " individual transactions took " +
  //       moment.duration(moment().diff(ancStartTime)).as("seconds").toFixed(3) +
  //       "s\r",
  //   );
  // }
  // let ancEndTime = moment();
  // var ancDuration = moment.duration(ancEndTime.diff(ancStartTime));
  // console.log(
  //   `\n  🙌  Block TPS (individual transactions) - ${+(
  //     txCount / ancDuration.as("seconds")
  //   ).toFixed(0)} `,
  // );

  let batchAncStartTime = moment();
  try {
    api.tx.utility
      .batchAll(tx_batch)
      .signAndSend(networkAuthorityIdentity);
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }

  var batchAncDuration = moment
    .duration(moment().diff(batchAncStartTime))
    .as("seconds");

  console.log(
    `\n  🎁  Anchoring a batch of ${
      tx_batch.length
    } transactions took ${batchAncDuration.toFixed(3)}s`,
  );
  console.log(
    `  🙌  Block TPS (batch transactions) - ${+(
      txCount / batchAncDuration
    ).toFixed(0)} `,
  );

  await sleep(2000);
}
main()
  .then(() => console.log("\nBye! 👋 👋 👋 "))
  .finally(Cord.disconnect);

process.on("SIGINT", async () => {
  console.log("\nBye! 👋 👋 👋 \n");
  Cord.disconnect();
  process.exit(0);
});
