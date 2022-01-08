import * as cord from "@cord.network/api";
import { UUID } from "@cord.network/utils";
import * as json from "multiformats/codecs/json";
import { blake2b256 as hasher } from "@multiformats/blake2/blake2b";
import { CID } from "multiformats/cid";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";

const { DEMO_KEY_URI, DEMO_WSS_ADDR, DEMO_LOOP_CNT } = process.env;

function sleep(s: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, s * 1000);
  });
}

function between(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}

async function main() {
  let argv = await yargs(hideBin(process.argv))
    .option("loop", {
      default: DEMO_LOOP_CNT ? DEMO_LOOP_CNT : 1000,
      describe:
        "Number of mark.create() transaction to be done by this program (0 for infinite loop)",
      type: "number",
    })
    .option("key", {
      alias: "k",
      demandOption: false,
      default: DEMO_KEY_URI ? DEMO_KEY_URI : "//Bob",
      describe:
        "URI to generate the key, so we can sign the transactions using the given key.",
      type: "string",
    })
    .option("address", {
      alias: "a",
      default: DEMO_WSS_ADDR ? DEMO_WSS_ADDR : "ws://127.0.0.1:9944",
      describe: "address to connect to",
      type: "string",
    }).argv;

  // let didTxCounter = 1
  await cord.init({ address: argv.address });

  // Step 1: Setup Org Identity
  console.log(`\n🏛  Creating Identities\n`);
  //3x4DHc1rxVAEqKWSx1DAAA8wZxLB4VhiRbMV997niBckUwSi
  const entityIdentity = cord.Identity.buildFromURI(argv.key, {
    signingKeyPairType: "sr25519",
  });
  const employeeIdentity = cord.Identity.buildFromURI("//Dave", {
    signingKeyPairType: "ed25519",
  });
  const holderIdentity = cord.Identity.buildFromURI("//Alice", {
    signingKeyPairType: "sr25519",
  });
  const verifierIdentity = cord.Identity.buildFromURI("//Charlie", {
    signingKeyPairType: "ed25519",
  });
  console.log(
    `🔑 Entity Controller Address (${entityIdentity.signingKeyType}): ${entityIdentity.address}`
  );
  console.log(
    `🔑 Employee Address (${employeeIdentity.signingKeyType}): ${employeeIdentity.address}`
  );
  console.log(
    `🔑 Holder Org Address (${holderIdentity.signingKeyType}): ${holderIdentity.address}`
  );
  console.log(
    `🔑 Verifier Org Address (${verifierIdentity.signingKeyType}): ${verifierIdentity.address}\n`
  );
  console.log("✅ Identities created!");
  // await utils.waitForEnter('\n⏎ Press Enter to continue..')

  // Step 2: Create a new Schema
  console.log(`\n\n✉️  Adding a new Schema \n`);
  let newSchemaContent = require("../res/schema.json");
  let newSchemaName = newSchemaContent.name + ":" + UUID.generate();
  newSchemaContent.name = newSchemaName;

  let newSchema = cord.Schema.fromSchemaProperties(
    newSchemaContent,
    employeeIdentity.address
  );

  let bytes = json.encode(newSchema);
  let encoded_hash = await hasher.digest(bytes);
  const schemaCid = CID.create(1, 0xb220, encoded_hash);

  let schemaCreationExtrinsic = await newSchema.store(schemaCid.toString());

  console.log(`📧 Schema Details `);
  console.dir(newSchema, { depth: null, colors: true });
  console.log(`CID: `, schemaCid.toString());
  console.log("\n⛓  Anchoring Schema to the chain...");
  console.log(`🔑 Creator: ${employeeIdentity.address} `);
  console.log(`🔑 Controller: ${entityIdentity.address} `);

  try {
    await cord.ChainUtils.signAndSubmitTx(
      schemaCreationExtrinsic,
      entityIdentity,
      {
        resolveOn: cord.ChainUtils.IS_IN_BLOCK,
      }
    );
    console.log("✅ Schema created!");
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }
  // await utils.waitForEnter('\n⏎ Press Enter to continue..')

  // Step 2: Create a new Stream
  console.log(`\n✉️  Adding a new Stream`, "\n");
  let content = {
    name: "Alice",
    age: 29,
    gender: "Female",
    country: "India",
    credit: 1000,
  };
  let schemaStream = cord.Content.fromSchemaAndContent(
    newSchema,
    content,
    employeeIdentity.address
  );
  console.log(`📧 Stream Details `);
  console.dir(schemaStream, { depth: null, colors: true });
  // await utils.waitForEnter('\n⏎ Press Enter to continue..')

  let newStreamContent = cord.ContentStream.fromStreamContent(
    schemaStream,
    employeeIdentity
  );
  console.log(`\n📧 Hashed Stream `);
  console.dir(newStreamContent, { depth: null, colors: true });
  // await utils.waitForEnter('\n⏎ Press Enter to continue..')

  bytes = json.encode(newStreamContent);
  encoded_hash = await hasher.digest(bytes);
  const streamCid = CID.create(1, 0xb220, encoded_hash);

  let newStream = cord.Stream.fromContentStreamProperties(
    newStreamContent,
    streamCid.toString()
  );

  let streamCreationExtrinsic = await newStream.store();
  console.log(`\n📧 Stream On-Chain Details`);
  console.dir(newStream, { depth: null, colors: true });
  // console.log(`CID: `, streamCid.toString())

  console.log("\n⛓  Anchoring Stream to the chain...");
  console.log(`🔑 Creator: ${employeeIdentity.address} `);
  console.log(`🔑 Controller: ${entityIdentity.address} `);

  try {
    await cord.ChainUtils.signAndSubmitTx(
      streamCreationExtrinsic,
      entityIdentity,
      {
        resolveOn: cord.ChainUtils.IS_IN_BLOCK,
      }
    );
    console.log("✅ Stream created!");
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }
  // await utils.waitForEnter('\n⏎ Press Enter to continue..')

  // Step 3: Create a new Credential and Link to the Stream
  console.log(`\n\n✉️  Adding a new Credential Schema \n`);
  let credSchema = require("../res/cred-schema.json");
  credSchema.name = credSchema.name + ":" + UUID.generate();

  let credSchemaStream = cord.Schema.fromSchemaProperties(
    credSchema,
    employeeIdentity.address
  );

  bytes = json.encode(credSchemaStream);
  encoded_hash = await hasher.digest(bytes);
  const credSchemaCid = CID.create(1, 0xb220, encoded_hash);

  let credSchemaCreationExtrinsic = await credSchemaStream.store(
    credSchemaCid.toString()
  );
  console.log("\n⛓  Anchoring Credential Schema to the chain...");

  try {
    await cord.ChainUtils.signAndSubmitTx(
      credSchemaCreationExtrinsic,
      entityIdentity,
      {
        resolveOn: cord.ChainUtils.IS_IN_BLOCK,
      }
    );
    console.log("✅ Schema created!");
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }

  for (let i = 0; !Number(argv.loop) || i < Number(argv.loop); i++) {
    console.log(`\🏷  Mark `, i);

    sleep(between(3000, 20000));

    console.log(`\n✉️  Adding a new Credential`, "\n");
    let credStream = {
      name: newStreamContent.content.contents.name + UUID.generate(),
      country: newStreamContent.content.contents.country,
    };

    let credStreamContent = cord.Content.fromSchemaAndContent(
      credSchemaStream,
      credStream,
      employeeIdentity.address
    );

    // console.log(`📧 Stream Details `)
    // console.dir(credStreamContent, { depth: null, colors: true })
    // await utils.waitForEnter('\n⏎ Press Enter to continue..')

    let credContentStream = cord.ContentStream.fromStreamContent(
      credStreamContent,
      employeeIdentity,
      {
        holder: holderIdentity.address,
        link: newStream.id,
      }
    );
    console.log(`\n📧 Hashed Stream Details`);
    console.dir(credContentStream, { depth: null, colors: true });
    // await utils.waitForEnter('\n⏎ Press Enter to continue..')

    bytes = json.encode(credContentStream);
    encoded_hash = await hasher.digest(bytes);
    const credStreamCid = CID.create(1, 0xb220, encoded_hash);

    let credStreamTx = cord.Stream.fromContentStreamProperties(
      credContentStream,
      credStreamCid.toString()
    );

    let credStreamCreationExtrinsic = await credStreamTx.store();
    console.log(`\n📧 Credential On-Chain Details`);
    console.dir(credStreamTx, { depth: null, colors: true });

    try {
      await cord.ChainUtils.signAndSubmitTx(
        credStreamCreationExtrinsic,
        entityIdentity,
        {
          resolveOn: cord.ChainUtils.IS_IN_BLOCK,
        }
      );
      console.log("✅ Credential created!");
    } catch (e: any) {
      console.log(e.errorCode, "-", e.message);
    }
  }
}

main()
  .then(() => console.log("\nBye! 👋 👋 👋 "))
  .finally(cord.disconnect);

process.on("SIGINT", async () => {
  console.log("\nBye! 👋 👋 👋 \n");
  cord.disconnect();
  process.exit(0);
});
