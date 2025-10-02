import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export function verify(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token missing!",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token!",
      });
    }
    req.user = payload;
    next();
  });
}
