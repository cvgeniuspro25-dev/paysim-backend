// backend/src/routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.get("/activar/:token", authController.activarCuenta);
router.post("/check-username", authController.checkUsername);
router.post("/check-dni", authController.checkDni);
router.post("/confirmar-pago", authController.confirmarPago);
router.post("/invalidar-token", authController.invalidarToken);
router.post("/recordar-usuario", authController.recordarUsuario);
router.post("/recuperar-contrasena", authController.recuperarContrasena);
router.get(
  "/validar-token-recuperacion/:token",
  authController.validarTokenRecuperacion,
);
router.post("/cambiar-contrasena", authController.cambiarContrasena);
router.post("/reenviar-activacion", authController.reenviarActivacion);
router.post("/login", authController.login);

module.exports = router;
router.post("/recordar-usuario", authController.recordarUsuario);
