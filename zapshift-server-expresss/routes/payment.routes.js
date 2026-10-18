import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import { savePayment, getMyPayments } from "../controllers/payment.controller.js";

const router = Router(); // mounted at /payments in routes/index.js

router.post("/", verifyFBToken, savePayment); // POST /payments
router.get("/", verifyFBToken, getMyPayments); // GET  /payments

export default router;
