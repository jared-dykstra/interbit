const {
  coreCovenant: {
    actionCreators: { authorizeReceiveActions, authorizeSendActions }
  },
  constants: { JOIN_TYPES },
  manifest: {
    selectors: { getChainIdByAlias, getChains, getJoinsByAlias }
  }
} = require('interbit-covenant-tools')
const log = require('../log')

/**
 * Initializes the `SET_MANIFEST` write joins for the network of chains
 * if these are new chains that have never been configured before.
 * @param {Object} cli - The Interbit node interface.
 * @param {Object} manifest - The Interbit manifest file as JSON.
 */
const initializeJoins = async (cli, manifest) => {
  log.info('INITIALZING JOINS...')
  // Get all the chains for this manifest from the cli
  const chainEntries = Object.entries(getChains(manifest))
  let dispatchPromises = []
  for (const [chainAlias, chainId] of chainEntries) {
    const chainInterface = cli.getChain(chainId)

    // If there is a manifest set the chain has been deployed before
    const state = chainInterface.getState()
    if (state.manifest) {
      return
    }

    log.info(`... chain ${chainAlias} did not have a manifest... initializing`)
    const sendPromises = initializeSendJoins(
      chainAlias,
      chainInterface,
      manifest
    )
    const receivePromises = initializeReceiveJoins(
      chainAlias,
      chainInterface,
      manifest
    )

    dispatchPromises = [...sendPromises, ...receivePromises]
  }

  await Promise.all(dispatchPromises)
}

const initializeSendJoins = async (chainAlias, chainInterface, manifest) => {
  const joins = getJoinsByAlias(chainAlias, manifest)
  log.info(JSON.stringify(joins, null, 2))
  const sendJoins = joins[JOIN_TYPES.SEND]
  log.info(JSON.stringify(sendJoins, null, 2))

  const dispatchPromises = []
  for (const sendJoin of sendJoins) {
    const receiverChainId = getChainIdByAlias(sendJoin.alias, manifest)
    const sendAction = authorizeSendActions({
      receiverChainId
    })
    const dispatchPromise = chainInterface.dispatch(sendAction)
    dispatchPromises.push(dispatchPromise)
  }

  await Promise.all(dispatchPromises)
}

const initializeReceiveJoins = async (chainAlias, chainInterface, manifest) => {
  const joins = getJoinsByAlias(chainAlias, manifest)
  log.info(JSON.stringify(joins, null, 2))
  const receiveManifestJoins = joins[JOIN_TYPES.RECEIVE].filter(
    join =>
      join.authorizedActions.length === 1 &&
      join.authorizedActions[0] === '@@MANIFEST/SET_MANIFEST'
  )
  log.info(JSON.stringify(receiveManifestJoins, null, 2))

  const dispatchPromises = []
  for (const receiveManifestJoin of receiveManifestJoins) {
    const senderChainId = getChainIdByAlias(
      receiveManifestJoin.chainAlias,
      manifest
    )
    const receiveAction = authorizeReceiveActions({
      senderChainId,
      permittedActions: receiveManifestJoins.authorizedActions
    })
    const dispatchPromise = chainInterface.dispatch(receiveAction)
    dispatchPromises.push(dispatchPromise)
  }

  await Promise.all(dispatchPromises)
}

module.exports = initializeJoins