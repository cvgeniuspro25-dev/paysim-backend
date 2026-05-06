// backend/src/config/db.js
const { Pool } = require("pg");
require("dotenv").config({ path: "./.env" });

// Determinar si estamos en Railway (producción) o en local
const isProduction = process.env.NODE_ENV === "production";

// Configuración de conexión
const pool = new Pool(
  isProduction
    ? {
        // Railway inyecta DATABASE_URL automáticamente
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        // Desarrollo local
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "paysim_db",
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
);

// Probar conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Error al conectar a PostgreSQL:", err.stack);
  } else {
    console.log("✅ Conectado a PostgreSQL correctamente");
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
