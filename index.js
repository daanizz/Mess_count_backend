import express from "express";
import dotenv from "dotenv";
import AddUser from "./Routes/UserRouter.js";
import supabase from "./Configurations/dbConnection.js";

const app = express();

dotenv.config();

const PORT = process.env.PORT;

app.use("/addUser", AddUser);
supabase();
app.listen(PORT || 4050, () => {
     console.log(`http://localhost:${PORT}`);
});
