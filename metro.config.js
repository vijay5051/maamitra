// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix: zustand's ESM files (*.mjs) use `import.meta.env` which is invalid
// in Metro's non-module web bundle. We redirect those imports to the CJS
// equivalents which use process.env instead.
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Redirect zustand ESM imports to CJS on web
    if (platform === 'web') {
      if (moduleName === 'zustand/middleware') {
        return {
          filePath: path.resolve(__dirname, 'node_modules/zustand/middleware.js'),
          type: 'sourceFile',
        };
      }
      if (moduleName === 'zustand/react') {
        return {
          filePath: path.resolve(__dirname, 'node_modules/zustand/react.js'),
          type: 'sourceFile',
        };
      }
      if (moduleName === 'zustand' || moduleName === 'zustand/index') {
        return {
          filePath: path.resolve(__dirname, 'node_modules/zustand/index.js'),
          type: 'sourceFile',
        };
      }
    }
    // Fall back to default resolution for everything else
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
