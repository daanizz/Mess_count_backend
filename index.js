import express, { json } from "express";
import dotenv from "dotenv";
// import AddStudent from "./Routes/UserRouter.js";
import supabase from "./Configurations/dbConnection.js";
import AuthRouter from "./Routes/AuthRoutes.js";
import cookieParser from "cookie-parser";
import UserRouter from "./Routes/UserRouter.js";
import adminRouter from "./Routes/AdminRoutes.js";

const app = express();

dotenv.config();
app.use(cookieParser());
// app.use(json());
import cors from "cors";

app.use(
     cors({
          origin: ["http://localhost:5173", "https://mess-count.vercel.app"],
          credentials: true,
     }),
);

const PORT = process.env.PORT;
app.use(express.json());
// app.use("/add", AddStudent);
app.use("/api/auth", AuthRouter);
app.use("/api/user", UserRouter);
app.use("/api/admin", adminRouter);

app.listen(PORT || 4050, () => {
     console.log(`http://localhost:${PORT}`);
});
