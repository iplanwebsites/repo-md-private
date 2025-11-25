/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";

const USE_WEBHOOKS_ONLY = false; // = process.env.USE_WEBHOOKS === "true";

const USE_BREVO_ONLY = true;
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
      },
    });

    this.templateSpecs = null;
    this.templates = new Map();
  }

  async initialize() {
    try {
      // Load template specifications
      const specsFile = await fs.readFile(
        path.join(process.cwd(), "data", "emailTemplates.json"),
        "utf-8"
      );
      this.templateSpecs = JSON.parse(specsFile);

      // Load all template files
      for (const spec of this.templateSpecs) {
        if (!spec.templateId) continue;

        const templatePath = path.join(
          process.cwd(),
          "email-templates",
          `${"base"}.hbs`
        );

        const templateContent = await fs.readFile(templatePath, "utf-8");
        this.templates.set(
          spec.templateId,
          Handlebars.compile(templateContent)
        );
      }
    } catch (error) {
      console.error("Failed to initialize email service:", error);
      throw error;
    }
  }
  getSpec(templateId) {
    const spec = this.templateSpecs.find((s) => s.templateId === templateId);
    if (!spec) {
      throw new Error(`Template ${templateId} not found`);
    }
    return spec;
  }

  async sendEmailWebhook({ templateId, to, data = {}, attachments = [] }) {
    try {
      const spec = this.getSpec(templateId);
      const hookUrl = spec.webhook;

      if (!hookUrl) {
        throw new Error(`Webhook URL not found for ${templateId}`);
      }

      // Process subject line template if it contains variables
      const subjectLine = spec.subjectLine.replace(
        /{(\w+)}/g,
        (match, key) => data[key] || match
      );

      // Prepare the webhook payload
      const payload = {
        templateId,
        recipient: to,
        to,
        subject: subjectLine,
        data,
        attachments: attachments.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content.toString("base64"), // Convert buffer to base64
        })),
        timestamp: new Date().toISOString(),
      };

      console.log(payload);
      // Send the webhook request
      const response = await fetch(hookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.WEBHOOK_API_KEY, // Add API key if required
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Webhook request failed: ${response.status} - ${errorData}`
        );
      }

      //  const result = await response.json();
      const result = response;
      console.log("Webhook response:", result);
      return {
        success: true,
        webhookResponse: result,
        templateId,
        to,
      };
    } catch (error) {
      console.error("Failed to send webhook:", error);
      throw new Error(`Webhook delivery failed: ${error.message}`);
    }
  }

  async sendEmail({ templateId, to, data = {}, attachments = [] }) {
    try {
      if (USE_WEBHOOKS_ONLY) {
        return await this.sendEmailWebhook({
          templateId,
          to,
          data,
          attachments,
        });
      }

      const spec = this.getSpec(templateId);

      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template content for ${templateId} not found`);
      }

      // Process subject line template if it contains variables
      const subjectLine = spec.subjectLine.replace(
        /{(\w+)}/g,
        (match, key) => data[key] || match
      );

      // Render email content with provided data
      const htmlContent = template(data);

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject: subjectLine,
        html: htmlContent,
        attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: result.messageId,
        templateId,
        to,
      };
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  }
}

export default EmailService;
