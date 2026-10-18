import { MongoClient, ServerApiVersion } from "mongodb"; // MongoDB driver

// These are filled in by connectDB(). They are "live bindings": other files import them
// at the top, and they hold the real collection as soon as the DB is connected.
export let usersCollection;
export let parcelsCollection;
export let paymentsCollection;
export let trackingCollection;
export let ridersCollection;
export let earningsCollection; // one record per job a rider finishes (the rider's history and earnings)
export let expensesCollection; // company costs (truck transfers)
export let cashoutsCollection; // money taken out of the system
export let cashoutLocksCollection; // short-lived lock so one wallet can't run two cashouts at the same time
export let notificationsCollection; // bell notifications (one document per person per notification)

export const connectDB = async () => {
  // Read the env here (not at the top) so dotenv has already loaded
  const uri =
    process.env.MONGODB_URI ||
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cdfoago.mongodb.net/?retryWrites=true&w=majority`;

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  await client.db("admin").command({ ping: 1 });
  console.log("Connected to MongoDB");

  const db = client.db("zapshiftDB");
  usersCollection = db.collection("users");
  parcelsCollection = db.collection("parcels");
  paymentsCollection = db.collection("payments");
  trackingCollection = db.collection("tracking");
  ridersCollection = db.collection("riders");
  earningsCollection = db.collection("riderEarnings");
  expensesCollection = db.collection("expenses");
  cashoutsCollection = db.collection("cashouts");
  cashoutLocksCollection = db.collection("cashoutLocks");
  notificationsCollection = db.collection("notifications");
};
