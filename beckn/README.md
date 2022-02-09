
# Beckn focused scripts

## Register Schemas

one can register required 'item' schema, used in product create/list transaction by below command (to be performed once per schema)

```
cd cord-scripts/beckn/
npx ts-node ./beckn-schema-register.ts
```

### Delegate schema

To allow a seller to register an item, we need to 'delegate' the schema to the seller, and hence knowing the seller identity is critical. (not having their key, but their address, which is public in nature.

For now, please edit the file `beckn-seller-delegate-to-schema.ts` and add the required identity in the 'createIdentities()' method in 'main()' method. After that, execute the script.

```
cd cord-scripts/beckn/
npx ts-node ./beckn-seller-delegate-to-schema.ts
```


## BPP

The script for the bpp runs in the browser page, and hence its important to get the typescript module loaded up in the browser.

### Build

To get things executed, do the following to build the bundle from typescript:

```
cd cord-scripts/
node beckn/browserify-bpp.js | uglifyjs -cm > beckn/bpp.js
```

### HTML browser \<script\>

The sample script is added in `index.html` file. The exported method is called 'addProductToCord()'. The exported method `addProductToCord()` takes 2 arguments.

 * 1 is `my_id` which is a string to provide the key identifier. This should be separate per registered seller, and remain same for the life-time of the seller, as it will be their identity on the chain.

NOTE: this identity should be having the schema registered for delegation. 

 * 2 is 'product', which should be an JSON Object with Beckn Item schema. Currently (ie, right now), Cord doesn't support objects inside of this, and hence one needs to have the flatted product object. As minimum as having a `{name}` field works for product registration for now.

The return value of the method is a Promise(), which returns the product listing Identity and Block Hash where the transaction is anchored, which should be saved in the inventory, so we can see it in BAP side when the listing happens.


## BAP


### UI Change in the listing output

* Add a badge when the above 'listing identity' is passed in the listing.

Current code to fetch the details from the block. This block Identity is expected to come from catalog listing.

### Script to register an order


```
npx ts-node beckn/beckn-bap.ts
```

Notice that the script is designed to be called with arguments recieved from listingId, and blockHash (both available for BPP), along with buyer identifier (which doesn't need any pre-token loading or anything). This identity should remain same for the buyer across instances (Hence good to choose email or something for it).

