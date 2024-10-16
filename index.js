const express = require("express")
const cors = require("cors")
const app = express()
require('dotenv').config()
const port = process.env.PORT || 7000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const jwt = require('jsonwebtoken');


app.use(express.json())
app.use(cors())



// verify token
const verifyToken = (req,res,next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({message: 'Invalid Authorization'})
    };

    const token = authorization.split(' ')[0]
    jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded)=> {
        if (err) {
            return res.status(403).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next()
    })

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lskduub.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // create a databse and db collections
    const classCollection = client.db('ClassBazar').collection('classes')
    const usersCollection = client.db('ClassBazar').collection('users')
    const cartCollection = client.db('ClassBazar').collection('cart')
    const paymentCollection = client.db('ClassBazar').collection('payments')
    const enrolledCollection = client.db('ClassBazar').collection('enrolled')
    const applicationCollection = client.db('ClassBazar').collection('applied')



    // api token generate
    app.post('/api-set-token', async (req,res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.SECRET_TOKEN, {
            expiresIn: "24h"
        });
        res.send({token})
    })

    // middleare for admin and instrcutors
    const verifyAdmin = async (req,res,next) => {
        const email = req.decoded.email;
        const query = {email: email}
        const user = await usersCollection.findOne(query);
        if (user.role === 'admin') {
            next()
        } else {
           return res.status(401).send({message: 'Unauthorize Access'})
        }
    }


    const verifyInstructors = async (req, res, next) => {
        const email = req.decoded.email;
        const query = {email: email};
        const user = await usersCollection.findOne(query);
        if (user.role === "intructor") {
            next()
        } else {
            return res.status(401).send({message: 'Unauthorize Access'})
        }
    }

    // new users
    app.post('/new-user', async (req,res) => {
        const newUser = req.body;
        const result = await usersCollection.insertOne(newUser);
        res.send(result)
    })

    // get users
    app.get('/users', async (req, res) => {
        const result = await usersCollection.find({}).toArray();
        res.send(result)
    })

    app.get('/users/:id', async (req,res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await usersCollection.findOne(query);
        res.send(result)
    })


    app.get('/users/:email',verifyToken, async (req,res) => {
        const email = req.params.email;
        const query = {email: email};
        const result = await usersCollection.findOne(query);
        res.send(result)
    })


    app.delete('/delete-user/:id', verifyToken, verifyAdmin, async (req,res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await usersCollection.deleteOne(query);
        res.send(result)
    })

    app.put('/update-user/:id', verifyToken, verifyAdmin, async (req,res) => {
        const id = req.params.id;
        const updatedUser = req.body;
        const filter = {_id: new ObjectId(id)};
        const options = {upsert: true}
        const updatedDoc= {
            $set: {
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.option,
                address: updatedUser.address,
                about: updatedUser.about,
                photoUrl: updatedUser.photoUrl,
                skills: updatedUser.skils ? updatedUser.skils : null,
            }
        }
        const result = await usersCollection.updateOne(filter, updatedDoc, options);
        res.send(result)

    })


    // classes router here
    app.post('/new-class', verifyToken, verifyInstructors, async(req,res)=> {
        const newClass = req.body;
        const result = await classCollection.insertOne(newClass);
        res.send(result)
    })

    app.get('/classes', async(req,res)=> {
        const query = {status: 'approved'};
        const result = await classCollection.find(query).toArray()
        res.send(result)
    })

    // get class by instructor email
    app.get('/classes/:email',verifyToken, verifyInstructors, async(req,res)=> {
        const email = req.params.email;
        const query = {instructorEmail: email}
        const result = await classCollection.find(query).toArray();
        res.send(result)
    })

    // manage classes
    app.get('/class-manage', async (req,res) => {
        const result = await classCollection.find().toArray();
        res.send(result)
    })

    // update class
    app.patch('/change-status/:id', verifyToken, verifyAdmin, async (req,res) => {
        const id = req.params.id;
        const status = req.body.status;
        const reason = req.body.reason;
        const filter = {_id: new ObjectId(id)};
        const options = {upsert: true};
        const updatedDoc = {
            $set: {
                status: status,
                reason: reason,
            }
        }
        const result = await classCollection.updateOne(filter, updatedDoc, options);
        res.send(result)
    })

    // get approved classes
    app.get('/approved-classes', async(req,res)=> {
        const query = {status: 'approved'};
        const result = await classCollection.find(query).toArray()
        res.send(result)
    })

    // get single classes
    app.get('/classes/:id', async (req,res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await classCollection.find(query).toArray();
        res.send(result)
    })


    // updatting class details
    app.put('/upadte-class/:id', verifyToken, verifyInstructors,async (req,res) => {
        const id = req.params.id;
        const updateClass = req.body;
        const filter = {_id: new ObjectId(id)}
        const options = {upsert: true}
        const updateDoc = {
            $set: {
                name: updateClass.name,
                description: up.description,
                price: updateClass.price,
                availableSeats: parseInt(updateClass.availableSeats),
                videoLink: updateClass.videoLink,
                status: 'pending',

            }
        };
        const result = await classCollection.updateOne(filter, updateDoc, options);
        res.send(result)
    })


    // cart routes
    app.post('/add-to-cart', verifyToken, async (req,res) => {
        const newCart = req.body;
        const result = await cartCollection.insertOne(newCart)
        res.send(result)
    })


    // get cart item
    app.get('/cart-item/:id', verifyToken, async (req,res) => {
        const id = req.params.id;
        const email = req.body.email;
        const query = {
            classId: id,
            userEmail: email
        };
        const projection = {classId: 1};
        const result = await cartCollection.findOne(query, {projection: projection});
        res.send(result)
    });

    // cart info by user email
    app.get('/cart/:email', verifyToken, async (req,res) => {
        const email = req.params.email;
        const query = {userMail: email}
        const projection = {classId: 1}
        const carts = await cartCollection.find(query, {projection: projection})
        const classIds = carts.map((cart)=> new ObjectId(cart.classId))
        const query2 = {_id: {$in: classIds}}
        const result = await classCollection.find(query2).toArray()
        res.send(result)
    })

    // delete cart item
    app.delete('/delete-cart-item/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = {classId: id}
      const result = await classCollection.deleteOne(query)
      res.send(result)
    })


    // payment routes
    app.post('/create-payment-intent', async (req,res) => {
        const {price} = req.body;
        const amount = parseInt(price) * 100;

        // create paymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ["card"]
        });
        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    })


    // post payment info to DB
    app.post('/payment-info', verifyToken, async (req, res) => {
        const paymentInfo = req.body;
        const classesId = paymentInfo.classesId;
        const userEmail = paymentInfo.userEmail;
        const singleClassId = req.query.classId;
        let query;
        if (singleClassId) {
            query = {classId: singleClassId, userMail: userEmail};
        } else {
            query = {classId: {$in: classesId}};
        };
        const classesQuery = {_id: {$in: classesId.map(id => new ObjectId(id))}};
        const classes = await classCollection.find(classesQuery).toArray()
        const newEnrolledData = {
            userMail: userEmail,
            classId: singleClassId.map(id => new ObjectId(id)),
            trasnsactionId: paymentInfo.trasnsactionId,
        };
        const updateDoc = {
            $set: {
                totalEnrolled: classes.reduce((total, current)=> total + current.totalEnrolled, 0) * 1 || 0,
                availableSeats: classes.reduce((total, current)=> total + current.availableSeats, 0) - 1 || 0
            }
        };

        const updatedResult = await classCollection.updateMany(classesQuery, updateDoc,{upsert: true});
        const enrolledRessult = await enrolledCollection.insertOne(newEnrolledData);
        const deletedResult = await cartCollection.deleteMany(query);
        const paymentResult = await paymentCollection.insertOne(paymentInfo)
        res.send({paymentResult, deletedResult, enrolledRessult, updatedResult})
    });


    // get payment history
    app.get('/payment-history/:email', async (req,res) => {
        const email = req.params.email;
        const query = {userMail: email}
        const result = await paymentCollection.find(query).sort({date: -1}).toArray();
        res.send(result)
    })

    // payment history length
    app.get('/payment-history-length/:email', async (req,res) => {
        const email = req.params.email;
        const query = {userMail: email}
        const total = await paymentCollection.countDocuments(query);
        res.send({total})
    })

    // Enrollment routes
    app.get('/popular_classes', async (req,res) => {
        const result = await classCollection.find().sort({totalEnrolled: -1}).limit(6).toArray()
        res.send(result)
    })

    app.get('/popular-instructors', async (req,res) => {
        const pipeline = [
            {
                $group: {
                    _id: "$instructorEmail",
                    totalEnrolled: {$sum: "$totalEnrolled"}
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "email",
                    as: "instructor"
                }
            },
            {
                $project: {
                    _id: 0,
                    insturctor: {
                        $arrayElemAt: ["$instructor", 0]
                    },
                    totalEnrolled: 1
                }
            },
            {
                $sort: {
                    totalEnrolled: -1
                }
            },
            {
                $limit: 6
            }
        ];
        const result = await classCollection.aggregate(pipeline).toArray();
        res.send(result)
    })


    // Admin Status
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req,res) => {
        const approvedClasses = ((await classCollection.find({status: 'approved'})).toArray()).length;
        const pendingClasses = ((await classCollection.find({status: 'pending'})).toArray()).length;
        const instructors = ((await usersCollection.find({role: 'instructor'})).toArray()).length;
        const totalClasses = (await classCollection.find().toArray()).length;
        const totalEnrolled = (await enrolledCollection.find().toArray()).length;

        const result = {
            approvedClasses,
            pendingClasses,
            instructors,
            totalClasses,
            totalEnrolled
        }
        res.send(result)
    })

    // get all instrcutor
    app.get('/instrcutors', async (req,res) => {
        const result = await usersCollection.find({role: 'instrcutor'}).toArray();
        res.send(result)
    })

    app.get('/enrolled-classes/:email', verifyToken, async (req,res) => {
        const email = req.params.email;
        const query = {userEmail: email}
        const pipeline = [
            {
                $match: query
            },
            {
                $lookup: {
                    from: "classes",
                    localField: "classesId",
                    foreignField: "_id",
                    as: "classes"
                }
            },
            {
                $unwind: "$classes"
            },
            {
                $lookup: {
                    from: "users",
                    localField: "classes.instructorEmail",
                    foreignField: "email",
                    as: "instructor"
                }
            },
            {
                $project: {
                    _id: 0,
                    instructor: {
                        $arrayElemAt: ["$instructor", 0],
                    },
                    classes: 1
                }
            }
        ];

        const result = await enrolledCollection.aggregate(pipeline).toArray();
        res.send(result)
    })


    // appliend for instructors
    app.post('/ass-instructor', async (req,res) => {
        const data = req.body;
        const result = await applicationCollection.insertOne(data);
        res.send(result)
    })


    app.get('/applied-instructors/:email', async (req, res) => {
        const email = req.params.email;
        const result = await applicationCollection.findOne({email});
        res.send(result)
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);




app.get('/', (req,res)=> {
    res.send("Class Bazar Is Running")
})
app.listen(port, ()=> {
    console.log(`Class Bazar Is Running ${port}`)
})
