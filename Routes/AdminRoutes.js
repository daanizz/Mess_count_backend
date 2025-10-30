import express from "express";
import { addNewBatch, addStudents } from "../Controllers/AdminFunctions.js";
import { adminCheck, verify } from "../middleware/verify.js";

const router = express.Router();

router.post("/addBatch", verify, adminCheck, addNewBatch);
router.post("/addStudentCsv", addStudents);

export default router;

// POST /students

// POST /

// GET /students
// GET /students/1

// PUT /students/1 --update completely
// PATCH /students/1 --partial modification

// DELETE /students/1
