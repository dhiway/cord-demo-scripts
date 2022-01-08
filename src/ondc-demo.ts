import * as cord from "@cord.network/api";
import { UUID } from "@cord.network/utils";
// import * as utils from "./utils";
import * as json from "multiformats/codecs/json";
import { blake2b256 as hasher } from "@multiformats/blake2/blake2b";
import { CID } from "multiformats/cid";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { create as ipfs_create } from 'ipfs-http-client';

const { DEMO_KEY_URI, DEMO_WSS_ADDR, DEMO_IPFS_HOST, DEMO_IPFS_PORT, DEMO_IPFS_PROTO } = process.env;

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
    .option("ondc", {
      alias: "o",
      demandOption: false,
      default: DEMO_KEY_URI ? DEMO_KEY_URI : "//1//ondc",
      describe:
        "URI to generate the key, so we can sign the transactions using the given key.",
      type: "string",
    })
    .option("seller1", {
      alias: "s1",
      demandOption: false,
      default: DEMO_KEY_URI ? DEMO_KEY_URI : "//1//seller1",
      describe:
        "URI to generate the key, so we can sign the transactions using the given key.",
      type: "string",
    })
    .option("seller2", {
      alias: "s2",
      demandOption: false,
      default: DEMO_KEY_URI ? DEMO_KEY_URI : "//1//seller2",
      describe:
        "URI to generate the key, so we can sign the transactions using the given key.",
      type: "string",
    })
    .option("seller3", {
      alias: "s3",
      demandOption: false,
      default: DEMO_KEY_URI ? DEMO_KEY_URI : "//1//seller3",
      describe:
        "URI to generate the key, so we can sign the transactions using the given key.",
      type: "string",
    })
    .option("buyer1", {
      alias: "b1",
      demandOption: false,
      default: DEMO_KEY_URI ? DEMO_KEY_URI : "//1//buyer1",
      describe:
        "URI to generate the key, so we can sign the transactions using the given key.",
      type: "string",
    })
    .option("buyer2", {
      alias: "b2",
      demandOption: false,
      default: DEMO_KEY_URI ? DEMO_KEY_URI : "//1//buyer2",
      describe:
        "URI to generate the key, so we can sign the transactions using the given key.",
      type: "string",
    })
    .option("chain", {
      alias: "c",
      default: DEMO_WSS_ADDR ? DEMO_WSS_ADDR : "ws://127.0.0.1:9944",
      describe: "chain ws address to connect to",
      type: "string",
    })
    .option("ipfs_host", {
      alias: "h",
      default: DEMO_IPFS_HOST ? DEMO_IPFS_HOST : "preview.ipfs.dway.io",
      describe: "IPFS host to connect to",
      type: "string",
    })
    .option("ipfs_port", {
      alias: "p",
      default: DEMO_IPFS_PORT ? DEMO_IPFS_PORT : 5001,
      describe: "IPFS port to connect to",
      type: "number",
    })
    .option("ipfs_proto", {
      alias: "r",
      default: DEMO_IPFS_PROTO ? DEMO_IPFS_PROTO : "https",
      describe: "IPFS Protocol to connect to",
      type: "string",
    }).argv
    

  await cord.init({ address: argv.chain });

  // Step 1: Setup Org Identity
  console.log(`\n🏛  Creating Identities\n`);
  
  //3x4DHc1rxVAEqKWSx1DAAA8wZxLB4VhiRbMV997niBckUwSi
  const ondc = cord.Identity.buildFromURI(argv.ondc, {
    signingKeyPairType: "sr25519",
  });

  const seller1 = cord.Identity.buildFromURI(argv.seller1, {
    signingKeyPairType: "sr25519",
  });
  const seller2 = cord.Identity.buildFromURI(argv.seller2, {
    signingKeyPairType: "sr25519",
  });
  const seller3 = cord.Identity.buildFromURI(argv.seller3, {
    signingKeyPairType: "sr25519",
  });

  const buyer1 = cord.Identity.buildFromURI(argv.buyer1, {
    signingKeyPairType: "sr25519",
  });
  const buyer2 = cord.Identity.buildFromURI(argv.buyer2, {
    signingKeyPairType: "sr25519",
  });

  console.log(
    `🔑 Registry Address (${ondc.signingKeyType}): ${ondc.address}`
  );
  console.log(
    `🔑 Seller1 Address (${seller1.signingKeyType}): ${seller1.address}`
  );
  console.log(
    `🔑 Seller2 Address (${seller2.signingKeyType}): ${seller2.address}`
  );
  console.log(
    `🔑 Seller3 Address (${seller3.signingKeyType}): ${seller3.address}`
  );
  console.log(
    `🔑 Buyer1 Address (${buyer1.signingKeyType}): ${buyer1.address}`
  );
  console.log(
    `🔑 Buyer2 Address (${buyer2.signingKeyType}): ${buyer2.address}`
  );
  console.log("✅ Identities created!");

  // Step 2: Create a new Product Schema
  console.log(`\n\n✉️  Adding Product Schema \n`);
  let newSchemaContent = require('../res/ondc-prod-schema.json');
  let newSchemaName = newSchemaContent.name + ":" + UUID.generate();
  newSchemaContent.name = newSchemaName;

  let newSchema = cord.Schema.fromSchemaProperties(
    newSchemaContent,
    ondc.address
  );

  let bytes = json.encode(newSchema);


  let encoded_hash = await hasher.digest(bytes);
  const schemaCid = CID.create(1, 0xb220, encoded_hash);

  //  let client = ipfs_create({host: argv.ipfs_host, port: Number(argv.ipfs_port), protocol: 'https'});
  // let client = ipfs_create();
  // let addCid = await client.add(JSON.stringify(newSchema));

  let schemaCreationExtrinsic = await newSchema.store(schemaCid.toString());

  console.log(`📧 Product Schema Details `);
  console.dir(newSchema, { depth: null, colors: true });
  console.log("\n⛓  Anchoring Product Schema to the chain...");
  console.log(`🔑 Creator: ${ondc.address} `); // Ideally this should be manufacturer
  console.log(`🔑 Controller: ${ondc.address} `);

  try {
    await cord.ChainUtils.signAndSubmitTx(
      schemaCreationExtrinsic,
      ondc,
      {
        resolveOn: cord.ChainUtils.IS_IN_BLOCK,
      }
    );
    console.log("✅ Schema created!");
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }

  //let tvbrands = [ "Sony", "Samsung", "LG", "mi", "MRL", "Onida", "Wu", "Panasonic" ];
  let tvbrands = [ "Sony", "Samsung", "LG", "mi" ];
  //let tvnames = [ "TV 32\"", "TV 40\"", "TV 43\"", "TV 46\"", "TV 55\"", "TV 65\"" ];
  let tvnames = [ "TV 32\"", "TV 40\"", "TV 55\"", "TV 65\"" ];
  let models = [ "2022" ];

    let products: any = [];
    let productContents: any = [];
  await Promise.all(tvbrands.map(async (b) => {
      await Promise.all(tvnames.map(async (n) => {
          await Promise.all(models.map(async (m) => {
	      
  // Step 2: Create a new Product
  console.log(`\n✉️  Adding new Product`, "\n");
  let content = {
      name: n,
      description: "Best Television in the World",
      countryOfOrigin: "India",
      gtin: UUID.generate(),
      brand: b,
      manufacturer: b,
      model: m,
      sku: UUID.generate(),
      price: `${between(15000, 200000)}`,
      aggregateRating: "0",
  };
  let schemaStream = cord.Content.fromSchemaAndContent(
    newSchema,
    content,
    //m === "2021" ? seller1.address : seller2.address
    ondc.address,
  );
  console.log(`📧 Product Details `);
  console.dir(schemaStream, { depth: null, colors: true });

  let newStreamContent = cord.ContentStream.fromStreamContent(
    schemaStream,
    //m === "2021" ? seller1 : seller2
    ondc,
  );
  console.log(`\n📧 Hashed Product Stream `);
  console.dir(newStreamContent, { depth: null, colors: true });

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

  console.log("\n⛓  Anchoring Product to the chain...");
  console.log(`🔑 Creator: ${seller1.address} `);
  console.log(`🔑 Controller: ${ondc.address} `);

  try {
    await cord.ChainUtils.signAndSubmitTx(
      streamCreationExtrinsic,
      ondc,
      {
        resolveOn: cord.ChainUtils.IS_IN_BLOCK,
      }
    );
    console.log(`✅ Product (${newStream.id}) created! `);
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }
	      productContents.push(content);
	      products.push(newStream);
	  }));
      }));
  }));

    
  // Step 3: Create a new Invoice Schema and Link to the Purchase Stream
  console.log(`\n\n✉️  Adding a new Invoice Schema \n`);
  let invoiceSchema = require("../res/ondc-sell-schema.json");
  invoiceSchema.name = invoiceSchema.name + ":" + UUID.generate();

  let invoiceSchemaStream = cord.Schema.fromSchemaProperties(
    invoiceSchema,
    ondc.address
  );

  bytes = json.encode(invoiceSchemaStream);
  encoded_hash = await hasher.digest(bytes);
  const invoiceSchemaCid = CID.create(1, 0xb220, encoded_hash);

  let invoiceSchemaCreationExtrinsic = await invoiceSchemaStream.store(
    invoiceSchemaCid.toString()
  );
  console.log("\n⛓  Anchoring Invoice Schema to the chain...");

  try {
    await cord.ChainUtils.signAndSubmitTx(
      invoiceSchemaCreationExtrinsic,
      ondc,
      {
        resolveOn: cord.ChainUtils.IS_IN_BLOCK,
      }
    );
    console.log("✅ Invoice Schema created!");
  } catch (e: any) {
    console.log(e.errorCode, "-", e.message);
  }

    let soldProducts: any = [];
    for (let i = 0; i < 10; i++) {
	let idx: number = between(0,products.length);
	let product = productContents[idx];
	let prodStream = products[idx];

	console.log(`\n✉️  Creating new Purchase`, "\n");
	let purchaseStream = {
	    sku: product.sku,
	    price: product.price,
	    sellerDetails: seller1.address,
	    buyer: idx % 2 ? buyer1.address : buyer2.address,
	    invoice: `${UUID.generate()}`
	};

	let purchaseStreamContent = cord.Content.fromSchemaAndContent(
	    invoiceSchemaStream,
	    purchaseStream,
	    ondc.address, //seller1.address
	);

	let purchaseContentStream = cord.ContentStream.fromStreamContent(
	    purchaseStreamContent,
	    ondc, //seller1,
	    {
		holder: idx % 2 ? buyer1.address : buyer2.address,
		link: prodStream.id,
	    }
	);
	console.log(`\n📧 Hashed Purchase Details`);
	console.dir(purchaseContentStream, { depth: null, colors: true });
	
	bytes = json.encode(purchaseContentStream);
	encoded_hash = await hasher.digest(bytes);
	const purchaseStreamCid = CID.create(1, 0xb220, encoded_hash);
	
	let purchaseStreamTx = cord.Stream.fromContentStreamProperties(
	    purchaseContentStream,
	    purchaseStreamCid.toString()
	);

	let purchaseStreamCreationExtrinsic = await purchaseStreamTx.store();
	console.log(`\n📧 Purchase On-Chain Details`);
	console.dir(purchaseStreamTx, { depth: null, colors: true });
	
	try {
	    await cord.ChainUtils.signAndSubmitTx(
		purchaseStreamCreationExtrinsic,
		ondc,
		{
		    resolveOn: cord.ChainUtils.IS_IN_BLOCK,
		}
	    );
	    console.log("✅ Purchase completed!");
	} catch (e: any) {
	    console.log(e.errorCode, "-", e.message);
	}
	soldProducts.push(purchaseContentStream);
    }

    /* 
  //  Step 7: Credential exchange via messaging
  console.log(`\n\n📩 Credential Exchange - Selective Disclosure (Verifier)`);
  console.log(`🔑 Verifier Address: ${verifierIdentity.address}`);
  const purpose = "Account Opening Request";
  const validUntil = Date.now() + 864000000;
  const relatedData = true;
  const { session, message: message } =
    cord.Exchange.Request.newRequestBuilder()
      .requestPresentation({
        schemaId: newSchema.id,
        properties: ["name"],
      })
      .finalize(
        purpose,
        verifierIdentity,
        holderIdentity.getPublicIdentity(),
        validUntil,
        relatedData
      );

  console.log(`\n📧 Selective Disclosure Request`);
  console.dir(message, { depth: null, colors: true });

  let credential: cord.Credential;
  credential = cord.Credential.fromStreamProperties(
    credContentStream,
    credStreamTx
  );
  const presentation = cord.Exchange.Share.createPresentation(
    holderIdentity,
    message,
    verifierIdentity.getPublicIdentity(),
    [credential],
    {
      showAttributes: message.body.content[0].requiredProperties,
      signer: holderIdentity,
      request: message.body.request,
      // purpose: request.body.purpose,
      // validUntil: request.body.validUntil,
    }
  );

  const { verified } = await cord.Exchange.Verify.verifyPresentation(
    presentation,
    session
  );

  console.log(`\n📧 Received Credential `);
  console.dir(presentation, { depth: null, colors: true });
  console.log("🔍 All valid? ", verified);

  // await utils.waitForEnter("\n⏎ Press Enter to continue..");
  */
}
main()
  .then(() => console.log("\nBye! 👋 👋 👋 "))
  .finally(cord.disconnect);

process.on("SIGINT", async () => {
  console.log("\nBye! 👋 👋 👋 \n");
  cord.disconnect();
  process.exit(0);
});
