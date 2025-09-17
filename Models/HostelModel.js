import supabase from "../Configurations/dbConnection.js";

export const HostelModel = {
     async create({ name }) {
          const { data, error } = await supabase
               .from("hostels")
               .insert([{ name }]);
          if (error) throw error;
          return data[0];
     },
};
