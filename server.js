require("dotenv").config();
require("express-async-handler");
const express = require("express");
const app = express();
const cloudinary = require('cloudinary').v2;
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser =require("cookie-parser")
const path = require("path");
const serverPath = path.resolve(__dirname, "server.js");
require(serverPath);


// Configure Cloudinary with your credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
  });
  
  //==============================middlewares:

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(cors({
  origin:["http://localhost:3000"],
  credentials:true
}));

app.use(express.json());

//Routes:
app.get("/", (req, res) => {
  res.send(`Server now running`);
});

// error middleware here

const PORT =  process.env.PORT || 10000

const start = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      app.listen(PORT, "localhost", () => {
        console.log("connected to DB");
        console.log(`Server listening on port ${PORT}`);
      });
    } catch (error) {
      console.log(error);
    }
  };
  start();

