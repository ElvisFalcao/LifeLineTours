const path = require('path');

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT) || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'lifeline-tours-local-dev-secret-change-in-production',
  TOKEN_TTL: '12h',
  DB_PATH: process.env.DB_PATH || path.join(ROOT, 'data', 'lifeline.db'),
  PUBLIC_DIR: path.join(ROOT, 'public'),
};
