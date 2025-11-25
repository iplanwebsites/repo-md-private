/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

// /lib/activities.js
import {
  generateToken,
  generateInviteToken,
  verifyInviteToken,
} from "../../utils/jwt.js";

import _ from "lodash";

// Import activities data
//import activitiesJSON from "../data/activities.json" assert { type: "json" };
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read and parse activities data

function readJsonDataFile(filePath) {
  //include base path of data  "../data/
  const fullPath = join(__dirname, "../data/" + filePath);
  const data = readFileSync(fullPath, "utf8");
  try {
    return JSON.parse(data);
  } catch (error) {
    const filename = fullPath.split("/").pop();
    console.error(
      `\n❌❌ JSON PARSE ERROR in [\n\n ❌ ${filename} ❌ \n\n] ❌❌\nPath: "${fullPath}"\n`,
      error
    );
    throw error;
  }
}

function initActivitiesConfigs() {
  const raw = readJsonDataFile("activities.json");
  /*
  JSON.parse(
    readFileSync(join(__dirname, "../data/activities.json"), "utf8")
  );*/
  const withMore = raw.map((a) => {
    // add the matching form infos
    if (a.type === "form" && a.formId) {
      const form = readJsonDataFile("forms/" + a.formId + ".json");
      if (!form) {
        console.error("FORM JSON config not found for activity", a);
      }
      a.formConfig = form;
    }
    //ptjer checsks

    return a;
  });
  return withMore;
}

const activitiesJSON = initActivitiesConfigs();
/*JSON.parse(
  readFileSync(join(__dirname, "../data/activities.json"), "utf8")
);*/

function augmentActivity(activity, owner, patient) {
  const inviteToken = generateInviteToken(
    owner,
    activity.programId,
    activity.activityId,
    patient
  );
  const inviteUrl = `/start-activity/${inviteToken}`;
  const analysisUrl = `/client/${patient}/${activity.programId}/${activity.activityId}`;

  return {
    ...activity,
    isAvailable: true, // Add your availability logic here
    activitySequence: activity.activitySequence || 999,
    introImg:
      activity.introImg ||
      "https://as2.ftcdn.net/jpg/02/21/13/29/1000_F_221132937_6X32xmuAeHgS7x6aYshPEnkuIrswoBQk.jpg",
    inviteToken,
    inviteUrl,
    analysisUrl,
  };
}

export const getOwnerPatientActivities = async (
  owner,
  patient,
  completedIds = []
) => {
  try {
    if (!owner || !patient) {
      throw new Error("Owner and patient IDs are required");
    }

    // console.log(owner, patient, "getOwnerPatientActivities owner, patient");
    // Get all possible activities
    const activities = activitiesJSON || [];

    // Filter activities based on owner and patient relationship
    // You might want to customize this based on your specific requirements
    const filteredActivities = activities.filter((activity) => {
      return activity.active;
      /* &&
        (!activity.ownerRestrictions ||
          activity.ownerRestrictions.includes(owner))*/
    });
    // return activities;

    let augmentedActivities = filteredActivities.map((activity) => {
      return augmentActivity(activity, owner, patient);
    });
    /*
    const completedIds = augmentedActivities
      .filter((a) => a.completed === true)
      .map((a) => a.activityId);
*/
    augmentedActivities = augmentedActivities.map((activity) => {
      // Get the list of activities that must be completed before this one
      const prerequisiteActivities = activity.requiredActivities || [];

      //  console.log("COMPLETED ID: ", completedIds, filteredActivities.length);
      // Check if any prerequisites have been completed
      const hasCompletedPrerequisites =
        _.intersection(prerequisiteActivities, completedIds).length > 0;

      // console.log("HAS COMPLETED PREREQUISITES: ", hasCompletedPrerequisites);

      // Activity is locked if it has prerequisites and none are completed
      const isLocked =
        prerequisiteActivities.length > 0 && !hasCompletedPrerequisites;

      return {
        ...activity,
        isLocked,
        completed: completedIds.includes(activity.activityId),
      };
    });

    // sort by a.activitySequence && completedBool (always first)
    const sorted = augmentedActivities.sort((a, b) => {
      // If one is completed and the other isn't, prioritize the completed one
      if (a.completed !== b.completed) {
        return a.completed ? -1 : 1;
      }

      // If both have the same completion status, sort by sequence
      return a.activitySequence - b.activitySequence;
    });

    return sorted;
  } catch (error) {
    console.error("Error in getOwnerPatientActivities:", error);
    throw error;
  }
};

export const getActivity = async (search) => {
  const activities = activitiesJSON || [];

  const match = activities.find((activity) => {
    if (search.programId && activity.programId !== search.programId) {
      return false;
    }

    if (search.activityId && activity.activityId !== search.activityId) {
      return false;
    }
    return true;
  });
  console.log(match, "matc for activity search", search);
  if (!match) {
    return null;
  }
  if (search.ownerId && search.patientId) {
    return augmentActivity(match, search.ownerId, search.patientId);
  }
  return match;
};

export const generateActivityInvitation = async ({
  userId, //owner
  program,
  activity,
  patientId,
}) => {
  try {
    if (!userId || !program || !activity || !patientId) {
      throw new Error("Missing required parameters for activity invitation");
    }

    const token = await generateInviteToken(
      userId,
      program,
      activity,
      patientId
    );

    return token;
  } catch (error) {
    console.error("Error generating activity invitation:", error);
    throw error;
  }
};

/**
 * Verify an activity invitation token
 * @param {string} token - The invitation token to verify
 * @returns {Promise<Object>} Decoded token data
 */
export const verifyActivityInvitation = async (token) => {
  try {
    if (!token) {
      throw new Error("Token is required");
    }

    const decodedToken = await verifyInviteToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying activity invitation:", error);
    throw error;
  }
};

/**
 * Get activity details by ID
 * @param {string} activityId - The ID of the activity
 * @returns {Promise<Object|null>} Activity details or null if not found
 */
export const getActivityById = async (activityId) => {
  try {
    if (!activityId) {
      throw new Error("Activity ID is required");
    }

    const activity = activitiesJSON.find((act) => act.id === activityId);
    return activity || null;
  } catch (error) {
    console.error("Error getting activity by ID:", error);
    throw error;
  }
};

/**
 * Check if a patient has access to a specific activity
 * @param {string} patientId - The ID of the patient
 * @param {string} activityId - The ID of the activity
 * @returns {Promise<boolean>} Whether the patient has access
 */
export const checkActivityAccess = async (patientId, activityId) => {
  try {
    if (!patientId || !activityId) {
      throw new Error("Patient ID and Activity ID are required");
    }

    const activity = await getActivityById(activityId);
    if (!activity) {
      return false;
    }

    // Add your access control logic here
    // This is a basic example - customize based on your requirements
    return (
      activity.isActive && !activity.patientRestrictions?.includes(patientId)
    );
  } catch (error) {
    console.error("Error checking activity access:", error);
    throw error;
  }
};

/**
 * Get all activities configuration data
 * @param {Object} options - Optional configuration options
 * @param {boolean} options.augment - Whether to augment activities with additional data
 * @param {boolean} options.activeOnly - Whether to filter only active activities
 * @returns {Array} Array of activity configuration objects
 */
export const getAllActivitiesConfig = (options = {}) => {
  try {
    const { augment = false, activeOnly = false } = options;

    // Get the base activities
    let activities = [...activitiesJSON];

    // Filter active only if requested
    if (activeOnly) {
      activities = activities.filter((activity) => activity.active);
    }

    // Sort by sequence
    activities = activities.sort((a, b) => {
      return (a.activitySequence || 999) - (b.activitySequence || 999);
    });

    // Return plain data if no augmentation requested
    if (!augment) {
      return activities;
    }

    // Add generic augmentation (non-client specific)
    return activities.map((activity) => {
      return {
        ...activity,
        isAvailable: true,
        activitySequence: activity.activitySequence || 999,
        introImg:
          activity.introImg ||
          "https://as2.ftcdn.net/jpg/02/21/13/29/1000_F_221132937_6X32xmuAeHgS7x6aYshPEnkuIrswoBQk.jpg",
      };
    });
  } catch (error) {
    console.error("Error in getAllActivitiesConfig:", error);
    throw error;
  }
};
