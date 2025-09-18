import supabase from "../Configurations/dbConnection.js";
import { Router } from "express";
import csvtojson from "csvtojson";
import multer, { memoryStorage } from "multer";
import { Readable } from "stream";

const router = Router();
const uploads = multer({ storage: multer.memoryStorage() });

router.post("/student", async (req, res) => {
     try {
          const results = [];
          const buffer = req.file.buffer;
          const stream = Readable.from(buffer.toString());

          stream
               .pipe(csv())
               .on("data", (row) => {
                    results.push(row);
               })
               .on("end", async () => {
                    try {
                         const { data, error } = await supabase
                              .from("users")
                              .insert(results);

                         if (error) {
                              console.error(error);
                              return res
                                   .status(500)
                                   .json({ error: "Database insert failed" });
                         }
                    } catch (error) {}
               });
     } catch (error) {}
});
