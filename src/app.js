// backend/src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
require("dotenv").config();
// Importar conexión a base de datos
const db = require("./config/db");

// Inicializar Express
const app = express();

// ==========================================
// MIDDLEWARES DE SEGURIDAD (Nivel Bancario)
// ==========================================

// 1. Helmet: Configura cabeceras HTTP seguras
app.use(helmet());

// 2. Rate Limiting: Previene ataques de fuerza bruta (100 peticiones por IP cada 15 minutos)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 peticiones por IP
  message:
    "Demasiadas peticiones desde esta IP. Por favor, inténtelo de nuevo más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// 3. XSS-Clean: (Eliminado temporalmente por incompatibilidad con Node 24 - Protección XSS cubierta por Helmet y express-validator)
// app.use(xss());

// 4. HPP: Previene contaminación de parámetros HTTP
app.use(hpp());

// ==========================================
// MIDDLEWARES GENERALES
// ==========================================

// Habilitar CORS para el frontend en IP fija 192.168.10.12:5180
app.use(
  cors({
    origin: "http://192.168.10.12:5180",
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

// Parsear JSON entrante
app.use(express.json({ limit: "10kb" })); // Limita tamaño para prevenir ataques de denegación de servicio

// Parsear datos de formularios URL-encoded
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ==========================================
// RUTAS
// ==========================================

// Ruta de prueba para verificar que el servidor funciona
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "PaySim Backend funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});
// Ruta de prueba para verificar conexión a base de datos
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.status(200).json({
      status: "success",
      message: "Conexión a PostgreSQL exitosa",
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    console.error("Error en db-test:", error);
    res.status(500).json({
      status: "error",
      message: "Error al conectar con la base de datos",
      error: error.message,
    });
  }
});
// TODO: Aquí se montarán las rutas de los diferentes módulos
// Ejemplo: app.use('/api/v1/auth', authRoutes);
// Ejemplo: app.use('/api/v1/users', userRoutes);

// ==========================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `No se encuentra la ruta ${req.originalUrl} en este servidor`,
  });
});

// ==========================================
// EXPORTAR APP
// ==========================================
module.exports = app;
