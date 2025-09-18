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
import cors from "cors";

app.use(
  cors({
    origin: "http://localhost:5173", // or whatever port your frontend runs on
    credentials: true,
  })
);

const PORT = process.env.PORT;
app.use(express.json());
// app.use("/addUser", AddUser);
app.use("/api/auth", AuthRouter);

app.listen(PORT || 4050, () => {
  console.log(`http://localhost:${PORT}`);
});
