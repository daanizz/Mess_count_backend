import express, { json } from "express";
import dotenv from "dotenv";
// import AddStudent from "./Routes/UserRouter.js";
import supabase from "./Configurations/dbConnection.js";
import AuthRouter from "./Routes/AuthRoutes.js";
import cookieParser from "cookie-parser";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import UserRouter from "./Routes/UserRouter.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/qrcodes", express.static(path.join(__dirname, "qrcodes")));

dotenv.config();
app.use(cookieParser());
// app.use(json());
import cors from "cors";

app.use(
     cors({
          origin: ["http://localhost:5173", "https://mess-count.vercel.app"], // or whatever port your frontend runs on
          credentials: true,
     }),
);

const PORT = process.env.PORT;
app.use(express.json());
// app.use("/add", AddStudent);
app.use("/api/auth", AuthRouter);
app.use("/api/user", UserRouter);

app.listen(PORT || 4050, () => {
     console.log(`http://localhost:${PORT}`);
});
