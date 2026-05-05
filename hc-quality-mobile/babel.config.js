module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    // Nativewind v4: transforms className prop to StyleSheet-compatible styles
    // Must be last in the plugins array
    'nativewind/babel',
  ],
};
