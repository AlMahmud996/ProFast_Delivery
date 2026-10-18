import "dotenv/config"; // must stay the FIRST import so the .env values are ready for every other file
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { runStartupTasks } from "./services/startup.service.js";

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB(); // connect to MongoDB first
    await runStartupTasks(); // indexes + one-time line-haul fix

    app.listen(port, () => {
      console.log(`PROFAST server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error);
    process.exit(1); // better to stop than to run without a database
  }
};

start();
