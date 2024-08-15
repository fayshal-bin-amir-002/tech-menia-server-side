const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const user = process.env.DB_USER;
const pass = process.env.DB_PASS;
const secret_access_token = process.env.SECRET_ACCESS_TOKEN;

const uri = `mongodb+srv://${user}:${pass}@cluster0.0hiczfr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const database = client.db("techMeniaDB");
        const productsCollection = database.collection("products");
        const usersCollection = database.collection("users");

        //<---middleware for verify token--->
        const verifyToken = async (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "Unauthorized Access" });
            }

            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, secret_access_token, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: "Unauthorized Access" });
                }
                req.decoded = decoded;
                next();
            })
        }

        //<---jwt token req--->
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, secret_access_token, { expiresIn: "1h" });
            res.send({ token: token });
        })

        //<---save a user to db--->
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user?.email };
            const isExist = await usersCollection.findOne(query);

            if (isExist) return res.send({ message: "User already exists!" });

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        //<---api for get all device data--->
        app.get("/products", async (req, res) => {

            const page = parseInt(req.query.page);
            const filterData = JSON.parse(req.query.filterData);

            let query = {};

            if (filterData.search) {
                query = { productName: { $regex: filterData.search, $options: 'i' } }
            }

            if (filterData.brand.length > 0) {
                query.brandName = { $in: filterData.brand };
            }

            if (filterData.category.length > 0) {
                query.category = { $in: filterData.category };
            }

            if (filterData.priceRange.length > 0) {
                query.price = { $gte: Number(filterData.priceRange[0]), $lte: Number(filterData.priceRange[1]) };
            }

            let sortingOptions = {};

            if (filterData.priceSorting === 'lth') {
                sortingOptions.price = 1;
            } else if (filterData.priceSorting === 'htl') {
                sortingOptions.price = -1;
            }

            if (filterData.dateSorting) {
                sortingOptions.productCreationDate = -1;
            } else if (filterData.dateSorting === false) {
                sortingOptions.productCreationDate = 1;
            }


            const total = await productsCollection.countDocuments(query);
            const result = await productsCollection.find(query).sort(sortingOptions).skip(page * 12).limit(12).toArray();

            res.send({ result, total });
        })

        //<---api for get all devices brand name and category--->
        app.get("/filterData", async (req, res) => {
            const brandNames = await productsCollection.aggregate([
                { $group: { _id: "$brandName" } }
            ]).toArray();

            const categories = await productsCollection.aggregate([
                { $group: { _id: "$category" } }
            ]).toArray();

            res.send({ brandNames, categories });

        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})