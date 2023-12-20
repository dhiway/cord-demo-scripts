import * as Cord from "@cord.network/sdk";
import { generateKeypairs } from "./utils/generateKeypairs";
import fetch from "node-fetch";

async function main() {
  const networkAddress = "wss://confidex-alpha1.cord.network";
  Cord.ConfigService.set({ submitTxResolveOn: Cord.Chain.IS_IN_BLOCK });
  await Cord.connect(networkAddress);
  const api = Cord.ConfigService.get("api");

  console.log("\n📲  User sign-up");
  console.log("\n🆔 Creating an on-chain DID for the user\n");
  const apiUrl = "http://localhost:3000/login";

  const postData = {
    name: "John Doe",
    email: "john.doe@example.com",
  };
  let loginResponse;
  await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postData),
  })
    .then((response) => response.json())
    .then((data) => {
      loginResponse = data;
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  let networkProviderKeys = await generateKeypairs(loginResponse.userMnemonic);

  console.log(
    "✅ DID has been successfully created for the user:\n\n",
    loginResponse.did.uri,
    "\n"
  );

  console.log(`\n💠  Write Rating - (Genesis) Credit Entry `);
  let ratingContent: Cord.IRatingContent = {
    entityUid: Cord.Utils.UUID.generate(),
    entityId: "Gupta Kirana Store",
    providerUid: Cord.Utils.UUID.generate(),
    providerId: "GoFrugal",
    entityType: Cord.EntityTypeOf.retail,
    ratingType: Cord.RatingTypeOf.overall,
    countOfTxn: 100,
    totalRating: 320,
  };
  let transformedEntry = await Cord.Score.buildFromContentProperties(
    ratingContent,
    loginResponse.did.uri,
    async ({ data }) => ({
      signature: networkProviderKeys.assertionMethod.sign(data),
      keyType: networkProviderKeys.assertionMethod.type,
      keyUri: `${loginResponse.did.uri}${
        loginResponse.did.assertionMethod![0].id
      }` as Cord.DidResourceUri,
    })
  );
  console.log(`\n🌐  Rating Information to API endpoint (/write-ratings) `);
  let transformedEntryResponse;
  try {
    const endpoint = "http://localhost:3000/write-ratings";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: loginResponse.token,
      },
      body: JSON.stringify({ transformedEntry }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("\nResponse:", data);
        transformedEntryResponse = data;
        console.log("\n✅ Rating addition successful! 🎉");
      });
  } catch (error) {
    console.log(error.message);
  }

  console.log(`\n💠  Revoke Rating - Debit Entry\n`);
  const revokeInput = {
    entryUri: transformedEntryResponse.identifier,
    entityUid: transformedEntry.entry.entityUid,
  };

  console.log("revokeInput\n", revokeInput);

  const revokeRatingEntry = await Cord.Score.buildFromRevokeProperties(
    transformedEntryResponse.identifier,
    transformedEntry.entry.entityUid,
    loginResponse.did.uri,
    async ({ data }) => ({
      signature: networkProviderKeys.assertionMethod.sign(data),
      keyType: networkProviderKeys.assertionMethod.type,
      keyUri: `${loginResponse.did.uri}${
        loginResponse.did.assertionMethod![0].id
      }` as Cord.DidResourceUri,
    })
  );
  console.log(
    `\n🌐  Rating Revoke (Debit) Information to API endpoint (/amend-ratings) `
  );
  let responseRevokedEntry;
  try {
    const endpoint = "http://localhost:3000/amend-ratings";
    const headers = {
      Authorization: loginResponse.token,
      "Content-Type": "application/json",
    };
    const requestOptions = {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ revokeRatingEntry }),
    };
    await fetch(endpoint, requestOptions)
      .then((response) => response.json())
      .then((data) => {
        console.log("\nResponse:", data);
        responseRevokedEntry = data;
        console.log("\n✅ Rating Revoke (Debit) successful! 🎉");
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  } catch (error) {
    console.log(error.message);
  }

  console.log(`\n💠  Revised Rating - Credit Entry `);

  let revisedRatingContent: Cord.IRatingContent = {
    ...ratingContent,
    referenceId: responseRevokedEntry.identifier,
    countOfTxn: 80,
    totalRating: 280,
  };

  let transformedRevisedEntry = await Cord.Score.buildFromContentProperties(
    revisedRatingContent,
    loginResponse.did.uri,
    async ({ data }) => ({
      signature: networkProviderKeys.assertionMethod.sign(data),
      keyType: networkProviderKeys.assertionMethod.type,
      keyUri: `${loginResponse.did.uri}${
        loginResponse.did.assertionMethod![0].id
      }` as Cord.DidResourceUri,
    })
  );

  console.log(
    `\n🌐  Rating Revised(Credit) Information to API endpoint (/write-revised-ratings)`
  );
  let responseWriteReviserEntry;
  try {
    const endpoint = "http://localhost:3000/write-revised-ratings";
    const headers = {
      Authorization: loginResponse.token,
      "Content-Type": "application/json",
    };
    const requestOptions = {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ transformedRevisedEntry }),
    };
    await fetch(endpoint, requestOptions)
      .then((response) => response.json())
      .then((data) => {
        console.log("\nResponse:", data);
        responseWriteReviserEntry = data;
        console.log("\n✅ Rating Revision(Credit) successful! 🎉");
      })
      .catch((error) => {
        console.error("Error:", error.message);
      });
  } catch (error) {
    console.log(error.message);
  }

  console.log(`\n🌐  Query From Chain - Aggregate Score \n`);
  try {
    const endpoint =
      "http://localhost:3000/read-aggregate-score/:entityUid/:ratingType";
    const entityUid = transformedEntry.entry.entityUid;
    const ratingType = Cord.RatingTypeOf.overall;
    const headers = {
      Authorization: loginResponse.token,
    };
    const url = endpoint
      .replace(":entityUid", entityUid)
      .replace(":ratingType", ratingType);

    const requestOptions = {
      method: "GET",
      headers,
    };
    await fetch(url, requestOptions)
      .then((response) => response.json())
      .then((data) => {
        console.log("\nResponse:\n", data);
      })
      .catch((error) => {
        console.error("Error:", error.message);
      });
  } catch (error) {
    console.log(error.message);
  }

  console.log(`\n🌐  Query From Chain - Chain Space Usage `);

  try {
    const endpoint =
      "http://localhost:3000/check-chain-space-usage/:chainSpaceUri";
    const chainSpaceUri =
      "space:cord:c33moQ5s314vRAcSV4ZvWpEZAEF8xVC4gyYRCiLqnwXtKWfGp";
    const headers = {
      Authorization: loginResponse.token,
    };
    const url = endpoint.replace(":chainSpaceUri", chainSpaceUri);

    const requestOptions = {
      method: "GET",
      headers,
    };
    await fetch(url, requestOptions)
      .then((response) => response.json())
      .then((data) => {
        console.log("\nResponse:\n", data);
      })
      .catch((error) => {
        console.error("Error:", error.message);
      });
  } catch (error) {
    console.log(error.message);
  }

  console.log(`\n🌐 Fetch the rating details from chian `);
  try {
    const endpoint =
      "http://localhost:3000/fetch-rating-details-from-chain/:ratingUri";
    const ratingUri =
      "rating:cord:r339dTUhkUVsQTwDaY6jVSzWafyvbHZ7aK9epbWwgkbUNeMWE";
    const headers = {
      Authorization: loginResponse.token,
    };
    const url = endpoint.replace(":ratingUri", ratingUri);

    const requestOptions = {
      method: "GET",
      headers,
    };
    await fetch(url, requestOptions)
      .then((response) => response.json())
      .then((data) => {
        console.log("\nResponse:\n", data);
      })
      .catch((error) => {
        console.error("Error:", error.message);
      });
  } catch (error) {
    console.log(error.message);
  }
}

main()
  .then(() => console.log("\nBye! 👋 👋 👋 "))
  .finally(Cord.disconnect);

process.on("SIGINT", async () => {
  console.log("\nBye! 👋 👋 👋 \n");
  Cord.disconnect();
  process.exit(0);
});
