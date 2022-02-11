const fs = require('fs');
const os = require('os');

import express from 'express';
import http from 'http';

import { initializeCord, registerProduct } from './cord';

const {
    PORT,
} = process.env;

const app = express();
let router = express.Router({ mergeParams: true });


router.post('/register-product', async (req, res) => {
    return await registerProduct(req, res);
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
