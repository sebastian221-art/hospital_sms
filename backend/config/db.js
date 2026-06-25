const mysql = require('mysql2');

let db;

try {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'recordatorios_db',
    waitForConnections: false,
    connectionLimit: 10,
    queueLimit: 0
  });

  db = pool.promise();
  console.warn('⚠️ MySQL configurado - sin conexión activa');
} catch(err) {
  console.warn('⚠️ MySQL no disponible:', err.message);
  // Mock db para que el servidor no crashee
  db = {
    query: async () => [[], []],
    execute: async () => [[], []],
    getConnection: async () => { throw new Error('Sin BD'); }
  };
}

module.exports = db;