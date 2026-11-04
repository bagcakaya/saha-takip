const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'SahaTakipDB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  connectionTimeout: 15000,
  requestTimeout: 30000,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 20,
    min: 1,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;
let connectingPromise = null;

async function getPool() {
  if (pool && pool.connected) {
    return pool;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      if (pool) {
        try {
          await pool.close();
        } catch {
          // ignore close error on stale pool
        }
        pool = null;
      }

      console.log(`>> SQL Server bağlantısı kuruluyor (${config.server}:${config.port}/${config.database})...`);
      const newPool = new sql.ConnectionPool(config);
      newPool.on('error', (err) => {
        console.error('>> SQL Server havuz hatası:', err?.message || err);
        pool = null;
      });
      await newPool.connect();
      pool = newPool;
      console.log('>> SQL Server bağlantısı BAŞARILI!');
      return pool;
    } catch (err) {
      console.error('>> SQL Server bağlantı hatası:', err.message);
      pool = null;
      throw err;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

module.exports = {
  sql,
  getPool,
};
