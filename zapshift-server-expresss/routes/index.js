import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import { getUserOverview } from "../controllers/user.controller.js";
import { createPaymentIntent } from "../controllers/payment.controller.js";
import { createCashout } from "../controllers/finance.controller.js";
import userRoutes from "./user.routes.js";
import parcelRoutes from "./parcel.routes.js";
import paymentRoutes from "./payment.routes.js";
import riderRoutes from "./rider.routes.js";
import riderTaskRoutes from "./riderTask.routes.js";
import adminRoutes from "./admin.routes.js";
import notificationRoutes from "./notification.routes.js";
import trackingRoutes from "./tracking.routes.js";

const router = Router(); // one place that lists every URL group of the API

router.use("/users", userRoutes); // /users/...
router.get("/user/overview", verifyFBToken, getUserOverview); // /user/overview (user home)
router.use("/parcels", parcelRoutes); // /parcels/...
router.post("/create-payment-intent", verifyFBToken, createPaymentIntent); // Stripe PaymentIntent
router.use("/payments", paymentRoutes); // /payments/...
router.use("/riders", riderRoutes); // /riders/... (applications + admin approval)
router.use("/rider", riderTaskRoutes); // /rider/... (the rider's own tasks and money)
router.use("/admin", adminRoutes); // /admin/...
router.post("/cashouts", verifyFBToken, createCashout); // admins and riders cash out
router.use("/notifications", notificationRoutes); // /notifications/...
router.use("/tracking", trackingRoutes); // /tracking/...

export default router;
