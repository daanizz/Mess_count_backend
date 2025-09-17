import supabase from "../Configurations/dbConnection.js";

export const AdminModel = {
     async create({ role, officename, hostel_id, name, hashed_pass }) {
          const { data, error } = await supabase
               .from("admins")
               .insert([{ role, officename, hostel_id, name, hashed_pass }]);
          if (error) throw error;
          return data[0];
     },
};
