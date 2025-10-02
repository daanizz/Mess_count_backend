/*
  1. Should we keep expiry for qr?
  2. token clear function can be used like the get studentdata function
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

const VALID_ROLES = Object.freeze([
  "STUDENT",
  "ADMIN",
  "SUPER_ADMIN",
  "MESS_STAFF",
]);

router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  next();
});

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPassword = (password) => {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
  return strongRegex.test(password);
};

async function getStudentData(user_id) {
  const { data, error } = await supabase
    .from("students")
    .select("hostel_id, admission_no")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (userError) {
      console.error("Supabase error (users):", userError.message);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const matchingPass = await bcrypt.compare(password, user.password_hash);
    if (!matchingPass) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    let student = null;
    if (user.role === "STUDENT") {
      try {
        student = await getStudentData(user.user_id);
      } catch (studentError) {
        console.error("Error fetching student data:", studentError.message);
        return res.status(500).json({
          success: false,
          message: "Error fetching student data",
        });
      }
    }

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

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      accessToken,
      user: {
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        hostel_id: student ? student.hostel_id : null,
        admission_no: student ? student.admission_no : null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
});

router.post("/create", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters with uppercase, lowercase, digit, and special character",
      });
    }

    if (!VALID_ROLES.includes(role.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("user_id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (checkError) {
      console.error("Supabase error (check user):", checkError.message);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { error: insertError } = await supabase.from("users").insert([
      {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password_hash,
        role: role.toUpperCase(),
      },
    ]);

    if (insertError) {
      console.error("Supabase error (insert user):", insertError.message);
      return res.status(500).json({
        success: false,
        message: "Error creating user",
      });
    }

    return res.status(201).json({
      success: true,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("User creation error:", error);
    return res.status(500).json({
      success: false,
      message: "User creation failed",
    });
  }
});

router.post("/getQrCode", verify, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { hostel_id } = req.body;

    if (!hostel_id) {
      return res.status(400).json({
        success: false,
        message: "Hostel ID is required",
      });
    }

    if (isNaN(parseInt(hostel_id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid hostel ID format",
      });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("user_id, hostel_id")
      .eq("user_id", user_id)
      .eq("hostel_id", hostel_id)
      .maybeSingle();

    if (studentError) {
      console.error("Supabase error (students):", studentError.message);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "User not found or doesn't belong to this hostel",
      });
    }

    const { data: hostel, error: hostelError } = await supabase
      .from("hostels")
      .select("hostel_id")
      .eq("hostel_id", hostel_id)
      .maybeSingle();

    if (hostelError) {
      console.error("Supabase error (hostels):", hostelError.message);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: "Hostel not found",
      });
    }

    // const expiryTime = Date.now() + 30 * 60 * 1000;
    const code = `${hostel_id}:${user_id}`; //:${expiryTime}
    const encoded = CryptoJS.AES.encrypt(
      code,
      process.env.ENCRYPT_KEY
    ).toString();

    if (!encoded) {
      return res.status(500).json({
        success: false,
        message: "Error generating QR code",
      });
    }

    return res.status(200).json({
      success: true,
      qrCode: encoded,
      // expiresAt: new Date(expiryTime).toISOString(),
    });
  } catch (error) {
    console.error("QR code generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while generating QR code",
    });
  }
});

router.post("/scanQr", verify, async (req, res) => {
  try {
    const confirmed_by = req.user.user_id;
    const { qrCode, currentHostelId } = req.body;

    if (!qrCode || !currentHostelId) {
      return res.status(400).json({
        success: false,
        message: "QR code and hostel ID are required",
      });
    }

    if (isNaN(parseInt(currentHostelId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid hostel ID format",
      });
    }

    let combinedText;
    try {
      const decoded = CryptoJS.AES.decrypt(qrCode, process.env.ENCRYPT_KEY);
      combinedText = decoded.toString(CryptoJS.enc.Utf8);

      if (!combinedText) {
        return res.status(400).json({
          success: false,
          message: "Invalid QR code",
        });
      }
    } catch (decryptError) {
      console.error("QR decryption error:", decryptError);
      return res.status(400).json({
        success: false,
        message: "Invalid or corrupted QR code",
      });
    }

    const destructured = combinedText.split(":");
    if (destructured.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code format",
      });
    }

    const hostel_id = destructured[0];
    const student_id = destructured[1];
    // const expiryTime = parseInt(destructured[2]);

    // if (Date.now() > expiryTime) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "QR code has expired",
    //   });
    // }

    if (parseInt(currentHostelId) !== parseInt(hostel_id)) {
      return res.status(400).json({
        success: false,
        message: "Hostel ID mismatch",
      });
    }

    const currentTime = new Date();
    const options = { timeZone: "Asia/Kolkata" };
    const istTime = new Date(currentTime.toLocaleString("en-US", options));

    const currentHour = istTime.getHours();
    const currentMin = istTime.getMinutes();
    const totalMinutes = currentHour * 60 + currentMin;

    let meal_type = "";
    const breakfastStart = 7 * 60 + 30;
    const breakfastEnd = 11 * 60;
    const lunchStart = 11 * 60 + 45;
    const lunchEnd = 14 * 60;
    const snackStart = 15 * 60 + 20;
    const snackEnd = 18 * 60;
    const dinnerStart = 18 * 60 + 45;
    const dinnerEnd = 21 * 60 + 45;

    if (totalMinutes >= breakfastStart && totalMinutes <= breakfastEnd) {
      meal_type = "Breakfast";
    } else if (totalMinutes >= lunchStart && totalMinutes <= lunchEnd) {
      meal_type = "Lunch";
    } else if (totalMinutes >= snackStart && totalMinutes <= snackEnd) {
      meal_type = "Snack";
    } else if (totalMinutes >= dinnerStart && totalMinutes <= dinnerEnd) {
      meal_type = "Dinner";
    } else {
      return res.status(400).json({
        success: false,
        message: "Outside meal time window",
      });
    }

    const startOfDay = new Date(
      istTime.getFullYear(),
      istTime.getMonth(),
      istTime.getDate(),
      0,
      0,
      0
    ).toISOString();

    const { data: meal, error: mealError } = await supabase
      .from("meals")
      .select("id")
      .eq("meal_type", meal_type)
      .eq("hostel_id", hostel_id)
      .gte("created_at", startOfDay)
      .maybeSingle();

    if (mealError) {
      console.error("Supabase error (meals select):", mealError.message);
      return res.status(500).json({
        success: false,
        message: "Database error while fetching meal",
      });
    }

    let meal_id = meal?.id;

    if (!meal) {
      const { data: newMeal, error: insertMealError } = await supabase
        .from("meals")
        .insert([{ meal_type, hostel_id }])
        .select("id")
        .maybeSingle();

      if (insertMealError) {
        console.error(
          "Supabase error (meals insert):",
          insertMealError.message
        );
        return res.status(500).json({
          success: false,
          message: "Database error while creating meal",
        });
      }

      meal_id = newMeal?.id;
    }

    if (!meal_id) {
      return res.status(500).json({
        success: false,
        message: "Failed to get meal ID",
      });
    }

    const { data: existingLogs, error: fetchingError } = await supabase
      .from("meal_logs")
      .select("student_id")
      .eq("meal_id", meal_id)
      .eq("student_id", student_id)
      .limit(1);

    if (fetchingError) {
      console.error(
        "Supabase error (meal_logs select):",
        fetchingError.message
      );
      return res.status(500).json({
        success: false,
        message: "Database error while checking meal log",
      });
    }

    if (existingLogs && existingLogs.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Student has already taken this meal",
      });
    }

    const { error: insertError } = await supabase
      .from("meal_logs")
      .insert([{ meal_id, student_id, hostel_id, confirmed_by }]);

    if (insertError) {
      console.error("Supabase error (meal_logs insert):", insertError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to log meal",
      });
    }

    const { data: userdata, error } = await supabase
      .from("users")
      .select("name")
      .eq("user_id", student_id)
      .single();
    if (error || !userdata) {
      return res.status(404).json({ message: "user not found" });
    }
    const { data: student, studenterror } = await supabase
      .from("students")
      .select("admission_no")
      .eq("user_id", student_id)
      .single();
    if (studenterror || !student) {
      return res.status(404).json({ message: "user not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Meal logged successfully",
      hostel: hostel_id,
      user: {
        name: userdata.name,
        admission_no: student.admission_no,
      },
      meal_type,
    });
  } catch (err) {
    console.error("Scan QR error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while processing QR code",
    });
  }
});

router.post("/refresh-token", async (req, res) => {
  const token = req.cookies.refreshToken;

  const clearAndFail = (status, message) => {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    return res.status(status).json({
      success: false,
      message,
    });
  };

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Refresh token missing",
    });
  }

  try {
    const { user_id } = jwt.verify(token, process.env.JWT_REFRESHTOKEN_SECRET);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_id, name, role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (userError) {
      console.error("Supabase error (users):", userError.message);
      return clearAndFail(500, "Database query failed");
    }

    if (!user) {
      return clearAndFail(404, "User not found");
    }

    let student = null;
    if (user.role === "STUDENT") {
      try {
        student = await getStudentData(user_id);
      } catch (studentError) {
        console.error("Error fetching student data:", studentError.message);
        return res.status(500).json({
          success: false,
          message: "Error fetching student data",
        });
      }
    }

    const newAccessToken = jwt.sign(
      { user_id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "3h" }
    );

    const newRefreshToken = jwt.sign(
      { user_id: user.user_id },
      process.env.JWT_REFRESHTOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      accessToken: newAccessToken,
      user: {
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        hostel_id: student ? student.hostel_id : null,
        admission_no: student ? student.admission_no : null,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);

    if (error.name === "TokenExpiredError") {
      return clearAndFail(401, "Refresh token expired");
    }
    return clearAndFail(401, "Invalid refresh token");
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

router.get("/get-role", verify, async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_id, name, role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (userError) {
      console.error("Supabase error (users):", userError.message);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let student = null;
    if (user.role === "STUDENT") {
      try {
        student = await getStudentData(user_id);
      } catch (studentError) {
        console.error("Error fetching student data:", studentError.message);
        return res.status(500).json({
          success: false,
          message: "Error fetching student data",
        });
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        hostel_id: student ? student.hostel_id : null,
        admission_no: student ? student.admission_no : null,
      },
    });
  } catch (error) {
    console.error("Error in /get-role:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user data",
    });
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
      return res.status(500).json({
        success: false,
        message: "Failed to fetch hostels",
      });
    }

    return res.json({
      success: true,
      hostels: hostels || [],
    });
  } catch (error) {
    console.error("Error fetching hostels:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;
