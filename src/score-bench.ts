import * as Cord from "@cord.network/sdk";
import moment from "moment";
import Keyring from "@polkadot/keyring";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ScoreType } from "@cord.network/types";
import { UUID } from "@cord.network/utils";
import { applyExtends } from "yargs/helpers";

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
};
function getRandomFloat(min: number, max: number, decimals: number) {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);

  return parseFloat(str);
}
async function main() {
  // localhost
  // await Cord.init({ address: "ws://127.0.0.1:9944" });
  // const wsProvider = new WsProvider("ws://127.0.0.1:9944");
  //staging
  await Cord.init({ address: "wss://staging.cord.network" });
  const wsProvider = new WsProvider("wss://staging.cord.network");

  const api = await ApiPromise.create({ provider: wsProvider });

  // Step 1: Setup Identities

  const sellerIdentity = Cord.Identity.buildFromURI("//Entity", {
    signingKeyPairType: "sr25519",
  });
  const collectorIdentity = Cord.Identity.buildFromURI("//BuyerApp", {
    signingKeyPairType: "ed25519",
  });
  const requestorIdentity = Cord.Identity.buildFromURI("//SellerApp", {
    signingKeyPairType: "ed25519",
  });
  let keyring = new Keyring({ type: "sr25519", ss58Format: 29 });
  let batchTransactionAuthor = keyring.addFromUri("//Charlie");

  console.log(`\n🥅  CORD Network Benchmark - Score Pallet `);
  console.log(`\n  🎁  Transactions `);
  let txBatch: any = [];
  let startBatchPrep = moment();
  let txBatchCount = 2000;
  for (let j = 0; j < txBatchCount; j++) {
    let tidUid = UUID.generate().toString();
    let overallEntryContent = {
      entity: sellerIdentity.address,
      uid: UUID.generate().toString(),
      tid: tidUid,
      collector: collectorIdentity.address,
      requestor: requestorIdentity.address,
      scoreType: ScoreType.overall,
      score: getRandomFloat(1.5, 4.5, 1),
    };

    let newOverallJournalEntry = Cord.Score.fromJournalProperties(
      overallEntryContent,
      sellerIdentity
    );

    try {
      let txOverallEntry = await Cord.Score.entries(newOverallJournalEntry);
      txBatch.push(txOverallEntry);
    } catch (e: any) {
      console.log(e.errorCode, "-", e.message);
    }
  }

  let batchAncStartTime = moment();
  try {
    const batchTransaction = api.tx.utility.batchAll(txBatch);
    batchTransaction.signAndSend(batchTransactionAuthor);
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }
  let batchAncEndTime = moment();
  var batchAncDuration = moment.duration(
    batchAncEndTime.diff(batchAncStartTime)
  );

  process.stdout.write(
    "     ✨  Submission of " +
      txBatch.length +
      " extrinsics to the network took " +
      moment
        .duration(moment().diff(batchAncStartTime))
        .as("seconds")
        .toFixed(3) +
      "s\r"
  );
  console.log(
    `\n     🙌  TPS - ${+(
      txBatchCount / batchAncDuration.as("seconds")
    ).toFixed(0)} `
  );

  const UNIT = 1000000000000;
  const batchPayment = api.tx.utility.batchAll(txBatch);
  const { partialFee, weight } = await batchPayment.paymentInfo(
    batchTransactionAuthor
  );
  console.log(`\n  🔖  Network Fees `);
  console.log(`     👀  Total Transaction Fee - ${partialFee.toHuman()}`);
  console.log(
    `     🙌  Per Transaction Fee ${(
      partialFee.toNumber() /
      txBatch.length /
      UNIT
    ).toFixed(4)} WAY`
  );

  console.log(`\n  ❄️  Query Network `);
  let queryStartTime = moment();
  const chainOverallScore = await Cord.Score.queryAverage(
    sellerIdentity.address,
    ScoreType.overall
  );
  let queryEndTime = moment();
  // console.dir(chainOverallScore, { depth: null, colors: true });

  var queryResponseDuration = moment.duration(
    queryEndTime.diff(queryStartTime)
  );

  process.stdout.write(
    "     ✨  Querying and decoding score information from the network took " +
      moment
        .duration(queryEndTime.diff(queryStartTime))
        .as("seconds")
        .toFixed(3) +
      "s\r"
  );
  console.log(
    `\n     🙌  TPS - ${+(60 / queryResponseDuration.as("seconds")).toFixed(
      0
    )} \n`
  );

  await sleep(2000);
  await api.disconnect();
}

main()
  .then(() => console.log("Bye! 👋 👋 👋 \n"))
  .finally(Cord.disconnect);

process.on("SIGINT", async () => {
  console.log("`Bye! 👋 👋 👋 \n");
  Cord.disconnect();
  process.exit(0);
});
