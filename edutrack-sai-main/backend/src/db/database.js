const env = process.env.DATABASE_URL;

if (env) {
  module.exports = require('./database-postgresql');
} else {
  module.exports = require('./database-sqlite');
}
