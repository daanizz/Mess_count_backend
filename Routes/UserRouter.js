import { Router } from "express";
import { verify } from "../middleware/verify.js";
import {
  createPoll,
  getQr,
  makeVote,
  MyMeals,
  viewCurrentPolls,
} from "../Controllers/StudentFunctions.js";
import {
  scanQr,
  hostels,
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
router.post("/qrcode", verify, getQr);
router.post("/scan-qr", verify, scanQr);
router.get("/hostels", verify, hostels);
router.get("/count/:id", verify, getMealCount);
router.post("/polls", verify, createPoll);
router.get("/mymeals", verify, MyMeals);
router.get("/vote", verify, makeVote);
router.get("/polls", verify, viewCurrentPolls);
export default router;
