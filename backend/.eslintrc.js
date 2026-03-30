module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/typescript",
    "prettier",
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    "import/order": [
      "error",
      {
        "alphabetize": { order: "asc", caseInsensitive: true },
        "newlines-between": "always",
      },
    ],
  },
};


