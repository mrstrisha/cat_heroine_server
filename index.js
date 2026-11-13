
import "dotenv/config";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import { verifyToken } from "./middleware/verifyToken.js";

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("Event_data");

const dataCollections = db.collection("Event_data_card");
const joinedCollections = db.collection("Joined_events");

// ==================================
// 1. CREATE EVENT (JWT PROTECTED)
// ==================================

app.post("/CreateEvents", verifyToken, async (req, res) => {
  try {
    const data = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventDate = new Date(data.eventDate);

    if (isNaN(eventDate.getTime()) || eventDate <= today) {
      return res.status(400).send({
        message: "Please select a future date",
      });
    }

    const result = await dataCollections.insertOne({
      ...data,
      createdBy: req.user.email,
    });

    res.status(201).send({
      message: "Event created successfully",
      result,
    });
  } catch (error) {
    console.error("Create Event Error:", error);

    res.status(500).send({
      message: "Failed to create event",
    });
  }
});

// ==================================
// 2. GET ALL EVENTS (PUBLIC)
// ==================================

app.get("/ManageEvent", async (req, res) => {
  try {
    const result = await dataCollections.find().toArray();

    res.send(result);
  } catch (error) {
    console.error("Get Events Error:", error);

    res.status(500).send({
      message: "Failed to get events",
    });
  }
});

// ==================================
// 3. GET SINGLE EVENT (PUBLIC)
// ==================================

app.get("/eventDetail/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    const result = await dataCollections.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    res.send(result);
  } catch (error) {
    console.error("Event Detail Error:", error);

    res.status(500).send({
      message: "Failed to get event details",
    });
  }
});

// ==================================
// 4. UPDATE EVENT (OWNER ONLY)
// ==================================

app.patch("/eventDetail/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    // Check event owner
    const existingEvent = await dataCollections.findOne({
      _id: new ObjectId(id),
    });

    if (!existingEvent) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    if (
      !existingEvent.createdBy ||
      existingEvent.createdBy.toLowerCase() !==
        req.user.email.toLowerCase()
    ) {
      return res.status(403).send({
        message: "You can only edit your own events",
      });
    }

    // Prevent changing protected fields
    const { _id, createdBy, ...updateData } = req.body;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).send({
        message: "No update data provided",
      });
    }

    const result = await dataCollections.updateOne(
      {
        _id: new ObjectId(id),
        createdBy: existingEvent.createdBy,
      },
      {
        $set: updateData,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    res.send({
      message: "Event updated successfully",
      result,
    });
  } catch (error) {
    console.error("Update Event Error:", error);

    res.status(500).send({
      message: "Failed to update event",
    });
  }
});

// ==================================
// 5. DELETE EVENT (OWNER ONLY)
// ==================================

app.delete("/eventDetail/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    // Check event owner
    const existingEvent = await dataCollections.findOne({
      _id: new ObjectId(id),
    });

    if (!existingEvent) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    if (
      !existingEvent.createdBy ||
      existingEvent.createdBy.toLowerCase() !==
        req.user.email.toLowerCase()
    ) {
      return res.status(403).send({
        message: "You can only delete your own events",
      });
    }

    const result = await dataCollections.deleteOne({
      _id: new ObjectId(id),
      createdBy: existingEvent.createdBy,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    // Remove join records for this event
    await joinedCollections.deleteMany({
      eventId: id,
    });

    res.send({
      message: "Event deleted successfully",
      result,
    });
  } catch (error) {
    console.error("Delete Event Error:", error);

    res.status(500).send({
      message: "Failed to delete event",
    });
  }
});

// ==================================
// 6. JOIN EVENT (JWT PROTECTED)
// ==================================

app.post("/joinEvent", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.body;

    // Get authenticated user's email from JWT
    const userEmail = req.user.email;

    if (!ObjectId.isValid(eventId)) {
      return res.status(400).send({
        message: "Invalid event ID",
      });
    }

    const event = await dataCollections.findOne({
      _id: new ObjectId(eventId),
    });

    if (!event) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    const alreadyJoined = await joinedCollections.findOne({
      eventId: eventId,
      userEmail: userEmail,
    });

    if (alreadyJoined) {
      return res.status(400).send({
        message: "You already joined this event",
      });
    }

    const result = await joinedCollections.insertOne({
      eventId: eventId,
      userEmail: userEmail,
      joinedAt: new Date(),
    });

    res.status(201).send({
      message: "Successfully joined the event",
      result,
    });
  } catch (error) {
    console.error("Join Event Error:", error);

    res.status(500).send({
      message: "Failed to join event",
    });
  }
});

// ==================================
// 7. GET JOINED EVENTS (JWT PROTECTED)
// ==================================

app.get("/joinedEvents/:email", verifyToken, async (req, res) => {
  try {
    const { email } = req.params;

    if (
      email.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).send({
        message: "You cannot access another user's joined events",
      });
    }

    const userEmail = req.user.email;

    const joinedEvents = await joinedCollections
      .find({ userEmail: userEmail })
      .toArray();

    const eventIds = joinedEvents
      .filter((item) => ObjectId.isValid(item.eventId))
      .map((item) => new ObjectId(item.eventId));

    const events = await dataCollections
      .find({ _id: { $in: eventIds } })
      .sort({ eventDate: 1 })
      .toArray();

    res.send(events);
  } catch (error) {
    console.error("Joined Events Error:", error);

    res.status(500).send({
      message: "Failed to get joined events",
    });
  }
});

// ==================================
// 8. RECENT EVENTS (PUBLIC)
// ==================================

app.get("/recentEvents", async (req, res) => {
  try {
    const today = new Date();

    const todayDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const result = await dataCollections
      .find({ eventDate: { $gte: todayDate } })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    res.send(result);
  } catch (error) {
    console.error("Recent Events Error:", error);

    res.status(500).send({
      message: "Failed to load recent events",
    });
  }
});

// ==================================
// 9. HOME ROUTE
// ==================================

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// ==================================
// START SERVER
// ==================================

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

