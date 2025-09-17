import express from "express";
import dotenv from "dotenv";

const app = express();

dotenv.config();

const PORT = process.env.PORT;

app.use("/addUser");

app.listen(PORT || 4050, () => {
  console.log(`http://localhost:${PORT}`);
});
