const express = require('express')
const cors = require('cors')
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
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



function generateTrackingId() {
  const prefix = "LOC";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${prefix}-${date}-${randomBytes}`;
}


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
let meals, reviews, favourites, orders, users, requests, paymentCollection;
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
    paymentCollection = db.collection("payments");
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

app.get('/chef-meals', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12; // default page size
        const skip = (page - 1) * limit;
        //const search = req.query.search || ''; // search term
        //const sortBy = req.query.sortBy || 'foodName'; // default sort field
        //const order = req.query.order === 'desc' ? -1 : 1; // sort order
        const chefEmail = req.query.email;
        //console.log({page, limit, skip, search, sortBy, order});

        // Build filter
        const filter = {};

        filter.userEmail = chefEmail;

        const total = await meals.countDocuments(filter);
        const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

        const cursor = meals.find(filter)
                            .skip(skip)
                            .limit(limit);
        const result = await cursor.toArray();

        res.send({ totalPages, items: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
})

app.get('/meal/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const meal = await meals.findOne(query);
    res.send(meal);
})

app.delete('/delete-meal/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await meals.deleteOne(query);
    res.send(result);
})

app.patch('/update-meal/:id', async (req, res) => {
    const id = req.params.id;
    const updatedMeal = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
          foodName: updatedMeal.foodName,
          foodImage: updatedMeal.foodImage,
          price: updatedMeal.price,
          rating: updatedMeal.rating,
          ingredients: updatedMeal.ingredients,
          estimatedDeliveryTime: updatedMeal.estimatedDeliveryTime,
          chefExperience: updatedMeal.chefExperience,
        }
    }
    const result = await meals.updateOne(filter, updateDoc);
    res.send(result);
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
    query.paymentStatus = "Pending";
    const total = await orders.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    const cursor = orders.find(query).skip(skip).limit(limit);
    const result = await cursor.toArray();
    res.send({ totalPages, items: result });
})

app.get('/pending-orders', async (req, res) => {
    const chefId = req.query.chefId;
    console.log(chefId);
    const query = { orderStatus: { $ne: "delivered" }, chefId: chefId };
    const cursor = orders.find(query);
    const result = await cursor.toArray();
    //console.log(result);
    res.send(result);
})

app.patch('/update-order-status/:id', async (req, res) => {
    const id = req.params.id;
    const updatedStatus = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
          orderStatus: updatedStatus.orderStatus,
        }
    }
    const result = await orders.updateOne(filter, updateDoc);
    res.send(result);
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

app.get('/user-role', async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const user = await users.findOne(query);
    //console.log(user?.role);
    res.send({ role: user?.role || 'user' });
})


// Requests
app.post('/addRequest', async (req, res) => {
    const request = req.body;
    const result = await requests.insertOne(request);
    res.send(result);
})


// Payment

app.patch('/payment-success', async (req, res) => {
  const sessionId = req.query.session_id;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const transactionId = session.payment_intent;

  const exists = await paymentCollection.findOne({ transactionId });
  if (exists) return res.send({ message: "Payment already processed" });

  if (session.payment_status === "paid") {
    const trackingId = generateTrackingId();

    await paymentCollection.insertOne({
      amount: session.amount_total / 100,
      currency: session.currency,
      orderId: session.metadata.orderId,
      transactionId,
      paymentDate: new Date(),
      paymentStatus: "paid",
      customerEmail: session.customer_email
    });

    await orders.updateOne(
      { _id: new ObjectId(session.metadata.orderId) },
      { $set: { paymentStatus: "paid", trackingId } }
    );

    // Log track start
    // await logTracking(trackingId, "pending", session.customer_email);
  }

  res.send({ success: true });
});

app.post('/create-checkout-session', async (req, res) => {
  const info = req.body;
  const session = await stripe.checkout.sessions.create({
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: info.id },
        unit_amount: Math.round(info.cost * 100),
      },
      quantity: 1
    }],
    customer_email: info.senderEmail,
    mode: "payment",
    metadata: { orderId: info.id },
    success_url: `${process.env.DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.DOMAIN}/payment-failed`,
  });

  res.send({ url: session.url });
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
