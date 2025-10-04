import supabase from "../Configurations/dbConnection.js";
import CryptoJS from "crypto-js";
import { verify } from "../middleware/verify.js";

export const ScanQr = async (req, res) => {
     try {
          const confirmed_by = req.user.user_id;
          const { qrCode, currentHostelId } = req.body;
          const hour = 60;
          const minute = 1;

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
               const decoded = CryptoJS.AES.decrypt(
                    qrCode,
                    process.env.ENCRYPT_KEY,
               );
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
          const istTime = new Date(
               currentTime.toLocaleString("en-US", options),
          );

          const currentHour = istTime.getHours();
          const currentMin = istTime.getMinutes();
          const totalMinutes = currentHour * 60 + currentMin;

          let meal_type = "";
          const breakfastStart = 7 * hour + 30 * minute;
          const breakfastEnd = 11 * hour;
          const lunchStart = 11 * hour + 45 * minute;
          const lunchEnd = 14 * hour;
          const snackStart = 15 * hour + 20 * minute;
          const snackEnd = 18 * hour;
          const dinnerStart = 18 * hour + 45 * minute;
          const dinnerEnd = 21 * hour + 45 * minute;

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
               0,
          ).toISOString();

          const { data: meal, error: mealError } = await supabase
               .from("meals")
               .select("id")
               .eq("meal_type", meal_type)
               .eq("hostel_id", hostel_id)
               .gte("created_at", startOfDay)
               .maybeSingle();

          if (mealError) {
               console.error(
                    "Supabase error (meals select):",
                    mealError.message,
               );
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
                         insertMealError.message,
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
                    fetchingError.message,
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
               console.error(
                    "Supabase error (meal_logs insert):",
                    insertError.message,
               );
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
};

export const Hostels = async (req, res) => {
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
};
