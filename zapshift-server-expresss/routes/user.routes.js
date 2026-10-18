import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import { createUser, getUserRole, getMyProfile, updateMyProfile } from "../controllers/user.controller.js";

const router = Router(); // mounted at /users in routes/index.js

router.post("/", createUser); // POST  /users       (register / Google login)
router.get("/role", verifyFBToken, getUserRole); // GET   /users/role
router.get("/me", verifyFBToken, getMyProfile); // GET   /users/me
router.patch("/me", verifyFBToken, updateMyProfile); // PATCH /users/me

export default router;
