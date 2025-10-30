import { Router } from "express";

import dotenv from "dotenv";
import { verify } from "../middleware/verify.js";

import {
     UserLogin,
     UserLogout,
     RefreshToken,
     GetRole,
     CreateUser,
} from "../Controllers/AuthController.js";
import { getQr } from "../Controllers/StudentFunctions.js";
import { hostels, scanQr } from "../Controllers/StaffFunctions.js";

dotenv.config();

const router = Router();

// const VALID_ROLES = Object.freeze([
//      "STUDENT",
//      "ADMIN",
//      "SUPER_ADMIN",
//      "MESS_STAFF",
// ]);

// router.use((req, res, next) => {
//      res.setHeader("Cache-Control", "no-store");
//      res.setHeader("X-Content-Type-Options", "nosniff");
//      res.setHeader("X-Frame-Options", "DENY");
//      res.setHeader(
//           "Strict-Transport-Security",
//           "max-age=31536000; includeSubDomains",
//      );
//      next();
// });
router.get("/vapid-public-key", (req, res) => {
     res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});
router.post("/login", UserLogin);
router.post("/logout", UserLogout);
router.post("/create", CreateUser);
router.post("/getQrCode", verify, getQr);
router.post("/scanQr", verify, scanQr);
router.get("/get-role", verify, GetRole);
router.post("/refresh-token", RefreshToken);
router.get("/hostels", verify, hostels);

export default router;
