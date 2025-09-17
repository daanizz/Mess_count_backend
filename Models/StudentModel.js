import supabase from "../Configurations/dbConnection.js";
export const StudentModel = {
     async create({ admission_no, name, hostel_id, room_no, hashed_pass }) {
          const { data, error } = await supabase
               .from("students")
               .insert([
                    { admission_no, name, hostel_id, room_no, hashed_pass },
               ]);
          if (error) throw error;
          return data[0];
     },
};
