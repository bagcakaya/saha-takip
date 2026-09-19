const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'SahaTakipDB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

async function getPool() {
  if (!pool) {
    try {
      console.log(`>> SQL Server bağlantısı kuruluyor (${config.server}:${config.port}/${config.database})...`);
      pool = await sql.connect(config);
      console.log('>> SQL Server bağlantısı BAŞARILI!');
      pool.on('error', (err) => {
        console.error('>> SQL Server havuz hatası:', err);
        pool = null;
      });
    } catch (err) {
      console.error('>> SQL Server bağlantı hatası:', err.message);
      pool = null;
      throw err;
    }
  }
  return pool;
}

module.exports = {
  sql,
  getPool,
};
