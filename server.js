require("dotenv").config();
require("express-async-handler");
const express = require("express");
const app = express();
const cloudinary = require('cloudinary').v2;
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser =require("cookie-parser")
const path = require("path");
const errorMiddleware = require("./middleware/error-handler");
const serverPath = path.resolve(__dirname, "server.js");
require(serverPath);
const adminRoute = require('./routes/adminRoutes')
const userRoute = require('./routes/userRoutes')
const walletRoute = require('./routes/walletRoutes')
const initCronJobs = require('./utils/cronJob');
// Configure Cloudinary with your credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  
  //==============================middlewares:

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(cors({
  origin:["https://unityfinance.online","http://localhost:5173","https://unity-lnjl.onrender.com"],
  credentials:true
}));


app.use(express.json());

//Routes:
app.get("/", (req, res) => {
  res.send(`Server now running`);
});

app.use("/api/v1/admin",adminRoute);
app.use("/api/v1/user",userRoute);
app.use("/api/v1/user",walletRoute);
// error middleware here
app.use(errorMiddleware)
// reuploading the server
const PORT =  process.env.PORT || 10000

const start = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      app.listen(PORT,  () => {
        console.log("connected to DB");
        console.log(`Server listening on port ${PORT}`);
        
        // Initialize cron jobs after server starts
        initCronJobs();
      });
    } catch (error) {
      console.log(error);
    }
  };
  start();

