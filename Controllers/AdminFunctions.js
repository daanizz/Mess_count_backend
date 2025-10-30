import supabase from "../Configurations/dbConnection.js";
import papa from "papaparse";
import bcrypt from "bcrypt";

export const addNewBatch = async (req, res) => {
     //the admin cehck is done, now the token contains the admin data and is verified..now just update the variable names , instead keep the real one.. as payload is taken from the middleware itself.
     try {
          const { adminId, expiry_date } = req.body;
          if (!adminId || !expiry_date) {
               return res.status(400).json({
                    success: false,
                    message: "Insufficient data provided",
               });
          }

          const current_date = new Date();

          if (expiry_date < current_date) {
               return res.status(400).json({
                    success: false,
                    message: "Can't create a batch with past date as expiry date",
               });
          }

          const { data: NewBatch, error: BatchAddingError } = await supabase
               .from("batch_log")
               .insert({ created_by: adminId, expiry_date: expiry_date })
               .select("id")
               .single();
          if (BatchAddingError) {
               return res.status(500).json({
                    success: false,
                    message: BatchAddingError,
               });
          }
          const batch_id = NewBatch.id;
          return res.status(200).json({
               success: true,
               message: "New Batch has been added",
               batch_id,
          });
     } catch (error) {
          return res.status(500).json({ message: error, success: false });
     }
};

export const addStudents = async (req, res) => {
     try {
          const { csv_data, hostel_id } = req.body;
          let batch_id;
          try {
               batch_id = await getBatchId();
               console.log(batch_id);
          } catch (error) {
               return res
                    .status(500)
                    .json({ success: false, message: error.message });
          }

          const parsed_data = papa.parse(csv_data, {
               header: true,
               skipEmptyLines: true,
          });
          const rows = parsed_data.data;
          const uploadFormat = await Promise.all(
               rows.map(async (row) => ({
                    // room: row.ROOM,
                    name: row.NAME,
                    // admission_no: parseInt(row.ADMN, 10),
                    email: `${row.ADMN}@tkmce.ac.in`,
                    role: "STUDENT",
                    password_hash: await bcrypt.hash(row.ADMN, 12),
               })),
          );

          const { data: students, error: stdentAddError } = await supabase
               .from("users")
               .insert(uploadFormat)
               .select("user_id");

          // console.log(students);

          if (stdentAddError) {
               return res.status(500).json({
                    success: false,
                    message:
                         "Error in adding users to user-database!" +
                         stdentAddError.message,
               });
          }

          if (rows.length !== students.length) {
               await supabase.from("users").delete().in("user_id", students);
               // return error, also delete all uploaded users
               return res.status(400).json({
                    success: false,
                    message: "inserted data and actual data mismatch!",
               });
          }

          const stdData = rows.map((row, i) => ({
               user_id: students[i].user_id,
               admission_no: parseInt(row.ADMN, 10),
               hostel_id,
               batch_id,
               room: row.ROOM,
          }));

          console.log(stdData.slice(1, 10));

          const { error: studentAdditionError } = await supabase
               .from("students")
               .insert(stdData);
          if (studentAdditionError) {
               return res.status(500).json({
                    success: false,
                    message: "stdnt:" + studentAdditionError.message,
               });
          }

          // console.log(addStudents[0]);
          return res
               .status(201)
               .json({ success: true, message: "Students added successfully" });
     } catch (error) {
          return res
               .status(500)
               .json({ success: false, message: error.message });
     }
};

async function getBatchId() {
     try {
          const CurrentDate = new Date().toISOString();
          // const dateOnly = CurrentDate.split("T");
          console.log(CurrentDate);
          // console.log(currentDate);
          const { data: batch, error: batchIdError } = await supabase
               .from("batch_log")
               .select("id")
               .gte("expiry_date", CurrentDate)
               .single();
          // console.log(batch_id.id);
          if (batchIdError) {
               throw new Error(
                    "Database couldnt find the batch!!" + batchIdError.message,
               );
          }
          return batch.id;
     } catch (error) {
          throw new Error(error);
     }
}
