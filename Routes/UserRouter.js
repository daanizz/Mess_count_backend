import supabase from "../Configurations/dbConnection.js";
import { Router } from "express";
import csvtojson from "csvtojson";
import multer, { memoryStorage } from "multer";
import { Readable } from "stream";

const router = Router();
const uploads = multer({ storage: multer.memoryStorage() });

router.post("/student", async (req, res) => {});
// (name, email);
// password_hash;
// role;
// (admission_no, student_qr);
// hostel_id
export default router;
