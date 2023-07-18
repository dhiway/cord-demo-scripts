# Cord transaction anchoring scripts (for demonstration purposes)

## Requirements

* You are expected to have [`docker`](https://www.docker.com/) available to run the cord.network locally with developer mode.
* Have [`yarn`](https://yarnpkg.com/) installed and ready.
* Any web browser (which supports javascript) to check transactions on the CORD Chain.

## How to run the demo code with DOCKER

* Step 1: checkout/clone this repository.

* Step 2: build image locally 
```sh
   sudo docker build -t <docker-image-name> .
```
* Step 3: run `docker`
  i) Run demo on sparknet node
```sh
      sudo docker run <docker-image-name>
```

  ii) Run demo on custom node
```sh 
     sudo docker run --env NETWORK_ADDRESS='wss://sparknet.cord.network' --env ANCHOR_URI='//Sparknet//1//Demo' <docker-image-name>`
```
  -  Here values of `NETWORK_ADDRESS` and `ANCHOR_URI` can be changed according to your use case.

## How to run the demo code (with local node)

* Step 1: checkout/clone this repository.

* Step 2: install with `yarn install` once you are inside the repository.

* Step 3: start the CORD Network in the developer mode (In another terminal)
  - `docker run --network host dhiway/cord:develop --dev`
  - Note that this exposes ports 9933/9944/30333
  - You can watch the events and blocks finalization @ https://apps.cord.network/?rpc=ws%3A%2F%2F127.0.0.1%3A9944#/explorer

* Step 4: run the demo script with `yarn demo`. Understand whats happening by checking the code at `src/demo.ts`.

* Step 5: run the VC (Verifiable Credential) demo script by running `yarn demo-vc`.


## How to run the demo code (with staging network)

* Step 1: checkout/clone this repository.

* Step 2: install with `yarn install` once you are inside the repository.

* Step 3: You can watch the events and blocks finalization @ https://apps.cord.network/?rpc=wss%3A%2F%2Fstaging.cord.network#/explorer

* Step 4: Open the demo file you want to run (eg., `src/demo.ts`) and change `ws://127.0.0.1:9944` to `wss://staging.cord.network`. Save the file.

* Step 5: run the demo script with `yarn demo`. Understand whats happening by checking the code at `src/demo.ts`.

* Step 6: run the VC (Verifiable Credential) demo script by running `yarn demo-vc`.

  - NOTE: The VerifiableCredential is a required form of output if your application wants to interact with other applications. If one needs to have complete eco-system in their control, just the stream format of CORD SDK is good enough.


## What next from here?

* Understand the methods exposed from SDK by refering how `demo.ts` and `demo-vc.ts` files are structured.

* You can refer our white paper for multiple usecases through https://cord.network

* To build on CORD chain, visit [cord project repo](https://github.com/dhiway/cord).
  - SDK development work is happening at [CORD.js repository](https://github.com/dhiway/cord.js)
  - SUBQL (Substrate's GraphQL update, which can help in organizing events and extrinsics happening on CORD chain) - [Repository](https://github.com/dhiway/cord-subql)

* Reach out to CORD community by joining [Discord](https://discord.gg/V8AqufZu)

