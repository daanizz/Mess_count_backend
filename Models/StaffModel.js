import supabase from "../Configurations/dbConnection.js";

export const StaffModel = {
     async create({ name, current_hostel_id, hashed_pass }) {
          const { data, error } = await supabase
               .from("staff")
               .insert([{ name, current_hostel_id, hashed_pass }]);
          if (error) throw error;
          return data[0];
     },
};
