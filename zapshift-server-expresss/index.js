import "dotenv/config";
import express from "express";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { runStartupTasks } from "./services/startup.service.js";

const port = process.env.PORT || 5000;

let ready;
const init = () => {
  if (!ready) {
    ready = connectDB().then(runStartupTasks).catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
};

const server = express();

server.use(async (req, res, next) => {
  try {
    await init();
    next();
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).send({ message: "Database connection failed" });
  }
});

server.use(app);

if (!process.env.VERCEL) {
  init()
    .then(() => server.listen(port, () => console.log(`PROFAST server is running on port ${port}`)))
    .catch((error) => {
      console.error("Server failed to start:", error);
      process.exit(1);
    });
}

export default server;