// backend/src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

// Middleware para verificar JWT y adjuntar datos del usuario a req
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de acceso requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      tipo_cuenta: decoded.tipo_cuenta,
      rol: decoded.rol,
    };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(403).json({ error: "Token inválido" });
  }
};

// Middleware que verifica que el usuario tenga rol de administrador
// Debe usarse DESPUÉS de verificarToken
const verificarAdmin = (req, res, next) => {
  if (!req.user) {
    return res
      .status(500)
      .json({ error: "Error de configuración: req.user no definido" });
  }

  if (req.user.rol !== "admin") {
    return res
      .status(403)
      .json({ error: "Acceso denegado. Se requiere rol de administrador." });
  }

  next();
};

module.exports = { verificarToken, verificarAdmin };