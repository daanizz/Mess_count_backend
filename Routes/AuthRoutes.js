import supabase from "../Configurations/dbConnection.js";
import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

router.post("/login", async (req, res) => {
  console.log("Login API hit with body:", req.body);
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
      return res.status(400).json({
        message: "Supabase error!",
        details: error.message,
      });
    }
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const matchingPass = await bcrypt.compare(password, user.password_hash);
    if (!matchingPass) {
      return res.status(401).json({ message: "Password does not match!" });
    }

    const accessToken = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "3h" }
    );
    const refreshToken = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_REFRESHTOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Authentication success!",
      accessToken,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Authentication failed!", error: error.message });
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
      return res
        .status(500)
        .json({ message: "Error creating user", details: insertError.message });
    }

    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "User creation failed", error: error.message });
  }
});

export default router;
