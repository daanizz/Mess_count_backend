import supabase from "../Configurations/dbConnection.js";
import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/login", async (req, res) => {
     try {
          const { email, password } = req.body;
          const { data: users, error } = await supabase
               .from("users")
               .select("*")
               .eq("email", email)
               .single();
          if (error && error.code === "PGRST116") {
               return res.status(400).json({ message: "supabase error!!" });
          }
          if (!users) {
               return res.status(400).json({ message: "User not Found!!" });
          }

          const matchingPass = await bcrypt.compare(
               password,
               users.password_hash,
          );
          if (!matchingPass) {
               return res.status(400).json({ message: "password not match!" });
          }
          //   const accessToken = jwt.sign(
          //        //json
          //        { userId: users.user_id },
          //        process.env.JWT_SECRET,
          //        { expiresIn: "3hr" },
          //   );
          //   const refreshToken = jwt.sign(
          //        //cookie
          //        { userId: users.user_id },
          //        process.env.JWT_REFRESHTOKEN_SECRET,
          //        { expiresIn: "7d" },
          //   );
          return res.status(200).json({ message: "authentication success!!" });
     } catch (error) {
          return res
               .status(500)
               .json({ message: "authentication not success!!" });
     }
});

router.post("/create", async (req, res) => {
     try {
          const { name, email, password, role } = req.body;
          if (!name || !email || !password || !role) {
               return res.status(400).json({ message: "fill all the fields" });
          }
          const existingUser = await supabase
               .from("users")
               .select("id")
               .eq("email", email)
               .single();

            if(existingUser){
                return res.status(402).json({ message: "user already exists"})
            }
            const newUser=await supabase.from("users").insert()
     } catch (error) {}
});

export default router;
