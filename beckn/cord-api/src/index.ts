const fs = require('fs');
const os = require('os');

import express from 'express';
import http from 'http';

import { initializeCord, getBlockDetails, itemCreate, itemDelegate, itemAdd, orderConfirm } from './cord';

const {
    PORT,
} = process.env;

const app = express();
let router = express.Router({ mergeParams: true });

router.post('/item_create', async (req, res) => {
    return await itemCreate(req, res);
});

router.post('/item_delegate', async (req, res) => {
    return await itemDelegate(req, res);
});

router.post('/item_add', async (req, res) => {
    return await itemAdd(req, res);
});

router.post('/order_confirm', async (req, res) => {
    return await orderConfirm(req, res);
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
