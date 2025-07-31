import * as Cord from '@cord.network/sdk';
import { BN } from 'bn.js';
import moment from 'moment';
import "dotenv/config";
import process from "process";
import { createAccount } from '../utils/createAccount.js';

let sampleVc = require('./sampleVc.json');

async function getBalance(api, address) {
  const { data: balance } = await api.query.system.account(address);
  return balance.free;
}

async function getNonce(api, address) {
  const { nonce } = await api.query.system.account(address);
  return nonce.toNumber();
}

async function batchTransactions(api, authorIdentity, txCount, perBatch) {
  const prepStart = moment();
  let nonce = await getNonce(api, authorIdentity.address);
  let prepared = 0;

  console.log(sampleVc);

  /* Prepare pay load */
  let hexStr: any = [];
  for (let i = 0; i < txCount; i++) {
      sampleVc.id = `random-test-${i}`;
      let hsh = Cord.Utils.Crypto.hashStr(JSON.stringify(sampleVc));
      hexStr.push(hsh);
  }

  const prepEnd = moment();
  const prepDuration = prepEnd.diff(prepStart, 'seconds') || 1;
  console.log(`⏱️  Preparation Done (${hexStr.length} / ${prepDuration} s). Will stream dispatch... `);


  const submitStart = moment();
  for (let j = 0; j < txCount; j += perBatch) {
    const batch = [];
    for (let i = 0; i < perBatch && j + i < txCount; i++) {
      batch.push(api.tx.remark.store(`${hexStr[j+i]}`));
    }

    const signed = await api.tx.utility.batch(batch).signAsync(authorIdentity, {
      nonce: nonce,
      tip: 10_000
    });
    await signed.send();
    nonce++;
    prepared += batch.length;
    console.log("Looping at - ", prepared);
  }

  const submitDuration = moment().diff(submitStart, 'seconds') || 1;
  console.log(`🚀 Submitted ${prepared} tx in ${submitDuration}s | TPS: ${(prepared / submitDuration).toFixed(2)}`);
}

async function main() {
  try {
    const networkAddress = process.env.NETWORK_ADDRESS || "ws://127.0.0.1:9944";
    const stashUri = process.env.ANCHOR_URI || "//Alice";
    const txCount = 30_000;
    const perBatch = 5_000;
    const transferAmount = new BN(1000).mul(new BN(10).pow(new BN(12)));

    //Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK });
    Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_READY });
    await Cord.connect(networkAddress);
    const api = Cord.ConfigService.get('api');

    const identity = Cord.Utils.Crypto.makeKeypairFromUri(stashUri, 'sr25519');
    console.log("Network Address:", networkAddress, identity.address);
    // const initialBalance = await getBalance(api, identity.address);

    await batchTransactions(api, identity, txCount, perBatch);

    // const finalBalance = await getBalance(api, identity.address);
    // const used = initialBalance.sub(finalBalance);
    // console.log(`🏁 Final Balance: ${finalBalance.toString()}`);
    // console.log(`💸 Total Used: ${used.toString()} | Per Tx: ${used.div(new BN(txCount)).toString()}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await Cord.disconnect();
    console.log(`👋 Done.`);
  }
}

main();
