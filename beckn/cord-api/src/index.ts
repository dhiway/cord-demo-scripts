const fs = require('fs');
const os = require('os');

import express from 'express';
import http from 'http';

import { initializeCord, registerProduct, getBlockDetails, placeOrder } from './cord';

const {
    PORT,
} = process.env;

const app = express();
let router = express.Router({ mergeParams: true });

router.post('/register-product', async (req, res) => {
    return await registerProduct(req, res);
});

router.post('/item-add', async (req, res) => {
    return await registerProduct(req, res);
});

//router.post('/delegate-schema', async (req, res) => {
//    return await delegateSchema(req, res);
//});

router.post('/confirm-order', async (req, res) => {
    return await placeOrder(req, res);
});

router.post('/order-confirm', async (req, res) => {
    return await placeOrder(req, res);
});

router.post('/check-item-delegation', async (req, res) => {
    let data = req.body;
    
    if (data?.product?.name && ['Grade A Shimla Apple'].includes(data.product.name)) {
	res.json({success: true});
    } else {
	res.status(400).json({success: false, error: "Delegation not present for product"});
    }
    return;
});


router.get('/block/:hash', async (req, res) => {
    return await getBlockDetails(req, res);
});

app.use(express.json());
app.use('/api/v1/cord', router);

const server = http.createServer(app);

async function main() {
    let port: number = 4001;
    if (PORT) {
       port = parseInt(PORT, 10);
    }
    await initializeCord();
    server.listen(port, () => {
        console.log(`CORD API is running at http://localhost:${port}`);
    });
}

main().catch((e) => console.log(e));
