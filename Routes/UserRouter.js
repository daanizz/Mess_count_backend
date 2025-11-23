import { Router } from "express";
import { verify } from "../middleware/verify.js";
import {
  createPoll,
  getQr,
  makeVote,
  viewCurrentPolls,
  getUserVotes,
} from "../Controllers/StudentFunctions.js";
import {
  scanQr,
  hostels,
  getMealCount,
} from "../Controllers/StaffFunctions.js";
import { SaveSubscription } from "../Controllers/PushController.js";

const router = Router();

router.post("/save-subscription", verify, SaveSubscription);
router.post("/qrcode", verify, getQr);
router.post("/scan-qr", verify, scanQr);
router.get("/hostels", verify, hostels);
router.get("/count/:id", verify, getMealCount);

router.post("/polls", verify, createPoll);
router.post("/getpolls", verify, viewCurrentPolls);
router.post("/polls/vote", verify, makeVote);
router.get("/myvotes", verify, getUserVotes);
router.post("/addpolls", verify, createPoll);
// router.get("/mymeals", verify, MyMeals);

export default router;
