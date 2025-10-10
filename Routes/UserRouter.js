import { Router } from "express";
import { verify } from "../middleware/verify.js";
import { GetQr } from "../Controllers/StudentFunctions.js";
import {
  ScanQr,
  Hostels,
  getMealCount,
} from "../Controllers/StaffFunctions.js";
import { SaveSubscription } from "../Controllers/PushController.js";

const router = Router();

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
router.post("/save-subscription", verify, SaveSubscription);
router.post("/getQrCode", verify, GetQr);
router.post("/scanQr", verify, ScanQr);
router.get("/hostels", verify, Hostels);
router.get("/getCount/:id", verify, getMealCount);

export default router;
