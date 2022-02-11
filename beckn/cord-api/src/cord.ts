import express from 'express';
import * as cord from '@cord.network/api'
import { Crypto, UUID } from '@cord.network/utils'
import * as json from 'multiformats/codecs/json'
import { blake2b256 as hasher } from '@multiformats/blake2/blake2b'
import { CID } from 'multiformats/cid'
import type { KeyringPair } from '@polkadot/keyring/types'

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

    // Step 1: Setup Org Identity
    console.log(`\n🏛  Creating Identities\n`)
    //3x4DHc1rxVAEqKWSx1DAAA8wZxLB4VhiRbMV997niBckUwSi
    const networkAuthor = cord.Identity.buildFromURI('//Alice', {
	signingKeyPairType: 'sr25519',
    })
    const productOwner = cord.Identity.buildFromURI('//Bob', {
	signingKeyPairType: 'sr25519',
    })
    const seller = cord.Identity.buildFromURI(my_id, {
	signingKeyPairType: 'sr25519',
    })

    console.log(
	`🔑 Network Author Address (${networkAuthor.signingKeyType}): ${networkAuthor.address}`
    )
    console.log(
	`🔑 Product Controller Address (${productOwner.signingKeyType}): ${productOwner.address}`
    )
    console.log(
	`🔑 Seller Address (${seller.signingKeyType}): ${seller.address}`
    )

    return { networkAuthor, productOwner, seller }
}


export async function registerProducts(id: any, schema: any, seller_name: string, product: any) {
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

    let price = product?.price ? product.price : 0;
    
    let listStream = cord.Content.fromSchemaAndContent(
	schema,
	productStream!.contents,
	id.seller!.address
    )
 
    let newListingContent = cord.ContentStream.fromStreamContent(
	listStream,
	id.seller!,
	{
	    link: newProduct!.id!,
	}
    )

    bytes = json.encode(newListingContent)
    encoded_hash = await hasher.digest(bytes)
    const listCid = CID.create(1, 0xb220, encoded_hash)
    const storeVal = {
	store: seller_name,
	seller: id.seller!.address,
    }
    const storeId = Crypto.hashObjectAsStr(storeVal)
    
    let newListing = cord.Product.fromProductContentAnchor(
	newListingContent,
	listCid.toString(),
	storeId.toString(),
	price
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

export async function initializeCord() {
    await cord.init({ address: 'wss://staging.cord.network' })

}

export async function registerSchema(id: any) {
    
    console.log(`\n\n✉️  Adding a new Product Schema \n`)
    let newProdSchemaContent = require('../res/ondc-prod-schema.json')

    let newProductSchema = cord.Schema.fromSchemaProperties(
	newProdSchemaContent,
	id.productOwner!.address
    )

    let bytes = json.encode(newProductSchema)
    let encoded_hash = await hasher.digest(bytes)
    const schemaCid = CID.create(1, 0xb220, encoded_hash)

    let productSchemaCreationExtrinsic = await newProductSchema.store(
	schemaCid.toString()
    )
    console.log(`📧 Schema Details `)
    console.dir(newProductSchema, { depth: null, colors: true })
    console.log(`CID: `, schemaCid.toString())
    console.log('\n⛓  Anchoring Schema to the chain...')
    console.log(`🔑 Controller: ${id.productOwner!.address} `)

    /* TODO: should be done during seller registration */
    let productSchemaDelegateExtrinsic = await newProductSchema.add_delegate(
	id.seller!.address
    )

    try {
	await cord.ChainUtils.signAndSubmitTx(
	    productSchemaDelegateExtrinsic,
	    id.productOwner!,
	    {
		resolveOn: cord.ChainUtils.IS_IN_BLOCK,
	    }
	)
	console.log('✅ Schema Delegation added: ${sellerOne.address}')
    } catch (e: any) {
	console.log(e.errorCode, '-', e.message)
	return false;
    }
    return true;
}

let seller_ids: any[] = ['//seller//1'];

async function registerProduct1(my_id: string, seller: string, product: any) {
    /* Create Identities - Can have a separate registry for this */
    if (!my_id || my_id === '') {
        my_id = '//seller//default';
    }
    if (!product?.name) {
	product = { ...product, name: "Default Item"};
    }
    let id = await createIdentities(my_id);

    let newProdSchemaContent = require('../res/ondc-prod-schema.json')

    let newProductSchema = cord.Schema.fromSchemaProperties(
	newProdSchemaContent,
	id.productOwner!.address
    )

    if (!seller_ids.includes(my_id)) {
        if (await registerSchema(id)) {
            seller_ids.push(my_id);
	}
    }

    // Step 2: Setup a new Product
    return await registerProducts(id, newProductSchema, seller, product);
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
    if (!data.product || data.product === '') {
	res.status(400).json({
            error: 'product is a required field'
        });
        return;
    }
    
    let id = data.identifier;
    let product: any = JSON.parse(data.product);
    let sellerName = data.seller_name;
    if (!sellerName) {
	sellerName = 'Default Seller';
    }
    let result = await registerProduct1(id, sellerName, product);

    res.status(200).json({
	product_list_id: result.id,
	blockHash: result.block
    });
    return;
}
