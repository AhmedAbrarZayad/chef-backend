const express = require('express')
const cors = require('cors')
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://restaurant-c51e9.web.app'],
  credentials: true
}))
app.use(express.json())


var admin = require("firebase-admin");
// const serviceAccount = require("./firebase-admin-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

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
    //await client.db("admin").command({ ping: 1 });
    db = client.db("meals");
    meals = db.collection("meals");
    reviews = db.collection("reviews");
    favourites = db.collection("favourites");
    orders = db.collection("orders");
    users = db.collection("users");
    paymentCollection = db.collection("payments");
    requests = db.collection("requests");
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);



// Firebase Auth Middleware
const verifFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized' });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decodedEmail = decoded.email;
  } catch (err) {
    return res.status(401).send({ message: 'Unauthorized' });
  }
  next();
};

const verifyAdmin = async (req, res, next) => {
  const email = req.decodedEmail;
  const query = {email: email};
  const user = await users.findOne(query);
  if (!user || user.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};
const verifyChef = async (req, res, next) => {
  const email = req.decodedEmail;
  const query = {email: email};
  const user = await users.findOne(query);
  if (!user || user.role !== 'chef') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};
// Meals
app.post('/addMeal', verifFirebaseToken, verifyChef, async (req, res) => {
    const meal = req.body;
    
    // Check if user is marked as fraud
    const user = await users.findOne({ email: meal.userEmail });
    if (user?.fraud === "yes") {
        return res.status(403).send({ error: 'Fraud users cannot create meals' });
    }
    
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

app.get('/chef-meals', verifFirebaseToken, verifyChef, async (req, res) => {
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

app.get('/meal/:id',verifFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const meal = await meals.findOne(query);
    res.send(meal);
})

app.delete('/delete-meal/:id', verifFirebaseToken, verifyChef, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await meals.deleteOne(query);
    res.send(result);
})

app.patch('/update-meal/:id', verifFirebaseToken, verifyChef, async (req, res) => {
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
app.post('/addReview', verifFirebaseToken, async (req, res) => {
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

app.get('/reviews/:id', verifFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const query = { foodId: id };
    const cursor = reviews.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

app.delete('/reviews/:reviewId', verifFirebaseToken, async (req, res) => {
    const reviewId = req.params.reviewId;
    const query = { _id: new ObjectId(reviewId) };
    const result = await reviews.deleteOne(query);
    res.send(result);
})

app.patch('/reviews/:reviewId', verifFirebaseToken, async (req, res) => {
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
app.post('/addFavourite', verifFirebaseToken, async (req, res) => {
    const favourite = req.body;
    const result = await favourites.insertOne(favourite);
    res.send(result);
})

app.delete('/removeFavourite', verifFirebaseToken, async (req, res) => {
    const userEmail = req.query.userEmail;
    const mealId = req.query.mealId;
    const query = { userEmail: userEmail, mealId: mealId };
    const result = await favourites.deleteOne(query);
    res.send(result);
})

app.get('/favourites', verifFirebaseToken, async (req, res) => {
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

app.post('/addOrder', verifFirebaseToken, async (req, res) => {
    const order = req.body;
    
    // Check if user is marked as fraud
    const user = await users.findOne({ email: order.userEmail });
    if (user?.fraud === "yes") {
        return res.status(403).send({ error: 'Fraud users cannot place orders' });
    }
    
    const result = await orders.insertOne(order);
    res.send(result);
})

app.get('/orders', verifFirebaseToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;
    const skip = (page - 1) * limit;
    const query = {};
    const email = req.query.email;
    if (email) {
      query.userEmail = email;
    }
    query.orderStatus = { $ne: "delivered" };
    const total = await orders.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    const cursor = orders.find(query).skip(skip).limit(limit);
    const result = await cursor.toArray();
    res.send({ totalPages, items: result });
})

app.get('/pending-orders', verifFirebaseToken, async (req, res) => {
    const chefId = req.query.chefId;
    //console.log(chefId);
    const query = { orderStatus: { $ne: "delivered" }, chefId: chefId };
    const cursor = orders.find(query);
    const result = await cursor.toArray();
    //console.log(result);
    res.send(result);
})

app.patch('/update-order-status/:id', verifFirebaseToken, async (req, res) => {
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

app.get('/users', verifFirebaseToken, async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const cursor = users.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

app.get('/all-users', verifFirebaseToken, async (req, res) => {
    const cursor = users.find();
    const result = await cursor.toArray();
    res.send(result);
})

app.patch('/update-fraud-status/:id', verifFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const update = {
      $set: {
        fraud: req.body.fraudStatus
      }
    }
    const filter = { _id: new ObjectId(id) };
    const result = await users.updateOne(filter, update);
    res.send(result);
})

app.get('/check-fraud/:email', verifFirebaseToken, async (req, res) => {
    const email = req.params.email;
    const query = { email: email };
    const user = await users.findOne(query);
    res.send({ fraud: user?.fraud || false });
})

app.get('/user-role', verifFirebaseToken, async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const user = await users.findOne(query);
    //console.log(user?.role);
    res.send({ role: user?.role || 'user' });
})


// Requests
app.post('/addRequest', verifFirebaseToken, async (req, res) => {
    const request = req.body;
    const result = await requests.insertOne(request);
    res.send(result);
})

app.get('/pending-requests', verifFirebaseToken, async (req, res) => {
    const query = { requestStatus: "pending" };
    const cursor = requests.find(query);
    const result = await cursor.toArray();
    res.send(result);
})

app.patch('/approve-request/:id', verifFirebaseToken, async (req, res) => {
    const id = req.params.id;
    console.log(id);
    const { requestType, userId } = req.body;
    
    try {
        // Update request status to approved
        await requests.updateOne(
            { _id: new ObjectId(id) },
            { $set: { requestStatus: "approved" } }
        );
        
        // Update user role based on request type
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { role: requestType } }
        );
        
        res.send({ success: true, message: "Request approved successfully" });
    } catch (error) {
        res.status(500).send({ error: "Failed to approve request" });
    }
})

app.patch('/reject-request/:id', verifFirebaseToken, async (req, res) => {
    const id = req.params.id;
    
    try {
        // Update request status to rejected
        await requests.updateOne(
            { _id: new ObjectId(id) },
            { $set: { requestStatus: "rejected" } }
        );
        
        res.send({ success: true, message: "Request rejected successfully" });
    } catch (error) {
        res.status(500).send({ error: "Failed to reject request" });
    }
})


// Payment

app.patch('/payment-success', verifFirebaseToken, async (req, res) => {
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

app.post('/create-checkout-session', verifFirebaseToken, async (req, res) => {
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


// Statistics

app.get('/total-payments', verifFirebaseToken, verifyAdmin, async (req, res) => {
  const payments = await paymentCollection.find({ paymentStatus: "paid" }).toArray();
  const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalPayments = payments.length;
  res.send({ totalPaymentAmount, totalPayments });
})

app.get('/total-users', verifFirebaseToken, verifyAdmin, async (req, res) => {
  const totalUsers = await users.countDocuments();
  res.send({ totalUsers });
})

app.get('/pending-orders-count', verifFirebaseToken, verifyAdmin, async (req, res) => {
  const pendingOrders = await orders.countDocuments({ orderStatus: { $ne: "delivered" } });
  res.send({ pendingOrders });
})

app.get('/delivered-orders-count', verifFirebaseToken, verifyAdmin, async (req, res) => {
  const deliveredOrders = await orders.countDocuments({ orderStatus: "delivered" });
  res.send({ deliveredOrders });
})

app.get('/statistics-chart-data', verifFirebaseToken, verifyAdmin, async (req, res) => {
  try {
    // Order status breakdown
    const pending = await orders.countDocuments({ orderStatus: "pending" });
    const preparing = await orders.countDocuments({ orderStatus: "preparing" });
    const delivered = await orders.countDocuments({ orderStatus: "delivered" });
    
    // User role breakdown
    const regularUsers = await users.countDocuments({ role: "user" });
    const chefs = await users.countDocuments({ role: "chef" });
    const admins = await users.countDocuments({ role: "admin" });
    
    // Payment breakdown
    const paidOrders = await orders.countDocuments({ paymentStatus: "paid" });
    const pendingPayments = await orders.countDocuments({ paymentStatus: "Pending" });
    
    res.send({
      orderStatus: [
        { name: "Pending", value: pending },
        { name: "Preparing", value: preparing },
        { name: "Delivered", value: delivered }
      ],
      userRoles: [
        { name: "Users", value: regularUsers },
        { name: "Chefs", value: chefs },
        { name: "Admins", value: admins }
      ],
      paymentStatus: [
        { name: "Paid", value: paidOrders },
        { name: "Pending", value: pendingPayments }
      ]
    });
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch chart data" });
  }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
