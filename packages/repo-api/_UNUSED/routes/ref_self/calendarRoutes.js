// calendarRoutes.js
import express from "express";
import {
  getMeets,
  augmentMeet,
  getMeet,
  updatePatientStatus,
} from "../../lib/meet.js";
import { db } from "../../db.js";
import {
  createBaseCalendar,
  addCalendarHeaders,
  addEventToCalendar,
  mapStatusToICalStatus,
  mapInviteeStatusToICalStatus,
} from "../../lib/calendarHelpers.js";

const router = express.Router();

/**
 * Route to serve an iCalendar feed for a specific owner
 * GET /calendar/:ownerId
 * Optional query params:
 * - token: security token for authentication
 * - status: filter by meeting status
 * - fromDate: filter meetings from this date (ISO format)
 * - toDate: filter meetings until this date (ISO format)
 */
router.get("/:ownerId", async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { token, status, fromDate, toDate } = req.query;

    // Basic validation
    if (!ownerId) {
      return res.status(400).send("Owner ID is required");
    }

    // TODO: Add proper token validation for production use

    // Get all patients for this owner
    const patients = await db.patients
      .find({ ownerId })
      .sort({ updatedAt: -1 })
      .toArray();

    // Build filters for getMeets
    const filters = {};
    if (status) filters.status = status;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    // Get all meetings for this owner with filters applied
    const meets = await getMeets(ownerId, filters);

    // Create a new calendar with subscription properties
    const calendarUrl = `${
      process.env.BASE_URL || "https://api.repo.md"
    }/calendar/${ownerId}`;
    const calendar = createBaseCalendar({
      name: `RDVs PushMD`,
      url: calendarUrl,
    });

    // Add all meetings to the calendar
    meets.forEach((meet) => {
      // Find patient information if patientId exists
      let patient = null;
      if (meet.patientId) {
        patient = patients.find((p) => p.id === meet.patientId);
      }

      // Add patient name to summary if available
      const summary = patient ? `${patient.name}: ${meet.title}` : meet.title;

      addEventToCalendar(calendar, meet, { patient, summary });
    });

    // Set calendar headers
    addCalendarHeaders(
      res,
      `PushMD Calendar - ${ownerId}`,
      `calendar-${ownerId}.ics`
    );

    // Send the calendar
    res.send(calendar.toString());
  } catch (error) {
    console.error("Error generating calendar feed:", error);
    res.status(500).send("Error generating calendar feed");
  }
});

/**
 * Route to serve an iCalendar feed for a specific patient
 * GET /calendar/patient/:patientId
 */
router.get("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const { token } = req.query;

    // Basic validation
    if (!patientId) {
      return res.status(400).send("Patient ID is required");
    }

    // TODO: Add proper token validation

    // Get patient info to get email
    const patient = await db.patients.findOne({ id: patientId });

    // Get all meetings where this user is a patient
    const filters = { patientId };
    const meets = await getMeets(null, filters);

    // Create calendar with subscription properties
    const calendarUrl = `${
      process.env.BASE_URL || "https://repo.md"
    }/calendar/patient/${patientId}`;
    const calendar = createBaseCalendar({
      name: `Your PushMD Appointments`,
      url: calendarUrl,
    });

    // Add all meetings to the calendar
    meets.forEach((meet) => {
      addEventToCalendar(calendar, meet, { patient });
    });

    // Set calendar headers
    addCalendarHeaders(
      res,
      `Your PushMD Appointments`,
      `appointments-${patientId}.ics`
    );

    // Send the calendar
    res.send(calendar.toString());
  } catch (error) {
    console.error("Error generating patient calendar feed:", error);
    res.status(500).send("Error generating calendar feed");
  }
});

/**
 * Route to serve a single event in iCalendar format
 * GET /calendar/event/:meetId
 */
router.get("/event/:meetId", async (req, res) => {
  try {
    const { meetId } = req.params;

    // Get the meeting from the database
    const meet = await getMeet(meetId);

    if (!meet) {
      return res.status(404).send("Meeting not found");
    }

    // Create a calendar for this single event (non-subscription mode)
    const calendar = createBaseCalendar({
      name: `PushMD Appointment`,
      subscriptionMode: false,
    });

    // Get patient info if patientId exists
    let patient = null;
    if (meet.patientId) {
      patient = await db.patients.findOne({ id: meet.patientId });
    }

    // Add the event to the calendar
    addEventToCalendar(calendar, meet, { patient });

    // Send the calendar
    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename=event-${meetId}.ics`);
    res.send(calendar.toString());
  } catch (error) {
    console.error("Error serving event:", error);
    res.status(500).send("Error serving event");
  }
});

/**
 * Route to get patient status for a meeting
 * GET /calendar/patient-status/:meetId
 */
router.get("/patient-status/:meetId", async (req, res) => {
  try {
    const { meetId } = req.params;

    if (!meetId) {
      return res.status(400).json({ error: "Meeting ID is required" });
    }

    const meet = await getMeet(meetId);

    if (!meet) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    if (!meet.patientId) {
      return res
        .status(404)
        .json({ error: "No patient associated with this meeting" });
    }

    // Get patient details
    const patient = await db.patients.findOne({ id: meet.patientId });

    res.json({
      patientId: meet.patientId,
      email: meet.patientEmail || (patient ? patient.email : null),
      name: patient ? patient.name : null,
      status: meet.inviteeStatus || "pending",
      updatedAt: meet.updatedAt,
    });
  } catch (error) {
    console.error("Error getting patient status:", error);
    res.status(500).json({ error: "Error getting patient status" });
  }
});

/**
 * Route to update patient's status for a meeting
 * PUT /calendar/patient-status/:meetId
 */
router.put("/patient-status/:meetId", async (req, res) => {
  try {
    const { meetId } = req.params;
    const { status, email } = req.body;

    if (!meetId) {
      return res.status(400).json({ error: "Meeting ID is required" });
    }

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const updatedMeet = await updatePatientStatus(meetId, status, email);

    res.json({
      success: true,
      message: "Patient status updated",
      status: updatedMeet.inviteeStatus,
      patientEmail: updatedMeet.patientEmail,
    });
  } catch (error) {
    console.error("Error updating patient status:", error);
    res
      .status(500)
      .json({ error: error.message || "Error updating patient status" });
  }
});

/**
 * Route to list all patients (for selecting invitees)
 * GET /calendar/patients/:ownerId
 */
router.get("/patients/:ownerId", async (req, res) => {
  try {
    const { ownerId } = req.params;

    if (!ownerId) {
      return res.status(400).json({ error: "Owner ID is required" });
    }

    // Fetch patients for this owner
    const patients = await db.patients
      .find({ ownerId })
      .project({ id: 1, email: 1, name: 1 })
      .sort({ name: 1 })
      .toArray();

    res.json(patients);
  } catch (error) {
    console.error("Error listing patients:", error);
    res.status(500).json({ error: "Error listing patients" });
  }
});

/**
 * Route to respond to an invitation via a response link
 * GET /calendar/respond/:meetId/:response
 * (response is "accept", "decline", or "tentative")
 */
router.get("/respond/:meetId/:response", async (req, res) => {
  try {
    const { meetId, response } = req.params;

    if (!meetId || !response) {
      return res
        .status(400)
        .json({ error: "Meeting ID and response are required" });
    }

    // Map the response to a status
    const responseToStatus = {
      accept: "accepted",
      decline: "declined",
      tentative: "tentative",
    };

    const status = responseToStatus[response.toLowerCase()];

    if (!status) {
      return res.status(400).json({
        error: "Invalid response. Must be 'accept', 'decline', or 'tentative'",
      });
    }

    // Update the patient status
    await updatePatientStatus(meetId, status);

    // Get the updated meeting to show details
    const updatedMeet = await getMeet(meetId);

    // Render a simple HTML response page
    const responseHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Meeting Response</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 {
          color: #444;
        }
        .card {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 20px;
          margin: 20px 0;
          background-color: #f9f9f9;
        }
        .success {
          color: #2c8c57;
          font-weight: bold;
        }
        .date {
          color: #666;
        }
      </style>
    </head>
    <body>
      <h1>Meeting Response</h1>
      <p class="success">You have ${status} the meeting invitation.</p>
      
      <div class="card">
        <h2>${updatedMeet.title}</h2>
        <p class="date">
          <strong>Date:</strong> ${new Date(
            updatedMeet.startTime
          ).toLocaleDateString()}
        </p>
        <p>
          <strong>Time:</strong> ${new Date(
            updatedMeet.startTime
          ).toLocaleTimeString()} - 
          ${new Date(updatedMeet.endTime).toLocaleTimeString()}
        </p>
        <p><strong>Description:</strong> ${
          updatedMeet.description || "No description provided"
        }</p>
      </div>
      
      <p>You can add this meeting to your calendar by clicking the link below:</p>
      <p><a href="/calendar/event/${meetId}">Add to Calendar</a></p>
    </body>
    </html>
    `;

    res.set("Content-Type", "text/html");
    res.send(responseHtml);
  } catch (error) {
    console.error("Error responding to invitation:", error);
    res
      .status(500)
      .json({ error: error.message || "Error responding to invitation" });
  }
});

export default router;
