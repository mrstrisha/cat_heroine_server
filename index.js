import 'dotenv/config'
import express from 'express'
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';


const app = express()
const port = 8000


app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();

const db = mongoClient.db("Event_data");

const dataCollections = db.collection("Event_data_card");
const joinedCollections = db.collection("Joined_events");


app.post("/CreateEvents", async (req, res) => {
  const data = req.body;

  // Event date validation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventDate = new Date(data.eventDate);

  if (isNaN(eventDate.getTime()) || eventDate <= today) {
    return res.status(400).send({
      message: "Please select a future date",
    });
  }

  try {
    const result = await dataCollections.insertOne(data);

    res.send({
      message: "Event created successfully",
      result,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to create event",
    });
  }
});


app.get("/ManageEvent", async (req,res)=>{
  const result = await dataCollections.find().toArray()
  res.send(result)
})

app.get('/eventDetail/:id',async(req,res)=>{
  const {id} = req.params
  const result = await dataCollections.findOne({_id:new ObjectId(id)})
  res.send(result)
});
app.patch("/eventDetail/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const result = await dataCollections.updateOne(
    { _id: new ObjectId(id) },
    { $set: data }
  );

  res.json(result);
});

app.delete('/eventDetail/:id',async(req,res)=>{
  const{id} =req.params
  const result = await dataCollections.deleteOne({_id:new ObjectId(id)})
  res.json(result)
});


app.post("/joinEvent", async (req, res) => {
  const { eventId, userEmail } = req.body;

  try {
    // Event ache kina check
    const event = await dataCollections.findOne({
      _id: new ObjectId(eventId)
    });

    if (!event) {
      return res.status(404).send({
        message: "Event not found"
      });
    }

    // Age join koreche kina check
    const alreadyJoined = await joinedCollections.findOne({
      eventId: eventId,
      userEmail: userEmail
    });

    if (alreadyJoined) {
      return res.status(400).send({
        message: "You already joined this event"
      });
    }

    // Join data save
    const result = await joinedCollections.insertOne({
      eventId: eventId,
      userEmail: userEmail,
      joinedAt: new Date()
    });

    res.send({
      message: "Successfully joined the event",
      result
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to join event"
    });
  }
});
 

app.get("/joinedEvents/:email", async (req, res) => {

  const { email } = req.params;

  try {
    const joinedEvents = await joinedCollections
      .find({ userEmail: email })
      .toArray();

    const eventIds = joinedEvents.map(
      (item) => new ObjectId(item.eventId)
    );

    const events = await dataCollections
      .find({ _id: { $in: eventIds } })
      .sort({ eventDate: 1 })
      .toArray();

    res.send(events);

  } catch (error) {
    res.status(500).send({
      message: "Failed to get joined events"
    });
  }
});
//  join ses 



app.get("/recentEvents", async (req, res) => {
  try {
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const result = await dataCollections
      .find({ eventDate: { $gte: todayDate } })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to load recent events" });
  }
});



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})