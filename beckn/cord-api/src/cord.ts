import express from 'express';
import * as cord from '@cord.network/api'
import { Crypto, UUID } from '@cord.network/utils'
import * as json from 'multiformats/codecs/json'
import { blake2b256 as hasher } from '@multiformats/blake2/blake2b'
import { CID } from 'multiformats/cid'
import type { KeyringPair } from '@polkadot/keyring/types'
const { ApiPromise, WsProvider } = require('@polkadot/api');

const AUTH_SEED =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const ENC_SEED =
  '0x0000000000000000000000000000000000000000000000000000000000000001'
const ATT_SEED =
  '0x0000000000000000000000000000000000000000000000000000000000000002'
const DEL_SEED =
  '0x0000000000000000000000000000000000000000000000000000000000000003'

export function generate_ed25519_authentication_key(): KeyringPair {
  return cord.Identity.buildFromSeedString(AUTH_SEED, {
    signingKeyPairType: 'ed25519',
  }).signKeyringPair
}
export function get_ed25519_authentication_key_id(): string {
  return '0xed52d866f75a5e57641b6ca68a7618312564de787cda3d0664d15471ec1d12b5'
}

export function generate_sr25519_authentication_key(): KeyringPair {
  return cord.Identity.buildFromSeedString(AUTH_SEED, {
    signingKeyPairType: 'sr25519',
  }).signKeyringPair
}
export function get_sr25519_authentication_key_id(): string {
  return '0x1eb4134f8acf477337de6b208c1044b19b9ac09e20e4c6f6c1561d1cef6cad8b'
}

export function generate_encryption_key(): nacl.BoxKeyPair {
  return cord.Identity.buildFromSeedString(ENC_SEED, {
    signingKeyPairType: 'ed25519',
  }).boxKeyPair
}
export function get_encryption_key_id(): string {
  return '0xd8752aed376a12f17ee8c5e06aa19df1cea571da1c9241fc50c330504513b350'
}

export function generate_ed25519_anchor_key(): KeyringPair {
  return cord.Identity.buildFromSeedString(ATT_SEED, {
    signingKeyPairType: 'ed25519',
  }).signKeyringPair
}
export function get_ed25519_anchor_key_id(): string {
  return '0xee643cd1b9567e60b913ef6d7b99e117277413736955051b891b07fa2cff1ca2'
}

export function generate_sr25519_anchor_key(): KeyringPair {
  return cord.Identity.buildFromSeedString(ATT_SEED, {
    signingKeyPairType: 'sr25519',
  }).signKeyringPair
}
export function get_sr25519_anchor_key_id(): string {
  return '0x8ab41dc8ddfecb44ca18658b0a34becdcc0580096855c9f7cbb8575b02356286'
}

export function generate_ed25519_delegation_key(): KeyringPair {
  return cord.Identity.buildFromSeedString(DEL_SEED, {
    signingKeyPairType: 'ed25519',
  }).signKeyringPair
}
export function get_ed25519_delegation_key_id(): string {
  return '0xe8633ac00f7cf860d6310624c721e4229d7f661de9afd885cd2d422fd15b7669'
}

export function generate_sr25519_delegation_key(): KeyringPair {
  return cord.Identity.buildFromSeedString(DEL_SEED, {
    signingKeyPairType: 'sr25519',
  }).signKeyringPair
}
export function get_sr25519_delegation_key_id(): string {
  return '0x81dc5bf133b998d615b70563ee94e92296e1219f8235b008b38a2ddb40168a35'
}

export async function waitForEnter(message?: string) {
  const waitForEnter = require('wait-for-enter')
  message = message || 'Press Enter to continue: '
  console.log(message)
  await waitForEnter()
}

function between(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
}

export async function createIdentities(my_id: string) {

    const user = cord.Identity.buildFromURI(my_id, {
	signingKeyPairType: 'sr25519',
    })

    console.log(
	`🔑 User Address (${user.signingKeyType}): ${user.address}`
    )

    return { networkAuthor, productOwner, user }
}


export async function registerProductOnCord(id: any, schema: any, seller_name: string, product: any, price: any) {
    // Step 2: Setup a new Product
    console.log(`\n✉️  Listening to new Product Additions`, '\n')
    
    let productStream = cord.Content.fromSchemaAndContent(
	schema,
	product,
	id.productOwner!.address
    )
    
    let newProductContent = cord.ContentStream.fromStreamContent(
	productStream,
	id.productOwner!
    )

    let bytes = json.encode(newProductContent)
    let encoded_hash = await hasher.digest(bytes)
    const streamCid = CID.create(1, 0xb220, encoded_hash)

    let newProduct = cord.Product.fromProductContentAnchor(
	newProductContent,
	streamCid.toString()
    )

    let productCreationExtrinsic = await newProduct.create()

    try {
	await cord.ChainUtils.signAndSubmitTx(
	    productCreationExtrinsic,
	    id.productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	return {id: '', block: '', error: e.message};
    }

    let listStream = cord.Content.fromSchemaAndContent(
	schema,
	productStream!.contents,
	id.user!.address
    )
 
    let newListingContent = cord.ContentStream.fromStreamContent(
	listStream,
	id.user!,
	{
	    link: newProduct!.id!,
	}
    )

    bytes = json.encode(newListingContent)
    encoded_hash = await hasher.digest(bytes)
    const listCid = CID.create(1, 0xb220, encoded_hash)
    const storeVal = {
	store: seller_name,
	seller: id.user!.address,
    }
    const storeId = Crypto.hashObjectAsStr(storeVal)
    
    let sellingprice = product?.price ? parseInt(product.price) : parseInt(price, 10);
    
    let newListing = cord.Product.fromProductContentAnchor(
	newListingContent,
	listCid.toString(),
	storeId.toString(),
	sellingprice
    )

    let listingCreationExtrinsic = await newListing.list()
    let blkhash = '';
    try {
	let block = await cord.ChainUtils.signAndSubmitTx(
	    listingCreationExtrinsic,
	    id.networkAuthor!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	console.log("Success", block, newListing, listingCreationExtrinsic);
	blkhash = `${block.status.asInBlock}`;
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	return { id: '', block: undefined };
    }

    return { id: newListing.id, block: blkhash } ;
}

let provider: any = null;
let api: any = null;
let seller_ids: any[] = ['//seller//1'];
let prodSchemaContent = require('../res/ondc-prod-schema.json')
let networkAuthor: any = undefined;
let productOwner: any = undefined;
let schemas: any[] = [];
let productSchema: any = null;

export async function initializeCord() {
    await cord.init({ address: 'wss://staging.cord.network' })

    provider = new WsProvider('wss://staging.cord.network');
    api = await ApiPromise.create({ provider});

    networkAuthor = cord.Identity.buildFromURI('//Alice', {
	signingKeyPairType: 'sr25519',
    })
    productOwner = cord.Identity.buildFromURI('//Bob', {
	signingKeyPairType: 'sr25519',
    })
    console.log(
	`🔑 Network Author Address (${networkAuthor.signingKeyType}): ${networkAuthor.address}`
    )
    console.log(
	`🔑 Product Controller Address (${productOwner.signingKeyType}): ${productOwner.address}`
    )

    productSchema = cord.Schema.fromSchemaProperties(
	prodSchemaContent,
	productOwner!.address
    )
    let bytes = json.encode(productSchema)
    let encoded_hash = await hasher.digest(bytes)
    const schemaCid = CID.create(1, 0xb220, encoded_hash)

    let pSchemaExtrinsic = await productSchema.store(
	schemaCid.toString()
    )

    try {
	await cord.ChainUtils.signAndSubmitTx(
	    pSchemaExtrinsic,
	    productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	console.log('✅ Schema added: ${productSchema.id}')
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
    }    
}

export async function registerSchema(id: any, name: string) {
    /* TODO: should be done during seller registration */
    let schContent = {...prodSchemaContent};
    schContent.name = `Item: ${name}`;
    let schm = cord.Schema.fromSchemaProperties(
	schContent,
	id.productOwner!.address
    )
    let bytes = json.encode(schm)
    let encoded_hash = await hasher.digest(bytes)
    const schemaCid = CID.create(1, 0xb220, encoded_hash)

    let pSchemaExtrinsic = await schm.store(
	schemaCid.toString()
    )

    try {
	await cord.ChainUtils.signAndSubmitTx(
	    pSchemaExtrinsic,
	    id.productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	console.log('✅ Schema added: ${schm.id}')
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	return { success: false, schema: undefined }
    }
    console.dir(schm, { depth: null, colors: true })    
    return { success: true, schema: schm };
}

export async function registerSchemaDelegate(id: any, name: string, schema: any) {
    /* TODO: should be done during seller registration */

    let productSchemaDelegateExtrinsic = await schema.add_delegate(
	id.user!.address
    )

    try {
	await cord.ChainUtils.signAndSubmitTx(
	    productSchemaDelegateExtrinsic,
	    id.productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	console.log('✅ Schema Delegation added: ${id.user!.address}')
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	return { success: false, schema: undefined }
    }
    console.dir(schema, { depth: null, colors: true })    
    return { success: true, schema: schema };
}

async function registerProduct1(id: any, schema: any, seller: string, product: any, price: any) {
    // Step 2: Setup a new Product
    return await registerProductOnCord(id, schema, seller, product, price);
}


export async function placeOrderOnCord(id: any, schema: any, product: any, listId: string, storeId: string, price: any) {
    let orderStream = cord.Content.fromSchemaAndContent(
	schema,
	{name: "Hello"},
	id.user!.address
    )
    let newOrderContent = cord.ContentStream.fromStreamContent(
	orderStream,
	id.user!,
	{
	    link: listId,
	}
    )

    let bytes = json.encode(newOrderContent)
    let encoded_hash = await hasher.digest(bytes)
    const orderCid = CID.create(1, 0xb220, encoded_hash)

    let newOrder = cord.Product.fromProductContentAnchor(
	newOrderContent,
	orderCid.toString(),
	storeId,
	price ? price : 0,
    )

    let orderCreationExtrinsic = await newOrder.order()

    let blkhash: any = '';
    try {
	let block =  await cord.ChainUtils.signAndSubmitTx(
	    orderCreationExtrinsic,
	    id.networkAuthor!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	
	console.log(`✅ Order (${newOrder.id}) created! `)
	blkhash = `${block.status.asInBlock}`;
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
    }

    return blkhash;
}

async function placeOrder1(my_id: string, listId: string, blockHash: string, price: any) {
    /* Create Identities - Can have a separate registry for this */
    let id = await createIdentities(my_id);

    let signedBlock: any = undefined;
    try {
	signedBlock = await api.rpc.chain.getBlock(blockHash);
    } catch(err) {
	console.log("error to place order", err, blockHash);
    }
    if (!signedBlock) {
	return {error: 'block Hash not valid'}
    }

    let storeId: string = '';
    let listingId: string = '';
    let product: any = {};
    signedBlock.block.extrinsics.forEach(async (ex: any, index: number) => {
	const { method: { args, method, section } } = ex;

	if (method !== 'list' && section !== 'product') {
	   return;
	}

	listingId = args[0].toString();

	/* there can be more than 1 product.list events */
	if (listingId === listId) {
            /* This is matching now */
	    storeId = args[3].toString();
	    let item_price = args[4].toString();
	    let product = cord.Product.fromProductAnchor(
		listId,
		args[2].toString(), /* contentHash */
		args[5].toString(), /* cid */
		args[1].toString(), /* creator */
		storeId,
		productSchema.id?.replace('cord:schema:',''),
		parseInt(item_price, 10),
		args[7].toString(), /* link */
		0
	    )
	}
    });

    // Step 4: Create an Order from the lists
    let block = await placeOrderOnCord(id, productSchema, product, listingId, storeId, price);

    return {block: block}
}


export async function registerProduct(
    req: express.Request,
    res: express.Response
) {

    let data = req.body;

    if (!data.identifier || data.identifier === '') {
	res.status(400).json({
            error: 'identifier is a required field'
        });
        return;
    }
    if (!data.product || data.product === '' || data.product === {}) {
	res.status(400).json({
            error: 'product is a required field'
        });
        return;
    }
    
    let my_id = data.identifier;
    let product: any = data.product;
    let sellerName = data.seller_name;
    if (!sellerName) {
	sellerName = 'Default Seller';
    }
    let price = data.selling_price;
    if (!price) {
	price = 0;
    }
    /* Create Identities - Can have a separate registry for this */
    if (!my_id || my_id === '') {
        my_id = '//seller//default';
    }
    if (!product?.name) {
	product = { ...product, name: "Default Item"};
    }
    let id = await createIdentities(my_id);


    /* get the schema registered */
    let fail = true;
    if (product.name && product.name.length % 2) {
	let schma = await registerSchema(id, product.name);
	if (schma.success) {
	    let schmaDelegate = await registerSchemaDelegate(id,
							     product.name,
							     schma.schema);
	    if (schmaDelegate.success) {
		let result = await registerProduct1(id,
						    schmaDelegate.schema,
						    sellerName,
						    product,
						    price);
		fail = false;
		res.status(200).json({
		    product_list_id: result.id,
		    blockHash: result.block
		});
	    }
	}
    }

    if (fail) {
	res.status(400).json({error: "item.catalog addition confirmation failed"});
    }
    
    return;
}


export async function placeOrder(
    req: express.Request,
    res: express.Response
) {

    let data = req.body;

    if (!data.identifier || data.identifier === '') {
	res.status(400).json({
            error: 'identifier is a required field'
        });
        return;
    }
    let result = await placeOrder1(data.identifier, data.listId, data.blockHash, data.order_price);
    if (result.error) {
	res.status(400).json(result);
        return;
    }
    res.status(200).json(result);
    return;
}

export async function getBlockDetails(
    req: express.Request,
    res: express.Response
) {
    let blockHash = req.params.hash;
    if (!blockHash) {
       res.status(400).json({ error: "blockHash is a required field"});
       return;
    }
    if (blockHash.length < 16) {
	blockHash = await api.rpc.chain.getBlockHash(blockHash);
	if (!blockHash) {
	    res.status(404).json({ error: "Failed to get blockHash from number"});
	    return;
	}
    }
    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    if (!signedBlock) {
       res.status(404).json({ error: "block Hash not found"});
       return;
    }

    let extrinsics: any = [];
    signedBlock.block.extrinsics.forEach((ex: any, index: number) => {
	const { method: { args, method, section } } = ex;

	extrinsics.push({
	   index,
	   section,
	   method,
	   args: args.map((a) => a.toString())
	})
    });

    const events = await api.query.system.events.at(signedBlock.block.header.hash);
    res.status(200).json({
	extrinsics,
	events,
    });
    return;
}


export async function checkDelegation(
    req: express.Request,
    res: express.Response
) {

    let data = req.body;

    if (!data.identifier || data.identifier === '') {
	res.status(400).json({
            error: 'identifier is a required field'
        });
        return;
    }
    let result = await placeOrder1(data.identifier, data.listId, data.blockHash, data.order_price);
    if (result.error) {
	res.status(400).json(result);
        return;
    }
    res.status(200).json(result);
    return;
}
