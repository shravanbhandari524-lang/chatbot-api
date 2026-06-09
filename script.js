import mongoose, { connect } from "mongoose";
import dotenv from "dotenv";
dotenv.config();
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

const ports = [
  { name: "Mundra Port", coordinates: [69.721, 22.839], count: 3 },
  { name: "Deendayal Port", coordinates: [70.217, 23.031], count: 3 },
  { name: "Mumbai Port", coordinates: [72.84, 18.949], count: 3 },
  { name: "Jawaharlal Nehru Port", coordinates: [72.95, 18.949], count: 3 },
  { name: "Cochin Port", coordinates: [76.267, 9.966], count: 3 },
  { name: "New Mangalore Port", coordinates: [74.814, 12.93], count: 3 },
  { name: "Chennai Port", coordinates: [80.293, 13.082], count: 3 },
  { name: "Kamarajar Port", coordinates: [80.347, 13.256], count: 3 },
  { name: "V.O. Chidambaranar Port", coordinates: [78.134, 8.764], count: 3 },
  { name: "Visakhapatnam Port", coordinates: [83.289, 17.686], count: 3 },
  { name: "Paradip Port", coordinates: [86.671, 20.264], count: 2 },
  {
    name: "Syama Prasad Mookerjee Port",
    coordinates: [88.306, 22.541],
    count: 2,
  },
  { name: "Haldia Dock Complex", coordinates: [88.069, 22.025], count: 2 },
  { name: "Krishnapatnam Port", coordinates: [80.124, 14.25], count: 2 },
  { name: "Gangavaram Port", coordinates: [83.233, 17.633], count: 2 },
  { name: "Hazira Port", coordinates: [72.635, 21.114], count: 2 },
  { name: "Dahej Port", coordinates: [72.618, 21.715], count: 2 },
  { name: "Sikka Port", coordinates: [69.84, 22.42], count: 2 },
  { name: "Vadinar Port", coordinates: [69.73, 22.47], count: 2 },
  {
    name: "Vizhinjam International Seaport",
    coordinates: [76.987, 8.376],
    count: 2,
  },
];
await connectdb();
const ships = await Que.find();

let shipIndex = 0;

for (const port of ports) {
  for (let i = 0; i < port.count; i++) {
    await Que.updateOne(
      { _id: ships[shipIndex]._id },
      {
        $set: {
          location: {
            type: "Point",
            coordinates: port.coordinates,
          },
        },
      },
    );

    shipIndex++;
  }
}
