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

module.exports = router;
