import { Router } from "express";

// import dotenv from "dotenv";
import { verify } from "../middleware/verify.js";

import {
     UserLogin,
     UserLogout,
     RefreshToken,
     GetRole,
     CreateUser,
} from "../Controllers/AuthController.js";

// dotenv.config();

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

router.post("/login", UserLogin);
router.post("/logout", UserLogout);
router.post("/create", CreateUser);
router.post("/getQrCode", verify);
router.post("/scanQr", verify);
router.get("/get-role", verify, GetRole);
router.post("/refresh-token", RefreshToken);
router.get("/hostels", verify);

export default router;
