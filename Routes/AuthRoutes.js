// Backend Router (fixed)
import supabase from "../Configurations/dbConnection.js";
import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import QRCode from "qrcode";
import path from "path";
import { verify } from "../middleware/verify.js";

dotenv.config();

const router = Router();
router.use((req, res, next) => {
     res.setHeader("Cache-Control", "no-store");
     next();
});

router.post("/login", async (req, res) => {
     console.log("Login API hit with body:", req.body);
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
               return res.status(400).json({
                    message: "Supabase error!",
                    details: error.message,
               });
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

          // Generate tokens with standardized minimal payload
          const accessToken = jwt.sign(
               { userId: user.user_id, role: user.role },
               process.env.JWT_SECRET,
               { expiresIn: "3h" },
          );
          const refreshToken = jwt.sign(
               { userId: user.user_id },
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
          return res.status(200).json({
               message: "Authentication success!",
               accessToken,
               user: {
                    user_id: user.user_id,
                    name: user.name,
                    role: user.role,
                    hostel_name: user.hostel_name, // Assuming db field is hostel_name; adjust if needed
                    admission_no: user.admission_no,
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
          const { user_id, hostel_id } = req.body;
          if (!user_id || !hostel_id) {
               return res.status(400).json({ message: "bad request" });
          }
          const { data: user, error: userError } = await supabase
               .from("students")
               .select("user_id")
               .eq("user_id", user_id)
               .maybeSingle();
          if (userError || !user) {
               console.log("error");
               return res
                    .status(404)
                    .json({ message: "No user found with this ID" });
          }
          const { data: hostel, error: hostelError } = await supabase
               .from("hostels")
               .select("hostel_id")
               .eq("hostel_id", hostel_id)
               .maybeSingle();
          if (hostelError || !hostel) {
               console.log("error");
               return res
                    .status(404)
                    .json({ message: "No Hostel found with this ID" });
          }

          const code = `${hostel_id}:${user_id}`;

          const encoded = crypto.AES.encrypt(
               code,
               process.env.ENCRYPT_KEY,
          ).toString();
          if (!encoded) {
               return res
                    .status(404)
                    .json({ message: "Error in creating code" });
          }

          return res.status(200).json(encoded);
     } catch (error) {
          return res.status(500).json(error);
     }
});

router.post("/scanQr", async (req, res) => {
     try {
          const { qrCode, currentHostelId } = req.body;
          if (!qrCode || !currentHostelId) {
               return res.status(400).json({ message: "Bad request" });
          }

          const decoded = crypto.AES.decrypt(qrCode, process.env.ENCRYPT_KEY);
          const combinedText = decoded.toString(crypto.enc.Utf8);

          const destructured = combinedText.split(":");
          const hostel_id = destructured[0];
          const user_id = destructured[1];
          console.log(hostel_id, user_id);

          if (currentHostelId !== hostel_id) {
               console.log("error");
               return res.status(400).json({
                    message: "Hostel-Id mismatch!!",
               });
          }

          return res.status(200).json({ hostel: hostel_id, user: user_id });
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
          const { userId } = jwt.verify(
               token,
               process.env.JWT_REFRESHTOKEN_SECRET,
          );
          const { data: user } = await supabase
               .from("users")
               .select("user_id, name, role, hostel_name, admission_no")
               .eq("user_id", userId)
               .single();
          const newAccessToken = jwt.sign(
               { userId: user.user_id, role: user.role },
               process.env.JWT_SECRET,
               {
                    expiresIn: "3h",
               },
          );
          return res.status(200).json({ accessToken: newAccessToken, user });
     } catch {
          return res.status(403).json({ message: "Invalid refresh token." });
     }
});

router.post("/logout", (req, res) => {
     res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
     });
     return res.sendStatus(204);
});

router.get("/get-role", verify, async (req, res) => {
     try {
          const { userId } = req.user;
          const { data: user, error } = await supabase
               .from("users")
               .select("user_id, name, role")
               .eq("user_id", userId)
               .single();

          if (error || !user) {
               return res.status(404).json({ message: "User not found" });
          }

          return res.status(200).json({ user });
     } catch (error) {
          return res
               .status(500)
               .json({ message: "Error fetching user", error: error.message });
     }
});
export default router;
