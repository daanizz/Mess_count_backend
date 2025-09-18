import express, { json } from "express";
import dotenv from "dotenv";
// import AddUser from "./Routes/UserRouter.js";
import supabase from "./Configurations/dbConnection.js";
import AuthRouter from "./Routes/AuthRoutes.js";
import cookieParser from "cookie-parser";

const app = express();

dotenv.config();
app.use(cookieParser());
// app.use(json());

const PORT = process.env.PORT;
app.use(express.json());
// app.use("/addUser", AddUser);
app.use("/Authentication", AuthRouter);

app.listen(PORT || 4050, () => {
     console.log(`http://localhost:${PORT}`);
});
