const express = require('express')
const cors = require('cors')
require('dotenv').config();

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

var admin = require("firebase-admin");

var serviceAccount = require("./restaurant-c51e9-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


app.get('/', (req, res) => {
  res.send('Hello World!')
})



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://ahmedabrarzayad_db_user:${process.env.MONGO_PASS}@cluster0.ccvlctc.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
let db;
let meals, reviews;
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    db = client.db("meals");
    meals = db.collection("meals");
    reviews = db.collection("reviews");
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


// Meals
app.post('/addMeal', async (req, res) => {
    const meal = req.body;
    const result = await meals.insertOne(meal);
    res.send(result);
});

app.get('/all-meals', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12; // default page size
        const skip = (page - 1) * limit;
        const search = req.query.search || ''; // search term
        const sortBy = req.query.sortBy || 'foodName'; // default sort field
        const order = req.query.order === 'desc' ? -1 : 1; // sort order
        //console.log({page, limit, skip, search, sortBy, order});

        // Build filter
        const filter = {};
        if (search) {
            // Case-insensitive search across multiple fields
            filter.$or = [
                { foodName: { $regex: search, $options: 'i' } },
                { chefName: { $regex: search, $options: 'i' } },
                { deliveryArea: { $regex: search, $options: 'i' } },
            ];
        }

        // Build sort
        const sortOptions = {};
        sortOptions[sortBy] = order;

        const total = await meals.countDocuments(filter);
        const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

        const cursor = meals.find(filter)
                            .sort(sortOptions)
                            .skip(skip)
                            .limit(limit);
        const result = await cursor.toArray();

        res.send({ totalPages, items: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/meal/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const meal = await meals.findOne(query);
    res.send(meal);
})


// Reviews
app.post('/addReview', async (req, res) => {
    const review = req.body;
    const result = await reviews.insertOne(review);
    res.send(result);
})

app.get('/all-reviews', async (req, res) => {
    const limit = parseInt(req.query.limit) || 0;
    const query = {}
    const cursor = reviews.find(query).limit(limit);
    const result = await cursor.toArray();
    res.send(result);
})

app.get('/reviews/:id', async (req, res) => {
    const id = req.params.id;
    const query = { foodId: id };
    const cursor = reviews.find(query);
    const result = await cursor.toArray();
    res.send(result);
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
