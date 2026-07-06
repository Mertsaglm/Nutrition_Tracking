// Monorepo-aware Metro config (Expo + npm workspaces)
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// 1. Watch the whole monorepo so changes in packages/* trigger reloads
config.watchFolders = [workspaceRoot]

// 2. Resolve modules from the app first, then the workspace root.
//    App-local resolution first keeps mobile on its own React 19 even though
//    the web app pins React 18 at the workspace root.
//    Hierarchical lookup KALIR: npm, bazı transitive bağımlılıkları (ör. expo-asset)
//    expo/node_modules altına nested kurar; Metro bunları hiyerarşik arayışla bulur.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = config
