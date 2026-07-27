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

// 3. Pin React to a SINGLE copy (the app-local React 19).
//    react-native@0.81 is hoisted to the workspace root, so its internal
//    require('react') otherwise resolves the web app's React 18 that is also
//    hoisted there. Two React copies → the Fabric renderer reads React 18's
//    ReactSharedInternals (no `.S`) and crashes with:
//      "Cannot read property 'S' of undefined".
//    Forcing every `react` / `react/*` request to the pinned copy keeps the
//    renderer and the app on the same React 19.
const reactRoot = path.resolve(projectRoot, 'node_modules/react')

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subpath = moduleName.slice('react'.length) // '' | '/jsx-runtime' | ...
    return context.resolveRequest(context, reactRoot + subpath, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
