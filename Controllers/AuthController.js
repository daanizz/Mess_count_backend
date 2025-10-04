import supabase from "../Configurations/dbConnection.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { verify } from "../middleware/verify.js";

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

const VALID_ROLES = Object.freeze([
     "STUDENT",
     "ADMIN",
     "SUPER_ADMIN",
     "MESS_STAFF",
]);

export const CreateUser = async (req, res) => {
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
                    message: "Password must be at least 8 characters with uppercase, lowercase, digit, and special character",
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
               console.error(
                    "Supabase error (check user):",
                    checkError.message,
               );
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
               console.error(
                    "Supabase error (insert user):",
                    insertError.message,
               );
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
};

export const UserLogin = async (req, res) => {
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

          const matchingPass = await bcrypt.compare(
               password,
               user.password_hash,
          );
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
                    console.error(
                         "Error fetching student data:",
                         studentError.message,
                    );
                    return res.status(500).json({
                         success: false,
                         message: "Error fetching student data",
                    });
               }
          }

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
};

export const UserLogout = (req, res) => {
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
};

export const GetRole = async (req, res) => {
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
                    console.error(
                         "Error fetching student data:",
                         studentError.message,
                    );
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
};

export const RefreshToken = async (req, res) => {
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
          const { user_id } = jwt.verify(
               token,
               process.env.JWT_REFRESHTOKEN_SECRET,
          );

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
                    console.error(
                         "Error fetching student data:",
                         studentError.message,
                    );
                    return res.status(500).json({
                         success: false,
                         message: "Error fetching student data",
                    });
               }
          }

          const newAccessToken = jwt.sign(
               { user_id: user.user_id, role: user.role },
               process.env.JWT_SECRET,
               { expiresIn: "3h" },
          );

          const newRefreshToken = jwt.sign(
               { user_id: user.user_id },
               process.env.JWT_REFRESHTOKEN_SECRET,
               { expiresIn: "7d" },
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
};
