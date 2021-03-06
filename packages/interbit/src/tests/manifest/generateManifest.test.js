const should = require('should')
const {
  constants: { ROOT_CHAIN_ALIAS }
} = require('interbit-covenant-tools')

const hashObject = require('../../manifest/hash')
const { generateManifest } = require('../../manifest/generateManifest')
const {
  defaultConfig,
  defaultManifest,
  defaultCovenants
} = require('../testData')

const location = '/tmp'

describe('generateManifest(location, interbitConfig, covenants, originalManifest)', () => {
  it('generates a verifiable manifest hash for all levels', () => {
    const manifest = generateManifest(
      location,
      defaultConfig,
      defaultCovenants,
      defaultManifest
    )

    const hash = manifest.hash
    delete manifest.hash
    const compareHash = hashObject(manifest)
    should.equal(hash, compareHash)

    const rootHash = manifest.manifest.interbitRoot.hash
    delete manifest.manifest.interbitRoot.hash
    const compareRootHash = hashObject(manifest.manifest.interbitRoot)
    should.equal(rootHash, compareRootHash)

    const publicHash = manifest.manifest.interbitRoot.chains.public.hash
    delete manifest.manifest.interbitRoot.chains.public.hash
    const comparePublicHash = hashObject(
      manifest.manifest.interbitRoot.chains.public
    )
    should.equal(publicHash, comparePublicHash)

    const controlHash = manifest.manifest.interbitRoot.chains.control.hash
    delete manifest.manifest.interbitRoot.chains.control.hash
    const compareControlHash = hashObject(
      manifest.manifest.interbitRoot.chains.control
    )
    should.equal(controlHash, compareControlHash)
  })

  it('replaces apps config but not genesis blocks if apps config changes', () => {
    const apps = {
      ...defaultConfig.apps,
      newApp: {
        peers: ['meowmeowmeow.com'],
        chains: ['control'],
        appChain: 'control',
        indexLocation: 'public/index.html',
        buildLocation: 'build/'
      }
    }
    const config = {
      ...defaultConfig,
      apps
    }
    const manifest = generateManifest(
      location,
      config,
      defaultCovenants,
      defaultManifest
    )

    should.ok(manifest.apps.newApp)
    should.ok(manifest.apps.newApp.buildLocation)
    should.equal(manifest.apps.newApp.appChain, apps.newApp.appChain)
    should.deepEqual(manifest.apps.newApp.browserChains, apps.newApp.chains)
    should.deepEqual(manifest.genesisBlocks, defaultManifest.genesisBlocks)
  })

  it('replaces peers list but not genesis blocks if just the peers list has changed', () => {
    const peers = ['meowmeowmeow.com', 'baobaobao.com']
    const config = {
      ...defaultConfig,
      peers
    }
    const manifest = generateManifest(
      location,
      config,
      defaultCovenants,
      defaultManifest
    )

    should.deepEqual(peers, manifest.peers)
    should.deepEqual(manifest.genesisBlocks, defaultManifest.genesisBlocks)
  })

  it('replaces covenants but not genesis blocks if only covenants have changed', () => {
    const covenants = {
      ...defaultCovenants,
      public: {
        hash: 'meowmeowmeowmeowmeowmeow',
        filename: 'newCovenantFilename/meowmeowmeowmeowmeowmeow.tgz'
      }
    }
    const manifest = generateManifest(
      location,
      defaultConfig,
      covenants,
      defaultManifest
    )

    should.deepEqual(covenants, manifest.covenants)
    should.deepEqual(manifest.genesisBlocks, defaultManifest.genesisBlocks)
  })

  it('throws when there is no adult present to cascade manifest changes', () => {
    const config = {
      ...defaultConfig,
      staticChains: {
        public: {
          ...defaultConfig.staticChains.public,
          childChains: ['control']
        },
        control: {
          ...defaultConfig.staticChains.control,
          childChains: ['public']
        }
      }
    }

    should(() => {
      generateManifest(location, config, defaultCovenants)
    }).throw(
      /Config contains malformed childChains structure. ChildChains must form one or many trees when constructed./
    )
  })

  it('throws when there is a cycle and an unattached chain', () => {
    const config = {
      ...defaultConfig,
      staticChains: {
        public: {
          ...defaultConfig.staticChains.public,
          childChains: ['control']
        },
        control: {
          ...defaultConfig.staticChains.control,
          childChains: ['public']
        },
        unattached: {
          ...defaultConfig.staticChains.control,
          config: {
            ...defaultConfig.staticChains.control.config,
            joins: {}
          },
          childChains: ['public']
        }
      }
    }

    should(() => {
      generateManifest(location, config, defaultCovenants)
    }).throw(
      /Config contains malformed childChains structure and must form one or many trees. "public" was referenced twice./
    )
  })

  it('forms a tree structure based on childChains', () => {
    const config = {
      ...defaultConfig,
      staticChains: {
        control: {
          ...defaultConfig.staticChains.control,
          childChains: ['public']
        },
        public: {
          ...defaultConfig.staticChains.public,
          childChains: ['grandchild']
        },
        grandchild: {
          ...defaultConfig.staticChains.public,
          config: {
            ...defaultConfig.staticChains.control.config,
            joins: {}
          }
        }
      }
    }

    const manifest = generateManifest(location, config, defaultCovenants)

    should.ok(manifest.manifest)
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS])
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS].chains.control)
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS].chains.control.chains.public)
    should.ok(
      manifest.manifest[ROOT_CHAIN_ALIAS].chains.control.chains.public.chains
        .grandchild
    )
  })

  it('makes unattached static chains children of the root', () => {
    const manifest = generateManifest(location, defaultConfig, defaultCovenants)

    should.ok(manifest.manifest)
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS])
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS].chains.control)
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS].chains.public)
  })

  it('includes necessary configuration data in manifest tree', () => {
    const manifest = generateManifest(location, defaultConfig, defaultCovenants)

    should.ok(manifest.manifest)
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS])

    const rootChain = manifest.manifest[ROOT_CHAIN_ALIAS]
    should.ok(rootChain)
    should.ok(rootChain.alias)
    should.ok(rootChain.chainId)
    should.ok(rootChain.chainIdMap)
    should.ok(rootChain.chainIdMap.control)
    should.ok(rootChain.chainIdMap.public)
    should.ok(rootChain.validators)
    should.ok(rootChain.covenant)
    should.ok(rootChain.covenantHashMap)
    should.equal(
      rootChain.covenantHashMap.interbitRoot,
      manifest.covenants.interbitRoot.hash
    )
    should.equal(
      rootChain.covenantHashMap.control,
      manifest.covenants.control.hash
    )
    should.equal(
      rootChain.covenantHashMap.public,
      manifest.covenants.public.hash
    )
    should.ok(rootChain.joins)
    should.ok(rootChain.chains)
    // should.ok(rootChain.acl)

    const controlChain = rootChain.chains.control
    should.ok(controlChain)
    should.ok(controlChain.alias)
    should.ok(controlChain.chainId)
    should.ok(controlChain.chainIdMap)
    should.ok(controlChain.chainIdMap.public)
    should.ok(controlChain.chainIdMap.interbitRoot)
    should.ok(controlChain.validators)
    should.ok(controlChain.covenant)
    should.ok(controlChain.covenantHashMap)
    should.equal(
      controlChain.covenantHashMap.control,
      manifest.covenants.control.hash
    )
    should.ok(controlChain.joins)
    should.ok(controlChain.chains)
    // should.ok(controlChain.acl)
  })

  it('creates a write join from parent to child authorizing the SET_MANIFEST action', () => {
    const config = {
      ...defaultConfig,
      staticChains: {
        control: {
          ...defaultConfig.staticChains.control,
          childChains: ['public']
        },
        public: {
          ...defaultConfig.staticChains.public
        }
      }
    }

    const manifest = generateManifest(location, config, defaultCovenants)

    should.ok(manifest.manifest)
    should.ok(manifest.manifest[ROOT_CHAIN_ALIAS])

    const rootJoins = manifest.manifest[ROOT_CHAIN_ALIAS].joins
    should.ok(rootJoins)
    should.ok(rootJoins.sendActionTo)
    should.equal(rootJoins.sendActionTo[0].alias, 'control')

    const controlChain = manifest.manifest[ROOT_CHAIN_ALIAS].chains.control
    should.ok(controlChain)

    const controlJoins = controlChain.joins
    should.ok(controlJoins)
    should.ok(controlJoins.sendActionTo)
    should.equal(controlJoins.sendActionTo[0].alias, 'public')
    should.ok(controlJoins.receiveActionFrom)
    should.equal(controlJoins.receiveActionFrom[0].alias, ROOT_CHAIN_ALIAS)
    should.deepEqual(controlJoins.receiveActionFrom[0].authorizedActions, [
      '@@MANIFEST/SET_MANIFEST'
    ])

    const publicChain = controlChain.chains.public
    should.ok(publicChain)

    const publicJoins = publicChain.joins
    should.ok(publicJoins)
    should.ok(publicJoins.receiveActionFrom)
    should.equal(publicJoins.receiveActionFrom[0].alias, 'control')
    should.deepEqual(publicJoins.receiveActionFrom[0].authorizedActions, [
      '@@MANIFEST/SET_MANIFEST'
    ])
  })
})
