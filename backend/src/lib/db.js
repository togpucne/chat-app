import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    console.log(`Mongoose connect: ${conn.connection.host}`);
  } catch (error) {
    console.log("Mongoose error: " , error);
  }
};
