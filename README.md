# Cord transaction anchoring scripts (for demonstration purposes)

## Requirements

* You are expected to have [`docker`](https://www.docker.com/) available to run the cord.network locally with developer mode.
* Have [`yarn`](https://yarnpkg.com/) installed and ready.
* Any web browser (which supports javascript) to check transactions on the CORD Chain.

## How to run the demo code

* Step 1: checkout/clone this repository.

* Step 2: install with `yarn install` once you are inside the repository.

* Step 3: start the CORD Network in the developer mode.
  - `docker run --network host dhiway/cord:develop --dev`
  - Note that this exposes ports 9933/9944/30333

* Step 4: run the demo script with `yarn demo`. Understand whats happening by checking the code at `src/demo.ts`.

* Step 5: run the VC (Verifiable Credential) demo script by running `yarn demo-vc`.


## What next from here?

* Understand the methods exposed from SDK by refering how `demo.ts` and `demo-vc.ts` files are structured.

* You can refer our white paper for multiple usecases through https://cord.network

* To build on CORD chain, visit [cord project repo](https://github.com/dhiway/cord).

* Reach out to CORD community by joining [Discord](https://discord.gg/V8AqufZu)

