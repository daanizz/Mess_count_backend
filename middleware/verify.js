import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import supabase from "../Configurations/dbConnection.js";

dotenv.config();

export function verify(req, res, next) {
     const authHeader = req.headers["authorization"];
     const token = authHeader?.split(" ")[1];
     if (!token) {
          return res.status(401).json({
               success: false,
               message: "Access token missing!",
          });
     }

     jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
          if (err) {
               return res.status(401).json({
                    success: false,
                    message: "Invalid or expired token!",
               });
          }
          req.user = payload;
          next();
     });
}

export async function adminCheck(req, res, next) {
     const userRole = req.user.role;
     const userId = req.user.user_id;
     if (userRole === "ADMIN") {
          const { error: databaseFetchingError } = await supabase
               .from("users")
               .select("user_id")
               .eq("role", userRole)
               .eq("user_id", userId);
          if (databaseFetchingError) {
               return res.status(500).json({
                    message: "Error in fetching data from database:",
                    databaseFetchingError,
               });
          }
          next();
     } else {
          return res.status(400).json({
               message: "Only Admin has the Access to this function!!",
          });
     }
}
