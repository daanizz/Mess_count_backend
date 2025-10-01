import supabase from "../Configurations/dbConnection.js";
import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import QRCode from "qrcode";
import path from "path";
import CryptoJS from "crypto-js";
import { verify } from "../middleware/verify.js";

dotenv.config();

const router = Router();
router.use((req, res, next) => {
     res.setHeader("Cache-Control", "no-store");
     next();
});

router.post("/login", async (req, res) => {
     try {
          const { email, password } = req.body;
          if (!email || !password) {
               return res
                    .status(400)
                    .json({ message: "Email and password required." });
          }

          const { data: user, error } = await supabase
               .from("users")
               .select("*")
               .eq("email", email)
               .single();

          if (error) {
               console.error("Supabase error (users):", error.message);
               return res
                    .status(500)
                    .json({ message: "Database query failed!" });
          }
          if (!user) {
               return res.status(404).json({ message: "User not found!" });
          }

          const matchingPass = await bcrypt.compare(
               password,
               user.password_hash,
          );
          if (!matchingPass) {
               return res
                    .status(401)
                    .json({ message: "Password does not match!" });
          }
          let student = null;
          if (user && user.role === "STUDENT") {
               const { data, error } = await supabase
                    .from("students")
                    .select("*")
                    .eq("user_id", user.user_id)
                    .maybeSingle();
               if (error) {
                    console.error("Supabase error (students):", error.message);
                    return res
                         .status(500)
                         .json({ message: "Database query failed!" });
               }
               student = data;
          }

          // Generate tokens with standardized minimal payload
          const accessToken = jwt.sign(
               { user_id: user.user_id, role: user.role },
               process.env.JWT_SECRET,
               { expiresIn: "3h" },
          );
          const refreshToken = jwt.sign(
               { user_id: user.user_id },
               process.env.JWT_REFRESHTOKEN_SECRET,
               { expiresIn: "7d" },
          );

          // Set refresh cookie
          res.cookie("refreshToken", refreshToken, {
               httpOnly: true,
               secure: process.env.NODE_ENV === "production",
               maxAge: 7 * 24 * 60 * 60 * 1000,
          });

          // Return user + tokens with consistent fields
          console.log("messed here" + student?.hostel_id);
          return res.status(200).json({
               message: "Authentication success!",
               accessToken,
               user: {
                    user_id: user.user_id,
                    name: user.name,
                    role: user.role,
                    hostel_id: student ? student.hostel_id : null, // Assuming db field is hostel_name; adjust if needed
                    admission_no: student ? student.admission_no : null,
               },
          });
     } catch (error) {
          return res.status(500).json({
               message: "Authentication failed!",
               error: error.message,
          });
     }
});

router.post("/create", async (req, res) => {
     try {
          const { name, email, password, role } = req.body;
          if (!name || !email || !password || !role) {
               return res.status(400).json({ message: "fill all the fields" });
          }
          const { data: existingUser } = await supabase
               .from("users")
               .select("id")
               .eq("email", email)
               .single();

          if (existingUser) {
               return res.status(409).json({ message: "User already exists" });
          }

          const password_hash = await bcrypt.hash(password, 12);

          const { error: insertError } = await supabase
               .from("users")
               .insert([{ name, email, password_hash, role }]);

          if (insertError) {
               return res.status(500).json({
                    message: "Error creating user",
                    details: insertError.message,
               });
          }

          return res.status(201).json({ message: "User created successfully" });
     } catch (error) {
          return res
               .status(500)
               .json({ message: "User creation failed", error: error.message });
     }
});

// router.post("/addCount", async (req, res) => {
//      const { qrCode, hostle } = req.body;
//      if (!userId) {
//           return res
//                .status(400)
//                .json({ message: "couldnt get the credentials,pls try again" });
//      }
// });

router.post("/getQrCode", async (req, res) => {
     try {
          // const user_id = req.user.user_id;
          const { user_id, hostel_id } = req.body;
          console.log(hostel_id, user_id);

          if (!hostel_id) {
               return res
                    .status(400)
                    .json({ message: "Hostel ID is required" });
          }

          const { data: user, error: userError } = await supabase
               .from("students")
               .select("user_id, hostel_id")
               .eq("user_id", user_id)
               .eq("hostel_id", hostel_id)
               .maybeSingle();

          if (userError || !user) {
               console.error("Supabase error (students):", userError?.message);
               return res.status(404).json({
                    message: "User not found or doesn't belong to this hostel",
               });
          }

          const { data: hostel, error: hostelError } = await supabase
               .from("hostels")
               .select("hostel_id")
               .eq("hostel_id", hostel_id)
               .maybeSingle();

          if (hostelError || !hostel) {
               console.error("Supabase error (hostels):", hostelError?.message);
               return res.status(404).json({ message: "Hostel not found" });
          }

          const code = `${hostel_id}:${user_id}`;
          const encoded = CryptoJS.AES.encrypt(
               code,
               process.env.ENCRYPT_KEY,
          ).toString();

          if (!encoded) {
               return res
                    .status(500)
                    .json({ message: "Error generating QR code" });
          }

          return res.status(200).json({ qrCode: encoded });
     } catch (error) {
          console.error("QR code generation error:", error);
          return res
               .status(500)
               .json({ message: "Server error while generating QR code" });
     }
});

router.post("/scanQr", async (req, res) => {
     try {
          const { qrCode, currentHostelId, confirmed_by } = req.body;
          if (!qrCode || !currentHostelId) {
               return res.status(400).json({ message: "Bad request" });
          }

          const decoded = CryptoJS.AES.decrypt(qrCode, process.env.ENCRYPT_KEY);
          const combinedText = decoded.toString(CryptoJS.enc.Utf8);

          const destructured = combinedText.split(":");
          const hostel_id = destructured[0];
          const student_id = destructured[1];
          // console.log(hostel_id, student_id);

          if (currentHostelId !== hostel_id) {
               console.log("error");
               return res.status(400).json({
                    message: "Hostel-Id mismatch!!",
               });
          }

          const currentTime = new Date();
          const currentHour = currentTime.getHours();
          const currentMin = currentTime.getMinutes();

          const totalMinutes = currentHour * 60 + currentMin;
          let meal_type = "";
          const breakfastStart = 7 * 60 + 30;
          const breakfastEnd = 11 * 60;
          const lunchStart = 11 * 60 + 45;
          const lunchEnd = 14 * 60;
          const snackStart = 15 * 60 + 45;
          const snackEnd = 18 * 60;
          const dinnerStart = 18 * 60 + 45;
          const dinnerEnd = 21 * 60 + 45;

          if (totalMinutes >= breakfastStart && totalMinutes <= breakfastEnd) {
               meal_type = "BreakFast";
          } else if (totalMinutes >= lunchStart && totalMinutes <= lunchEnd) {
               meal_type = "Lunch";
          } else if (totalMinutes >= snackStart && totalMinutes <= snackEnd) {
               meal_type = "Snack";
          } else if (totalMinutes >= dinnerStart && totalMinutes <= dinnerEnd) {
               meal_type = "Dinner";
          } else {
               return res.status(404).json({ message: "Time Out!!" });
          }

          const startOfDay = new Date(
               currentTime.getFullYear(),
               currentTime.getMonth(),
               currentTime.getDate(),
               0,
               0,
               0,
          ).toISOString();

          const { data: meal, error } = await supabase
               .from("meals")
               .select("id")
               .eq("meal_type", meal_type)
               .eq("hostel_id", hostel_id)
               .gte("created_at", startOfDay)
               .maybeSingle();
          if (error) {
               return res.status(500).json({ message: "Internal error!" });
          }
          let meal_id = meal?.id;
          if (!meal) {
               const { data: meal, error } = await supabase
                    .from("meals")
                    .insert([{ meal_type, hostel_id }])
                    .select("id")
                    .single();
               if (error) {
                    return res
                         .status(500)
                         .json({ message2: "Internal error!" });
               }
               meal_id = meal.id;
          }

          const { data: existing, error: fetchingError } = await supabase
               .from("meal_logs")
               .select("student_id")
               .eq("meal_id", meal_id)
               .eq("student_id", student_id)
               .maybeSingle();
          if (fetchingError) {
               return res.status(404).json({ message: "Database error!!" });
          }
          if (!existing) {
               const { error: insertError } = await supabase
                    .from("meal_logs")
                    .insert([{ meal_id, student_id, hostel_id, confirmed_by }]);
               if (insertError) {
                    return res.status(404).json({ message: insertError });
               }
               return res.status(200).json({ message: "Ok" });
          }

          return res.status(400).json({
               message: "The user has already taken food",
               error: true,
          });
     } catch (err) {
          console.log("error");
          return res.status(500).json({ message: err });
     }
});

router.post("/refresh-token", async (req, res) => {
     const token = req.cookies.refreshToken;
     if (!token) {
          return res.status(401).json({ message: "Refresh token missing." });
     }
     try {
          const { user_id } = jwt.verify(
               token,
               process.env.JWT_REFRESHTOKEN_SECRET,
          );

          // First get user
          const { data: user, error: userError } = await supabase
               .from("users")
               .select("user_id, name, role")
               .eq("user_id", user_id)
               .single();

          if (userError || !user) {
               return res.status(404).json({ message: "User not found" });
          }

          // If student, get student info
          let student = null;
          if (user.role === "STUDENT") {
               const { data } = await supabase
                    .from("students")
                    .select("hostel_id, admission_no")
                    .eq("user_id", user_id)
                    .single();
               student = data;
          }

          const newAccessToken = jwt.sign(
               { user_id: user.user_id, role: user.role },
               process.env.JWT_SECRET,
               { expiresIn: "3h" },
          );

          const refreshToken = jwt.sign(
               { user_id: user.user_id },
               process.env.JWT_REFRESHTOKEN_SECRET,
               { expiresIn: "7d" },
          );

          res.cookie("refreshToken", refreshToken, {
               httpOnly: true,
               secure: process.env.NODE_ENV === "production",
               maxAge: 7 * 24 * 60 * 60 * 1000,
          });

          const userResponse = {
               user_id: user.user_id,
               name: user.name,
               role: user.role,
          };

          if (student) {
               userResponse.hostel_id = student.hostel_id;
               userResponse.admission_no = student.admission_no;
          }

          return res.status(200).json({
               message: "Token refreshed successfully",
               accessToken: newAccessToken,
               user: userResponse,
          });
     } catch (error) {
          return res.status(403).json({ message: "Invalid refresh token." });
     }
});

router.post("/logout", (req, res) => {
     res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
     });
     return res.status(200).json({ message: "Logged out successfully" });
});

router.get("/get-role", verify, async (req, res) => {
     try {
          const { user_id } = req.user;

          // Get user data
          const { data: user, error: userError } = await supabase
               .from("users")
               .select("user_id, name, role")
               .eq("user_id", user_id)
               .single();

          if (userError || !user) {
               return res.status(404).json({ message: "User not found" });
          }

          let userResponse = {
               user_id: user.user_id,
               name: user.name,
               role: user.role,
               hostel_id: null,
               admission_no: null,
          };

          // If student, get student details
          if (user.role === "STUDENT") {
               const { data: student, error: studentError } = await supabase
                    .from("students")
                    .select("hostel_id, admission_no")
                    .eq("user_id", user_id)
                    .single();

               if (!studentError && student) {
                    userResponse.hostel_id = student.hostel_id;
                    userResponse.admission_no = student.admission_no;
               }
          }

          console.log("Final user response:", userResponse);

          return res.status(200).json({ user: userResponse });
     } catch (error) {
          console.error("Error in /get-role:", error);
          return res
               .status(500)
               .json({ message: "Error fetching user", error: error.message });
     }
});

router.get("/hostels", verify, async (req, res) => {
     try {
          const { data: hostels, error } = await supabase
               .from("hostels")
               .select("hostel_id, hostel_name")
               .order("hostel_name", { ascending: true });

          if (error) {
               console.error("Supabase error (hostels):", error.message);
               return res
                    .status(500)
                    .json({ message: "Failed to fetch hostels" });
          }
          res.json({ hostels });
     } catch (e) {
          res.status(500).json({ message: "Server error" });
     }
});
export default router;
