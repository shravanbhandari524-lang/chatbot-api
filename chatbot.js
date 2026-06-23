import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
dotenv.config({ quiet: true });
const app = express();
app.use(express.json());
/////////////////////////////////////////////////////////////////////////////////////////////////////////
const connectdb = async () => {
  try {
    console.log("trying to connect to sealinedb ......");
    await mongoose.connect(process.env.CLOUDDB_URL);
    console.log("DB sealinedb connected");
  } catch (err) {
    console.log(err);
  }
};
//---------------------------------------------------------------------------------------------------------
const queSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  service: {
    type: String,
    enum: ["fuel", "food", "other"],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  typed: {
    type: String,
    enum: ["s", "d"],
    required: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
});
queSchema.index({ location: "2dsphere" });
queSchema.index(
  { user_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isUsed: false,
    },
  },
);
const Que = mongoose.model("Que", queSchema);
//////////////////////////////////////////////////////////////////////////////////
const ask = async (req, res, next) => {
  req.user = {
    uuid: req.headers["x-user-id"],
    role: req.headers["x-user-role"],
    typed: req.headers["x-user-typed"],
  };
  if (req?.user?.typed != "d") {
    return res.status(403).json({ success: false, message: "not allowed" });
  }
  try {
    const prompt = `
Extract:
- service
- quantity

Return ONLY valid JSON:

{"service":"string","quantity":"string"}

Rules:
- Allowed services are only: fuel, food.
- Any fuel type (diesel, petrol, gasoline, furnace oil, crude oil, fuel oil) maps to "fuel".
- Any meal, catering, snacks, lunch, dinner, breakfast, or food supply maps to "food".
- If the request is not for fuel or food, set service to "none".
- Extract the amount and units into quantity.
- If quantity is missing, set quantity to "none".
- If no valid fuel or food request exists, return:
{"service":"none","quantity":"none"}

Input:
${req.body.input}
`;
    +"\n\n Input " + req.body.input;
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "qwen2.5:0.5b",

      prompt: prompt,

      stream: false,

      options: {
        temperature: 0,
        top_p: 0.1,
        num_predict: 50,
      },
    });
    const raw = response.data.response;

    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const fields = JSON.parse(cleaned);
    req.user.service = fields.service;
    req.user.qauntity = fields.quantity;
    next();
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "internal server error" });
  }
};
//---------------------------------------------------------------------------------------------------------------------
const fetchDB = async (req, res) => {
  try {
    const ships = await Que.find({
      service: req.user.service,
      quantity: { $gte: req.user.qauntity },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [req.body.coordinates[0], req.body.coordinates[1]],
          },
          $maxDistance: 50000,
        },
      },
    }).limit(5);

    res.json(ships);
  } catch (err) {
    console.log(err);
    res.status(500).json("internal server error");
  }
};
//---------------------------------------------------------------------------------------------------------------------
const insertDB = async (req, res, user) => {
  req.user = {
    id: req.headers["x-user-id"],
    role: req.headers["x-user-role"],
    typed: req.headers["x-user-typed"],
    service: req.body.service,
    qauntity: req.body.qauntity,
    coordinates: req.body.coordinates,
  };
  try {
    if (
      !req.user.id ||
      !req.user.role ||
      !req.user.typed ||
      !req.user.service ||
      !req.user.qauntity ||
      !req.user.coordinates
    ) {
      return res
        .status(400)
        .json({ success: false, message: "fill all fields", field: req.user });
    }
    if (req?.user?.typed != "s") {
      return res.status(403).json({ success: false, message: "not allowed" });
    }
    const newQue = await Que.create({
      user_id: req.user.id,
      service: req.user.service,
      typed: req.user.typed,
      quantity: req.user.qauntity,
      location: {
        coordinates: req.user.coordinates,
      },
    });
    console.log("-------------------\n-", newQue);
    res.json(newQue);
  } catch (err) {
    console.log(err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User already has an active request",
      });
    }

    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }
    req.status(500).json({ success: false, message: "internal server error" });
  }
};
////////////////////////////////////////////////////////////////////////////////////////////////////////
await connectdb();
app.post("/ask", ask, fetchDB);
app.post("/give", insertDB);
app.listen(3002, () => {
  console.log("chatbot running");
});
