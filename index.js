const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const admin = require('./firebase'); // ✅ correct

const app = express();
const port = process.env.PORT || 3000;


// index.js

//middleware

app.use(cors());
app.use(express.json())

const logger = (req, res, next) => {
    console.log('logging information');
    next();
}
const verifyFireBaseToken = async(req, res, next) => {
    //console.log('in the verify middleware', req.headers.authorization)
    if(!req.headers.authorization){
        // do not allow to go
            return res.status(401).send({message: 'unauthorized access' })
    }
    const token = req.headers.authorization.split(' ')[1];
    if(!token){
        return res.status(401).send({message: 'unauthorized access'})
    }

    try{
        const userInfo = await admin.auth().verifyIdToken(token);
        req.token_email = userInfo.email;
        console.log('after token validation', userInfo);
        next();
    }
    catch{
            return res.status(401).send({ message: 'unauthorized access'})
    }
    // verify token
};
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.otmudjl.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
    try{
        await client.connect();
            const db = client.db('smart_db');
            const productsCollection = db.collection('products');
                const bidsCollection = db.collection('bids');
                const usersCollection = db.collection('user');
            
                //jwt related api
                app.post('/getToken', (req, res) => {
                    const loggedUser = req.body;
                    const token = jwt.sign(loggedUser, process.env.JWT_SECRET, {expiresIn:'1hr'})
                    res.send({ token: token })
                })
            
            
                //users apis
            app.post('/users', async(req, res) => {
                const newUser = req.body;
                const email = req.body.email;
                const query = { email: email}
                const existingUser = await usersCollection.findOne(query);
                if(existingUser) {
                    res.send({message:'user already exits. do not need to insert again'})
                }
                else{
                    const result = await usersCollection.insertOne(newUser);
                    res.send(result);
                }

                
            })

            app.get('/my-products', verifyFireBaseToken, async (req, res) => {

                const email = req.token_email;

                const query = { email: email };

                const result = await productsCollection.find(query).toArray();
                res.send(result);
            })
            

            app.get('/latest-products', async(req, res) =>{
                const cursor = productsCollection.find().sort({create_at: -1}).limit(6);
                const result = await cursor.toArray();
                res.send(result);
            })

            app.get('/products/:id', async(req, res) =>{
                const id = req.params.id;
                const query = {
                    _id: new ObjectId(id)
                }
                const result = await productsCollection.findOne(query);
                res.send(result);
            }); 
            app.get('/all-products', async(req, res) => {
                const search = req.query.search;

                let query = {};
                if (search) {
                    query = {
                        $or: [
                            {title: { $regex: search, $options: "i"} },
                            { category: { $regex: search, $options: "i"} }
                        ]
                    };
                }
                const result = await productsCollection.find(query).toArray();
                res.send(result);
            });   

            app.post('/products', verifyFireBaseToken, async(req, res) => {
                console.log('headers in the post', req.headers)
                const newProduct = req.body;
                const result = await productsCollection.insertOne(newProduct)
                res.send(result);
            });

            app.patch('/products/:id', async(req, res) => {
                const id = req.params.id;
                const updatedProduct = req.body; 
                const query = { _id: new ObjectId(id)}
                const update = {
                    $set: {
                        ...updatedProduct
                    }
                }

                const result = await productsCollection.updateOne(query, update)
                console.log(result);
                res.send(result)
            });

            app.delete('/products/:id', async(req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id)}
                const result = await productsCollection.deleteOne(query);
                res.send(result);
            });

            //bids related apis
            app.get('/bids', logger, verifyFireBaseToken, async(req, res) => {
                    console.log('headers', req )
                    const email = req.query.email;
                    const query = {};
                    if(email){
                       
                        if(email !== req.token_email){
                            return res.status(403).send({ message: 'forbidden access' });
                       
                    }
                     query.buyer_email = email;
            }
               const cursor = bidsCollection.find(query);
                const result = await cursor.toArray();
                res.send(result);
            });

            app.get('/products/bids/:productId', async(req, res) => {
                const productId = req.params.productId;
                const query = {product: productId};
                const cursor = bidsCollection.find(query).sort({bid_price: -1})
                const result = await cursor.toArray();
                res.send(result)
            })
            
            app.post('/bids', async(req, res) =>{
                const newBid = req.body;

                const product = await productsCollection.findOne({
                    _id: new ObjectId(newBid.product)
                });
                newBid.product_title = product?.title;
                newBid.product_image = product?.image;
                newBid.product_price_min = product?.price_min;

                const result= await bidsCollection.insertOne(newBid);
                res.send(result)
            })
            app.delete('/bids/:id', async(req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id)}
                const result = await bidsCollection.deleteOne(query);
                res.send(result);
            });
            app.patch('/bids/:id', async(req, res) => {
                const id = req.params.id;
                const updatedBids = req.body; 
                const query = { _id: new ObjectId(id)}
                const update = {
                    $set: {
                        name: updatedBids.name,
                        price: updatedBids.price
                    }
                }

                const result = await bidsCollection.updateOne(query, update)
                res.send(result)
            });

        await client.db("admin").command({ ping: 1});
        console.log("ping your deployment. you successfully connected to mongodb");
    }
    finally{

    }
}

run().catch(console.dir)



app.listen(port, () => {
    console.log(`smart server is running in port: ${port}`)
})