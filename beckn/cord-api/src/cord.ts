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

let provider: any = null;
let api: any = null;
let seller_ids: any[] = ['//seller//1'];
let prodSchemaContent = require('../res/ondc-prod-schema.json')
let networkAuthor: any = undefined;
let productOwner: any = undefined;
let schemas: any[] = [];
let productSchema: any = null;
let gproducts: any = {};
let delegations: any = {};

export async function initializeCord() {
    await cord.init({ address: 'wss://beckndemo.cord.network' })

    provider = new WsProvider('wss://beckndemo.cord.network');
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
	productOwner!.address,
	false /* usable without delegation */
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

export async function itemCreate(
    req: express.Request,
    res: express.Response
) {

    let data = req.body;

    let userId = data.identifier;
    if (!userId || userId === '') {
	res.status(400).json({
            error: 'identifier is a required field'
        });
        return;
    } else {
      if (!userId.startsWith('//'))
      	 userId = `//${userId}`;
    }
    
    let qty = data.quantity ? parseInt(data.quantity, 10): 1;
    
    let price: number = 0;
    try {
	price = parseInt(data.selling_price ? data.selling_price : '0', 10);
    } catch(err) {
	console.log("Error: ", err);
    }
    if (!price) {
	res.status(400).json({
            error: 'selling_price is a required field'
        });
        return;
    }

    let product: any = data.product;
    if (!product || !product.name || !product.sku) {
	res.status(400).json({
            error: 'product: {name, sku, ...} is a required field'
        });
        return;
       
    }
    let seller_name: string = data.seller_name ? data.seller_name as string : '';
    if (seller_name === '') {
	res.status(400).json({
            error: 'seller_name is a required field'
        });
        return;
    }
    let id = await createIdentities(userId);

    let productStream = cord.Content.fromSchemaAndContent(
	productSchema,
	product,
	id.user!.address
    )
    
    let newProductContent = cord.ContentStream.fromStreamContent(
	productStream,
	id.user!,
	{
	    nonceSalt: `${product.name}:${product.sku}:create`
	}
    )

    const storeVal = {
	store: seller_name,
	seller: id.user!.address,
    }
    const storeId = Crypto.hashObjectAsStr(storeVal)
    

    let bytes = json.encode(newProductContent)
    let encoded_hash = await hasher.digest(bytes)
    const streamCid = CID.create(1, 0xb220, encoded_hash)

    let newProduct = cord.Product.fromProductContentAnchor(
	newProductContent,
	streamCid.toString(),
	storeId, /*storeid */
	price, /* price */
	undefined, /* rating */
	qty,
    )

    let productCreationExtrinsic = await newProduct.create()

    try {
	let block = await cord.ChainUtils.signAndSubmitTx(
	    productCreationExtrinsic,
	    id.productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	res.status(200).json({blockHash: `${block.status.asInBlock}`, id: newProduct.id, success: true});
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	res.status(400).json({error: e.message});
    }

    return;
}

export async function itemDelegate(
    req: express.Request,
    res: express.Response
) {

    let data = req.body;

    let userId = data.identifier;
    if (!userId || userId === '') {
	res.status(400).json({
            error: 'identifier is a required field'
        });
        return;
    } else {
      if (!userId.startsWith('//'))
      	 userId = `//${userId}`;
    }
    let delegateId = data.delegateId;
    if (!delegateId || delegateId === '') {
	res.status(400).json({
            error: 'delegateId is a required field'
        });
        return;
    } else {
      if (!delegateId.startsWith('//'))
      	 delegateId = `//${delegateId}`;
    }

    let qty: number = 1;
    try {
	qty = parseInt(data.quantity ? data.quantity : '1', 10);
    } catch (err) {
	console.log("Quanity: ", err);
    }
    
    let price: number = 0;
    try {
	price = parseInt(data.selling_price ? data.selling_price : '0', 10);
    } catch(err) {
	console.log("Error: ", err);
    }
    if (!price) {
	res.status(400).json({
            error: 'selling_price is a required field'
        });
        return;
    }

    let product: any = data.product;
    if (!product || !product.name || !product.sku) {
	res.status(400).json({
            error: 'product: {name, sku, ...} is a required field'
        });
        return;
       
    }
    let seller_name: string = data.seller_name ? data.seller_name as string : '';
    if (seller_name === '') {
	res.status(400).json({
            error: 'seller_name is a required field'
        });
        return;
    }
    let itemCreateId: string = data.createId ? data.createId as string : '';
    if (itemCreateId === '') {
	res.status(400).json({
            error: '"createId" is a required field'
        });
        return;
    }

    let id = await createIdentities(userId);

    let delegate = await createIdentities(delegateId);

    let productStream = cord.Content.fromSchemaAndContent(
	productSchema,
	product,
	delegate.user!.address
    )

    let newProductContent = cord.ContentStream.fromStreamContent(
	productStream,
	delegate.user!,
	{
	    link: itemCreateId,
	    nonceSalt: `${product.name}:${product.sku}:delegate`
	}
    )

    const storeVal = {
	store: seller_name,
	seller: id.user!.address,
    }
    const storeId = Crypto.hashObjectAsStr(storeVal)
    

    let bytes = json.encode(newProductContent)
    let encoded_hash = await hasher.digest(bytes)
    const streamCid = CID.create(1, 0xb220, encoded_hash)

    let newDelegate = cord.Product.fromProductContentAnchor(
	newProductContent,
	streamCid.toString(),
	storeId, /*storeid */
	price, /* price */
	undefined, /* rating */
	qty,
    )

    let productCreationExtrinsic = await newDelegate.delegate();
    try {
	let block = await cord.ChainUtils.signAndSubmitTx(
	    productCreationExtrinsic,
	    id.productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	res.status(200).json({blockHash: `${block.status.asInBlock}`, id: newDelegate.id, success: true});
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	res.status(400).json({error: e.message});
    }    

    return;
}

export async function itemAdd(
    req: express.Request,
    res: express.Response
) {

    let data = req.body;

    let userId = data.identifier;
    if (!userId || userId === '') {
	res.status(400).json({
            error: 'identifier is a required field'
        });
        return;
    } else {
      if (!userId.startsWith('//'))
      	 userId = `//${userId}`;
    }

    let qty: number = 1;
    try {
	qty = parseInt(data.quantity ? data.quantity : '1', 10);
    } catch (err) {
	console.log("Quanity: ", err);
    }
    
    let price: number = 0;
    try {
	price = parseInt(data.selling_price ? data.selling_price : '0', 10);
    } catch(err) {
	console.log("Error: ", err);
    }
    if (!price) {
	res.status(400).json({
            error: 'selling_price is a required field'
        });
        return;
    }

    let product: any = data.product;
    if (!product || !product.name || !product.sku) {
	res.status(400).json({
            error: 'product: {name, sku, ...} is a required field'
        });
        return;
       
    }
    let seller_name: string = data.seller_name ? data.seller_name as string : '';
    if (seller_name === '') {
	res.status(400).json({
            error: 'seller_name is a required field'
        });
        return;
    }
    /*
    let itemCreateId: string = data.listId ? data.listId as string : '';
    if (itemCreateId === '') {
	res.status(400).json({
            error: '"listId" is a required field'
        });
        return;
    }
    */
    let id = await createIdentities(userId);

    let productStream = cord.Content.fromSchemaAndContent(
	productSchema,
	product,
	id.user!.address
    )

    let newProductContent = cord.ContentStream.fromStreamContent(
	productStream,
	id.user!,
	{
	    nonceSalt: `${product.name}:${product.sku}:create`
	}
    )

    let newListContent = cord.ContentStream.fromStreamContent(
	productStream,
	id.user!,
	{
	    link: newProductContent.id.replace('cord:stream:', ''),
	    nonceSalt: `${product.name}:${product.sku}:list`
	}
    )
    
    const storeVal = {
	store: seller_name,
	seller: id.user!.address,
    }
    const storeId = Crypto.hashObjectAsStr(storeVal)
    

    let bytes = json.encode(newProductContent)
    let encoded_hash = await hasher.digest(bytes)
    const streamCid = CID.create(1, 0xb220, encoded_hash)

    let newListing = cord.Product.fromProductContentAnchor(
	newListContent,
	streamCid.toString(),
	storeId, /*storeid */
	price, /* price */
	undefined, /* rating */
	qty,
    )

    let productCreationExtrinsic = await newListing.list();
    try {
	let block = await cord.ChainUtils.signAndSubmitTx(
	    productCreationExtrinsic,
	    id.productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	res.status(200).json({blockHash: `${block.status.asInBlock}`, id: newListing.id, success: true});
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	res.status(400).json({error: e.message});
    }
    return;
}

export async function orderConfirm(
    req: express.Request,
    res: express.Response
) {

    let data = req.body;

    let userId = data.identifier;
    if (!userId || userId === '') {
	res.status(400).json({
            error: 'identifier is a required field'
        });
        return;
    } else {
      if (!userId.startsWith('//'))
      	 userId = `//${userId}`;
    }

    let qty: number = 1;
    try {
	qty = parseInt(data.quantity ? data.quantity : '1', 10);
    } catch (err) {
	console.log("Quanity: ", err);
    }
    
    let price: number = 0;
    try {
	price = parseInt(data.order_price ? data.order_price : '0', 10);
    } catch(err) {
	console.log("Error: ", err);
    }
    if (!price) {
	res.status(400).json({
            error: 'selling_price is a required field'
        });
        return;
    }

    let blockHash = data.blockHash;
    if (!blockHash || blockHash === '') {
	res.status(400).json({
            error: 'blockHash is a required field'
        });
        return;
    }
    let listId = data.listId;
    if (!listId || listId === '') {
	res.status(400).json({
            error: 'listId is a required field'
        });
        return;
    }

    let id = await createIdentities(userId);

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
		0,
	    )
	}
    });

    // Step 4: Create an Order from the lists
    let orderStream = cord.Content.fromSchemaAndContent(
	productSchema,
	{name: "Hello"},
	id.user!.address
    )
    let newOrderContent = cord.ContentStream.fromStreamContent(
	orderStream,
	id.user!,
	{
	    link: listingId,
	    nonceSalt: UUID.generate(),
	}
    )

    let bytes = json.encode(newOrderContent)
    let encoded_hash = await hasher.digest(bytes)
    const orderCid = CID.create(1, 0xb220, encoded_hash)

    let newOrder = cord.Product.fromProductContentAnchor(
	newOrderContent,
	orderCid.toString(),
	storeId,
	price,
	undefined, /* rating */
	qty,
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
	
	blkhash = `${block.status.asInBlock}`;
	res.json({success: true, block: blkhash});
	return;
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	res.status(400).json({success: false, block: ''});
    }

    return;
}
