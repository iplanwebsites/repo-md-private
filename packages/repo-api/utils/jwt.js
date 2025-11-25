// utils/jwt.js
import jwt from "jsonwebtoken";

//import {generateToken, verifyToken, generateInviteToken,verifyInviteToken,  }

export const verifyToken = (token) => {
  if (!token) throw new Error("No token provided");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "90d",
  });
};

export const verifyInviteToken = (token) => {
  if (!token) throw new Error("No token provided");
  try {
    const decoded = jwt.verify(token, process.env.INVITE_JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

export const generateInviteToken = (
  owner = "ghost",
  program = "general",
  activity = "start",
  patientId
) => {
  // ensure owner is a string
  if (typeof owner !== "string") {
    throw new Error("generateInviteToken: Owner must be a string");
  }

  return jwt.sign(
    { inviteTokenCreated: new Date(), owner, program, activity, patientId },
    process.env.INVITE_JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );
};
