import express from "express";
import {
     addHostelRep,
     addNewBatch,
     addStudents,
} from "../Controllers/AdminFunctions.js";
import { adminCheck, verify } from "../middleware/verify.js";

const router = express.Router();

router.post("/batches", verify, adminCheck, addNewBatch);
router.post("/students/csv", verify, adminCheck, addStudents);
router.post("/students/rep", verify, adminCheck, addHostelRep);
router.delete("/students", verify, adminCheck); //to delete user by user id
router.delete("/students/:hostelid", verify, adminCheck); //to delete users from one hostel

export default router;

//to be added in frontend: addNewBatch by amdin

// POST /students

// POST /

// GET /students
// GET /students/1

// PUT /students/1 --update completely
// PATCH /students/1 --partial modification

// DELETE /students/1
