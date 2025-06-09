// push-to-mongo.js
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI environment variable is not set.");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("locationDB");

    // Process locations (newest entry only)
    const locationsData = JSON.parse(await fs.readFile('data/locations.json', 'utf8'));
    if (Array.isArray(locationsData) && locationsData.length > 0) {
      const locationsCollection = db.collection("locations");
      const newestEntry = locationsData.reduce((latest, current) => {
        const latestTime = new Date(latest.timestamp).getTime();
        const currentTime = new Date(current.timestamp).getTime();
        return currentTime > latestTime ? current : latest;
      });

      const mongoEntry = {
        ...newestEntry,
        timestamp: new Date(newestEntry.timestamp),
        latitude: parseFloat(newestEntry.latitude),
        longitude: parseFloat(newestEntry.longitude),
        __v: newestEntry.__v || 0,
      };

      const existingEntry = await locationsCollection.findOne({ _id: mongoEntry._id });
      if (existingEntry) {
        console.log("Location entry with _id", mongoEntry._id, "already exists. Skipping.");
      } else {
        await locationsCollection.insertOne(mongoEntry);
        console.log("Newest location data pushed to MongoDB:", mongoEntry);
      }
    } else {
      console.log("No location data to process.");
    }

    // Process devices
    const devicesData = JSON.parse(await fs.readFile('data/devices.json', 'utf8'));
    if (Array.isArray(devicesData) && devicesData.length > 0) {
      const devicesCollection = db.collection("devices");
      await devicesCollection.deleteMany({}); // Replace all devices
      await devicesCollection.insertMany(devicesData);
      console.log("Devices data synced to MongoDB:", devicesData.length, "entries");
    }

    // Process users
    const usersData = JSON.parse(await fs.readFile('data/users.json', 'utf8'));
    if (Array.isArray(usersData) && usersData.length > 0) {
      const usersCollection = db.collection("users");
      await usersCollection.deleteMany({}); // Replace all users
      await usersCollection.insertMany(usersData);
      console.log("Users data synced to MongoDB:", usersData.length, "entries");
    }

    // Process dogs
    const dogsData = JSON.parse(await fs.readFile('data/dogs.json', 'utf8'));
    if (Array.isArray(dogsData) && dogsData.length > 0) {
      const dogsCollection = db.collection("dogs");
      await dogsCollection.deleteMany({}); // Replace all dogs
      await dogsCollection.insertMany(dogsData);
      console.log("Dogs data synced to MongoDB:", dogsData.length, "entries");
    }
  } catch (err) {
    console.error("Error pushing data to MongoDB:", err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error("Uncaught error:", err.message);
  process.exit(1);
});
