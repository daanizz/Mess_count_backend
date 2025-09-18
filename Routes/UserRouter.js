// import express from "express";
// import supabase from "../Configurations/dbConnection";

// const router = express.Router();

// // --- Student API ---
// router.post("/student", async (req, res) => {
//      try {
//           const body = req.body;
//           const { data: users, error } = await console.log(
//                "Incoming body:",
//                req.body,
//           );
//           const student = await students.create(req.body);
//           res.status(201).json({ success: true, student });
//      } catch (error) {
//           console.error("Supabase error:", error);
//           res.status(400).json({ success: false, error: error.message });
//      }
// });

// // --- Admin API ---
// router.post("/admin", async (req, res) => {
//      try {
//           const admin = await AdminModel.create(req.body);
//           res.status(201).json({ success: true, admin });
//      } catch (error) {
//           res.status(400).json({ success: false, error: error.message });
//      }
// });

// // --- Staff API ---
// router.post("/staff", async (req, res) => {
//      try {
//           const staff = await StaffModel.create(req.body);
//           res.status(201).json({ success: true, staff });
//      } catch (error) {
//           res.status(400).json({ success: false, error: error.message });
//      }
// });

// // --- Hostel API ---
// router.post("/hostel", async (req, res) => {
//      try {
//           const hostel = await HostelModel.create(req.body);
//           res.status(201).json({ success: true, hostel });
//      } catch (error) {
//           res.status(400).json({ success: false, error: error.message });
//      }
// });

// export default router;
