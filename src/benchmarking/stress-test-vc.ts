import * as Cord from '@cord.network/sdk';
import { BN } from 'bn.js';
import moment from 'moment';
import "dotenv/config";
import process from "process";
import { createAccount } from '../utils/createAccount.js';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

interface Row {
  cert_no: string;
  name: string;
  email: string;
  phone: string;
  course_name: string;
  duration: string;
  start_date: string;
  issue_time?: string;   // will add on the fly
}

async function getBalance(api, address) {
  const { data: balance } = await api.query.system.account(address);
  return balance.free;
}

async function getNonce(api, address) {
  const { nonce } = await api.query.system.account(address);
  return nonce.toNumber();
}


/** Hash a single row (adds issue_time so the hash changes each run) */
function hashRow(row: Record<string, string>): string {
  // You can make this any high-resolution timestamp or random nonce
  row.issue_time = Date.now().toString();

  return Cord.Utils.Crypto.hashStr(JSON.stringify(row));
}

/** Stream the CSV and resolve with an array of hashes */
async function computeHashes(csvFile: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const hashes: string[] = [];

    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => hashes.push(hashRow(row)))
      .on('end', () => resolve(hashes))
      .on('error', reject);
  });
}
async function batchTransactions(api, authorIdentity, txCount, perBatch) {
  const prepStart = moment();
  let nonce = await getNonce(api, authorIdentity.address);
  let prepared = 0;

  /* Prepare pay load */
  let hashes: string[] = [];
  try {
      const filePath = path.join(__dirname, 'student_records_300k.csv');
      console.log(filePath);
      console.time('hash-time');
      hashes = await computeHashes(filePath);   // <── await here
      console.timeEnd('hash-time');
  } catch(error) {
      console.error('Error while reading CSV:', error);
      process.exit(1);
  }

  const prepEnd = moment();
  const prepDuration = prepEnd.diff(prepStart, 'seconds') || 1;
    console.log(`⏱️  Reading file and preparing the fingerprint Done (${hashes.length} / ${prepDuration} s).`);
    console.log(`Will now start anchoring to chain... `);

  const submitStart = moment();
  for (let j = 0; j < hashes.length; j += perBatch) {
    const batch = [];
    for (let i = 0; i < perBatch && j + i < hashes.length; i++) {
      batch.push(api.tx.remark.store(`${hashes[j+i]}`));
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

main().catch(console.error);
