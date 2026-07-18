module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }],
    ],
    plugins: [
      // Reanimated 4: worklets eklentisi kanonik yoldur (reanimated/plugin buna re-export'tur).
      'react-native-worklets/plugin',
    ],
  };
};
