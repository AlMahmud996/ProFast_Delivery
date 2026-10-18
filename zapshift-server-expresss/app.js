import express from "express";
import cors from "cors";
import routes from "./routes/index.js"; // every API route

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// All API routes
app.use("/", routes);

// Test route
app.get("/", (req, res) => {
  res.send("ZAPSHIFT server is running");
});

export default app;
