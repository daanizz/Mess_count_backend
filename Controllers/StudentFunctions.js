import supabase from "../Configurations/dbConnection.js";
import CryptoJS from "crypto-js";
import { verify } from "../middleware/verify.js";

export const GetQr = async (req, res) => {
     try {
          const user_id = req.user.user_id;
          const { hostel_id } = req.body;

          console.log(hostel_id);

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
               console.error(
                    "Supabase error (students):",
                    studentError.message,
               );
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
               process.env.ENCRYPT_KEY,
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
};
