// backend/server.js
const dotenv = require('dotenv');

// Cargar variables de entorno ANTES de importar la app
dotenv.config({ path: './.env' });

const app = require('./src/app');

// Obtener el puerto desde las variables de entorno o usar 5000 por defecto
const PORT = process.env.PORT || 5000;

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor PaySim corriendo en http://192.168.10.12:${PORT}`);
  console.log(`📡 Health check disponible en http://192.168.10.12:${PORT}/api/health`);
});

// Manejo de errores no capturados (Seguridad bancaria)
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! Apagando servidor...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! Apagando servidor...');
  console.error(err.name, err.message);
  process.exit(1);
});