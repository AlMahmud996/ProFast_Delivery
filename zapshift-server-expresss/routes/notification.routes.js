import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";

const router = Router(); // mounted at /notifications in routes/index.js

router.use(verifyFBToken); // every notification route needs a logged-in user

router.get("/", getNotifications); // GET   /notifications
router.patch("/read-all", markAllNotificationsRead); // PATCH /notifications/read-all
router.patch("/:id/read", markNotificationRead); // PATCH /notifications/:id/read

export default router;
