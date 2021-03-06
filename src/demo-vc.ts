import * as Cord from '@cord.network/sdk'
import { UUID } from '@cord.network/utils'
import type { VerifiableCredential } from '@cord.network/vc-export/src/types.js'
import * as VCUtils from '@cord.network/vc-export'

async function main() {
  await Cord.init({ address: 'ws://127.0.0.1:9944' })

  // Step 1: Setup Org Identity
  console.log(`\nāļø  Demo Identities (KeyRing)`)
  //3x4DHc1rxVAEqKWSx1DAAA8wZxLB4VhiRbMV997niBckUwSi
  const entityIdentity = Cord.Identity.buildFromURI('//Bob', {
    signingKeyPairType: 'sr25519',
  })
  console.log(
    `š  Entity (${entityIdentity.signingKeyType}): ${entityIdentity.address}`
  )
  const employeeIdentity = Cord.Identity.buildFromURI('//Dave', {
    signingKeyPairType: 'sr25519',
  })
  console.log(
    `š§š»āš¼ Employee (${employeeIdentity.signingKeyType}): ${employeeIdentity.address}`
  )
  const holderIdentity = Cord.Identity.buildFromURI('//Alice', {
    signingKeyPairType: 'sr25519',
  })
  console.log(
    `š©āāļø Holder (${holderIdentity.signingKeyType}): ${holderIdentity.address}`
  )
  const verifierIdentity = Cord.Identity.buildFromURI('//Charlie', {
    signingKeyPairType: 'ed25519',
  })
  console.log(
    `š¢ Verifier (${verifierIdentity.signingKeyType}): ${verifierIdentity.address}`
  )
  console.log('ā Identities created!')

  // Step 2: Create a new Space
  console.log(`\nāļø  Space Creation `)
  let spaceContent = {
    title: 'Demo Space',
    description: 'Space for demo',
  }
  let spaceTitle = spaceContent.title + ':' + UUID.generate()
  spaceContent.title = spaceTitle

  let newSpace = Cord.Space.fromSpaceProperties(spaceContent, employeeIdentity)
  let spaceCreationExtrinsic = await Cord.Space.create(newSpace)

  try {
    await Cord.Chain.signAndSubmitTx(spaceCreationExtrinsic, entityIdentity, {
      resolveOn: Cord.Chain.IS_IN_BLOCK,
      rejectOn: Cord.Chain.IS_ERROR,
    })
    console.log(`ā ${newSpace.identifier} created!`)
  } catch (e: any) {
    console.log(e.errorCode, '-', e.message)
  }

  // Step 3: Create a new Schema
  console.log(`\nāļø  Schema Creation `)
  console.log(`š ${newSpace.identifier}`)
  let newSchemaContent = require('../res/schema.json')
  let newSchemaTitle = newSchemaContent.title + ':' + UUID.generate()
  newSchemaContent.title = newSchemaTitle

  let newSchema = Cord.Schema.fromSchemaProperties(
    newSchemaContent,
    employeeIdentity,
    newSpace.identifier
  )

  let schemaCreationExtrinsic = await Cord.Schema.create(newSchema)

  try {
    await Cord.Chain.signAndSubmitTx(schemaCreationExtrinsic, entityIdentity, {
      resolveOn: Cord.Chain.IS_IN_BLOCK,
      rejectOn: Cord.Chain.IS_ERROR,
    })
    console.log(`ā ${newSchema.identifier} created!`)
  } catch (e: any) {
    console.log(e.errorCode, '-', e.message)
  }

  // Step 4: Create a new Stream
  console.log(`\nāļø  Stream Creation `)
  console.log(`š ${newSpace.identifier} `)
  console.log(`š ${newSchema.identifier} `)

  const content = {
    name: 'Alice',
    age: 29,
    gender: 'Female',
    country: 'India',
    credit: 1000,
  }
  let schemaStream = Cord.Content.fromSchemaAndContent(
    newSchema,
    content,
    employeeIdentity.address,
    holderIdentity.address
  )
  console.dir(schemaStream, { depth: null, colors: true })

  let newStreamContent = Cord.ContentStream.fromContent(
    schemaStream,
    employeeIdentity,
    { space: newSpace.identifier }
  )
  console.dir(newStreamContent, { depth: null, colors: true })

  let newStream = Cord.Stream.fromContentStream(newStreamContent)

  let streamCreationExtrinsic = await Cord.Stream.create(newStream)
  console.dir(newStream, { depth: null, colors: true })

  try {
    await Cord.Chain.signAndSubmitTx(streamCreationExtrinsic, entityIdentity, {
      resolveOn: Cord.Chain.IS_IN_BLOCK,
      rejectOn: Cord.Chain.IS_ERROR,
    })
    console.log('ā Stream created!')
  } catch (e: any) {
    console.log(e.errorCode, '-', e.message)
  }

  // Step 5: Verifiable Credential & Presentation
  console.log(`\nāļø  Verifiable Credentials & Presentation `)
  console.log(`š  ${newStream.identifier} `)
  const stream = await Cord.Stream.query(newStream.identifier)

  let credential: Cord.ICredential
  if (!stream) {
    console.log(`Stream not anchored on CORD`)
  } else {
    credential = Cord.Credential.fromRequestAndStream(newStreamContent, stream)
    const VC = VCUtils.fromCredential(credential, newSchema)
    console.dir(VC, { depth: null, colors: true })
    console.log('ā Verifiable Credential created!')

    console.log(`\nāļø  Verifiable Presentation - Selective Disclosure `)
    const sharedCredential = JSON.parse(JSON.stringify(VC))
    const vcChallenge = UUID.generate()
    const vcPresentation = await VCUtils.presentation.makePresentation(
      sharedCredential,
      ['name', 'country'],
      holderIdentity,
      vcChallenge
    )
    console.dir(vcPresentation, { depth: null, colors: true })
    console.log('ā Verifiable Presentation created!')

    console.log(`\nāļø  Verifiy Presentation`)

    const VCfromPresentation =
      vcPresentation.verifiableCredential as VerifiableCredential

    const streamSignatureResult =
      await VCUtils.verification.verifyStreamSignatureProof(
        VCfromPresentation,
        VCfromPresentation.proof[0]
      )
    const streamResult = await VCUtils.verification.verifyStreamProof(
      VCfromPresentation,
      VCfromPresentation.proof[1]
    )

    const digestResult = await VCUtils.verification.verifyCredentialDigestProof(
      VCfromPresentation,
      VCfromPresentation.proof[2]
    )
    const selfSignatureResult =
      await VCUtils.verification.verifySelfSignatureProof(
        VCfromPresentation,
        vcPresentation.proof[0],
        vcChallenge
      )

    if (
      streamResult &&
      streamResult['verified'] &&
      digestResult &&
      digestResult['verified'] &&
      streamSignatureResult &&
      streamSignatureResult['verified'] &&
      selfSignatureResult &&
      selfSignatureResult['verified']
    ) {
      console.log(
        'ā',
        'Stream-Signature-Proof',
        streamSignatureResult['verified'],
        'ā§ Stream-Proof',
        streamResult['verified'],
        'ā§ Digest-Proof',
        digestResult['verified'],
        'ā§ Self-Signature-Proof',
        selfSignatureResult['verified']
      )
    } else {
      console.log(
        `ā`,
        'Stream-Signature-Proof',
        streamSignatureResult['verified'],
        'ā§ Stream-Proof',
        streamResult['verified'],
        'ā§ Digest-Proof',
        digestResult['verified'],
        'ā§ Self-Signature-Proof',
        selfSignatureResult['verified']
      )
    }
  }
}
main()
  .then(() => console.log('\nBye! š š š '))
  .finally(Cord.disconnect)

process.on('SIGINT', async () => {
  console.log('\nBye! š š š \n')
  Cord.disconnect()
  process.exit(0)
})
