/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { db } from "../db.js";
import { generateSecureId } from "./utils.js";

import _ from "lodash";
// Whitelist of properties that can be updated
const UPDATABLE_PROPS = [
  "name",
  "email",
  "phone",
  "status",
  "fiche",
  "memory",
  "memoryUpdated",
  "memoryUpdatedBy",
];

import { formatMdText } from "./format.js";

import {
  getOwnerPatientActivities,
  getActivity,
  generateActivityInvitation,
  verifyActivityInvitation,
  getActivityById,
  checkActivityAccess,
} from "./_legacy/activity.js";

import {
  testReply,
  insertConvo,
  getConvo,
  listConvos,
  replyToConvo,
  updateConvoById,
  getConvos,
} from "../lib/chat/convo.js";

import { getAllExtraConfigs, generateExtra } from "./extras.js";

// Insert a new patient

// Insert a new patient with form data and invite token
export const insertPatient = async ({
  ownerId,
  name,
  email,
  phone,
  inviteToken,
  signupForm, // Capture all additional form fields
}) => {
  // Verify and decode the invite token
  const decoded = inviteToken; //pre extracted
  if (!decoded || !decoded.owner) {
    throw new Error("Invalid invite token");
  }

  const patientId = generateSecureId();

  const patient = {
    id: patientId,
    id6: patientId.slice(-6),
    ownerId, // ownerId: decoded.owner, // Extract ownerId from token
    name,
    email,
    phone,
    status: "active",
    notes: [],
    signupForm, // Store all additional form data
    createdAt: new Date(),
    updatedAt: new Date(),
    // Add token-related fields if needed
    programId: decoded.program,
    invitedActivity: decoded.activity,
    invitedAt: new Date(),
  };

  console.log("INSERTING PATIENT", patient, "inserted.");
  await db.patients.insertOne(patient);
  return patientId;
};

function augmentConvo(convo) {
  if (convo.analysis) {
    ///compute md
    convo.analysisHtml = formatMdText(convo.analysis);
  }
  return convo;
}

// Get a single patient
export const getPatient = async (
  patientId,
  ownerId,
  { includeActivities = false, includeExtras = false } = {}
) => {
  const patient = await db.patients.findOne({ id: patientId });
  if (!patient) return null;

  if (includeActivities) {
    let allConvos = await getConvos({ patientId: patientId });
    allConvos = allConvos.map((c) => augmentConvo(c));

    console.log("PATIENT CONVO COULNT: ", allConvos.length);
    const completedActivityIds = _.chain(allConvos)
      .filter((convo) => convo.completed)
      .map((convo) => convo.activityId) // We need to extract the activityId
      .uniq() // Remove any duplicate activityIds
      .value();

    let activities = await getOwnerPatientActivities(
      ownerId,
      patient.id,
      completedActivityIds
    );
    /*
    const activities = await db.activities
      .find({
        patientId: patient.id,
      })
      .toArray();*/

    activities = activities.map((activity) => {
      const convos = allConvos.filter(
        (c) => c.activityId === activity.activityId
      );
      const completedConvos = convos.filter((c) => c.completed === true);

      const completed = completedConvos.length > 0;
      const lastCompletedConvo = completed ? completedConvos[0] : null;
      return {
        ...activity,
        completed, //count of completed convos
        lastCompletedConvo,
        completedConvos,
        convos: allConvos,
      };
    });

    let extras = [];
    extras = await db.extras.find({ patientId: patient.id }).toArray();
    //extras = extras.reverse();
    const extraConfigs = await getAllExtraConfigs();

    //  const completedActivitiesIds = completedConvos.map((a) => a.id);

    return {
      ...patient,
      activities,
      extras: extras,
      extraConfigs,
      completedActivities: activities
        .map((a) => a.completedConvos.length)
        .reduce((a, b) => a + b, 0),
      completedActivityIds, //: completedConvos.map((a) => a.id),
      lastActivityDate:
        activities.length > 0
          ? new Date(Math.max(...activities.map((a) => a.updatedAt)))
          : null,
    };
  }

  return patient;
};

// Get patients by owner
export const getPatientsByOwner = async (
  ownerId,
  { includeActivities = false } = {}
) => {
  const patients = await db.patients
    .find({ ownerId })
    .sort({ updatedAt: -1 })
    .toArray();

  if (!includeActivities) return patients;

  // Get all activities for these patients in a single query
  const patientIds = patients.map((p) => p.id);
  const activities = await db.activities
    .find({ ownerId, patientId: { $in: patientIds } })
    .toArray();

  // Group activities by patient
  const activitiesByPatient = activities.reduce((acc, activity) => {
    if (!acc[activity.patientId]) {
      acc[activity.patientId] = [];
    }
    acc[activity.patientId].push(activity);
    return acc;
  }, {});

  // Enhance patient objects with their activities and computed fields
  return patients.map((patient) => {
    const patientActivities = activitiesByPatient[patient.id] || [];
    return {
      ...patient,
      activities: patientActivities,
      completedActivities: patientActivities.filter(
        (a) => a.status === "completed"
      ).length,
      completedActivitiesIds: patientActivities
        .filter((a) => a.status === "completed")
        .map((a) => a.id),
      lastActivityDate:
        patientActivities.length > 0
          ? new Date(Math.max(...patientActivities.map((a) => a.updatedAt)))
          : null,
    };
  });
};

// Update patient
export const updatePatient = async (patientId, updates) => {
  // Filter updates to only include whitelisted properties
  const sanitizedUpdates = Object.keys(updates)
    .filter((key) => UPDATABLE_PROPS.includes(key))
    .reduce((obj, key) => {
      obj[key] = updates[key];
      return obj;
    }, {});

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new Error("No valid properties to update");
  }

  const result = await db.patients.updateOne(
    { id: patientId },
    {
      $set: {
        ...sanitizedUpdates,
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Patient not found");
  }

  return result.modifiedCount > 0;
};

// Add a note to patient
export const addPatientNote = async (patientId, note) => {
  if (!note || typeof note !== "string") {
    throw new Error("Note must be a non-empty string");
  }

  const noteObject = {
    content: note,
    date: new Date(),
    id: generateSecureId(), // For potential future note management
  };

  const result = await db.patients.updateOne(
    { id: patientId },
    {
      $push: { notes: noteObject },
      $set: { updatedAt: new Date() },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Patient not found");
  }

  return noteObject;
};

// Archive patient
export const archivePatient = async (patientId) => {
  const result = await db.patients.updateOne(
    { id: patientId },
    {
      $set: {
        status: "archived",
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error("Patient not found");
  }

  return result.modifiedCount > 0;
};
