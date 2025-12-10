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
let meals, reviews, favourites, orders, users, requests;
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    db = client.db("meals");
    meals = db.collection("meals");
    reviews = db.collection("reviews");
    favourites = db.collection("favourites");
    orders = db.collection("orders");
    users = db.collection("users");
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
    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 0;
    const skip = (page - 1) * limit;
    const query = {}
    const name = req.query.name;
    if (name) {
      query.reviewerName = name;
    }
    const total = await reviews.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    //console.log({page, limit, skip, email});
    const cursor = reviews.find(query).skip(skip).limit(limit);
    const result = await cursor.toArray()
    res.send({ totalPages, items: result });
})

app.get('/reviews/:id', async (req, res) => {
    const id = req.params.id;
    const query = { foodId: id };
    const cursor = reviews.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

app.delete('/reviews/:reviewId', async (req, res) => {
    const reviewId = req.params.reviewId;
    const query = { _id: new ObjectId(reviewId) };
    const result = await reviews.deleteOne(query);
    res.send(result);
})

app.patch('/reviews/:reviewId', async (req, res) => {
    const reviewId = req.params.reviewId;
    const updatedReview = req.body;
    const filter = { _id: new ObjectId(reviewId) };
    const updateDoc = {
        $set: {
            rating: updatedReview.rating,
            comment: updatedReview.comment,
        }
    }
    const result = await reviews.updateOne(filter, updateDoc);
    res.send(result);
})

// Favourites
app.post('/addFavourite', async (req, res) => {
    const favourite = req.body;
    const result = await favourites.insertOne(favourite);
    res.send(result);
})

app.delete('/removeFavourite', async (req, res) => {
    const userEmail = req.query.userEmail;
    const mealId = req.query.mealId;
    const query = { userEmail: userEmail, mealId: mealId };
    const result = await favourites.deleteOne(query);
    res.send(result);
})

app.get('/favourites', async (req, res) => {
    const userEmail = req.query.userEmail;
    const mealId = req.query.mealId;
    const query = { userEmail: userEmail };
    if(mealId){
        query.mealId = mealId;
    }
    const cursor = favourites.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

// Orders

app.post('/addOrder', async (req, res) => {
    const order = req.body;
    const result = await orders.insertOne(order);
    res.send(result);
})

app.get('/orders', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;
    const skip = (page - 1) * limit;
    const query = {};
    const email = req.query.email;
    if (email) {
        query.userEmail = email;
    }
    const total = await orders.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    const cursor = orders.find(query).skip(skip).limit(limit);
    const result = await cursor.toArray();
    res.send({ totalPages, items: result });
})

// Users

app.post('/addUsers', async (req, res) => {
    const user = req.body;
    const result = await users.insertOne(user);
    res.send(result);
})

app.get('/users', async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const cursor = users.find(query);
    const result = await cursor.toArray();
    res.send(result);
})


// Requests
app.post('/addRequest', async (req, res) => {
    const request = req.body;
    const result = await requests.insertOne(request);
    res.send(result);
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
