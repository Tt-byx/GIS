module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  globals: {
    // Leaflet 与 MapGIS 客户端库经 index.html 全局引入（AR-19：第三方库必须放 public/libs/）
    L: 'readonly',
    zondy: 'readonly',
  },
  extends: ['eslint:recommended', 'plugin:vue/vue3-essential'],
  rules: {
    // C-05：禁用 var；C-06：严格相等
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    // C-13：生产代码禁止 console.log（warn/error 用于异常路径）
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
}
