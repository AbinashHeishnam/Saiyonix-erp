module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@saiyonix/api": "./packages/api",
            "@saiyonix/auth": "./packages/auth",
            "@saiyonix/types": "./packages/types",
            "@saiyonix/ui": "./packages/ui",
            "@saiyonix/utils": "./packages/utils"
          }
        }
      ]
    ]
  };
};
