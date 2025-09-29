/*
     1. Added a code block in the refresh token so that when refresh token is call a new refresh token is also recieved
     2. Changed the user response to hostel id intead of hostel name
     3. Changed the crypto since ai suggested a package was needed since thier was no build in package
     4. changed the scanQr and getQr 
     5. Added hostels route to get all the hostels 
*/
import supabase from "../Configurations/dbConnection.js";
import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
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
      return res.status(400).json({ message: "Email and password required." });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      console.error("Supabase error (users):", error.message);
      return res.status(500).json({ message: "Database query failed!" });
    }
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const matchingPass = await bcrypt.compare(password, user.password_hash);
    if (!matchingPass) {
      return res.status(401).json({ message: "Password does not match!" });
    }
    let student = null;
    if (user.role == "STUDENT") {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.user_id)
        .single();
      if (error) {
        console.error("Supabase error (students):", error.message);
        return res.status(500).json({ message: "Database query failed!" });
      }
      student = data;
    }

    // Generate tokens with standardized minimal payload
    const accessToken = jwt.sign(
      { user_id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "3h" }
    );
    const refreshToken = jwt.sign(
      { user_id: user.user_id },
      process.env.JWT_REFRESHTOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Set refresh cookie
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
    // Return user + tokens with consistent fields
    return res.status(200).json({
      message: "Authentication success!",
      accessToken,
      user: userResponse,
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

router.post("/getQrCode", verify, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { hostel_id } = req.body;

    if (!hostel_id) {
      return res.status(400).json({ message: "Hostel ID is required" });
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
      process.env.ENCRYPT_KEY
    ).toString();

    if (!encoded) {
      return res.status(500).json({ message: "Error generating QR code" });
    }

    return res.status(200).json({ qrCode: encoded });
  } catch (error) {
    console.error("QR code generation error:", error);
    return res
      .status(500)
      .json({ message: "Server error while generating QR code" });
  }
});

router.post("/scanQr", verify, async (req, res) => {
  console.log("hi iam here");
  try {
    const { qrCode, currentHostelId } = req.body;
    if (!qrCode || !currentHostelId) {
      return res.status(400).json({ message: "Bad request" });
    }

    const decoded = CryptoJS.AES.decrypt(qrCode, process.env.ENCRYPT_KEY);
    const combinedText = decoded.toString(CryptoJS.enc.Utf8);

    const destructured = combinedText.split(":");
    const hostel_id = destructured[0];
    const user_id = destructured[1];

    if (currentHostelId !== hostel_id) {
      return res.status(400).json({
        message: "Hostel mismatch!!",
      });
    }
    const { data: userdata, error } = await supabase
      .from("users")
      .select("name")
      .eq("user_id", user_id)
      .single();

    if (error || !userdata) {
      return res.status(404).json({
        message: "user not found",
      });
    }

    const { data: student, studenterror } = await supabase
      .from("students")
      .select("admission_no")
      .eq("user_id", user_id)
      .single();

    if (studenterror || !student) {
      return res.status(404).json({
        message: "user not found",
      });
    }

    const userResponse = {
      name: userdata.name,
      admission_no: student.admission_no,
    };

    return res.status(200).json({ hostel: hostel_id, user: userResponse });
  } catch (err) {
    console.error("QR scan error:", err.message);
    return res.status(500).json({ message: "Server error while scanning QR" });
  }
});

router.post("/refresh-token", async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ message: "Refresh token missing." });
  }
  try {
    const { user_id } = jwt.verify(token, process.env.JWT_REFRESHTOKEN_SECRET);

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
      { expiresIn: "3h" }
    );

    const refreshToken = jwt.sign(
      { user_id: user.user_id },
      process.env.JWT_REFRESHTOKEN_SECRET,
      { expiresIn: "7d" }
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
    const { data: user, error } = await supabase
      .from("users")
      .select("user_id, name, role")
      .eq("user_id", user_id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: "User not found" });
    }
    let student;
    if (user.role === "STUDENT") {
      const { data } = await supabase
        .from("students")
        .select("hostel_id, admission_no")
        .eq("user_id", user_id)
        .single();
      student = data;
    }

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
      user: userResponse,
    });
  } catch (error) {
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
      return res.status(500).json({ message: "Failed to fetch hostels" });
    }
    res.json({ hostels });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});
export default router;
