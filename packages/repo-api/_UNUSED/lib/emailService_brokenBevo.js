/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
// Import both SDKs - one for emails (Brevo) and one for contacts (SendInBlue)
import * as brevo from "@getbrevo/brevo";
import * as SibApiV3Sdk from "sib-api-v3-typescript";

const PROVIDER = {
  BREVO: "brevo",
  NODEMAILER: "nodemailer",
  WEBHOOK: "webhook",
};

class EmailService {
  constructor(config = {}) {
    this.provider = config.provider || PROVIDER.BREVO;
    this.templateSpecs = null;
    this.templates = new Map();
    // Initialize both client types as null
    this.brevoEmailClient = null;
    this.sibContactsApi = null;

    this.initializeProvider(config);
  }

  initializeProvider(config) {
    switch (this.provider) {
      case PROVIDER.BREVO:
        this.initializeBrevo(config);
        break;
      case PROVIDER.NODEMAILER:
        this.initializeNodemailer(config);
        break;
      default:
        throw new Error(`Unsupported email provider: ${this.provider}`);
    }
  }

  initializeBrevo(config) {
    const apiKey = config.brevoApiKey || process.env.BREVO_API_KEY;

    if (!apiKey) {
      throw new Error("Brevo API key is required");
    }

    // Initialize Brevo client for emails
    const defaultClient = brevo.ApiClient.instance;
    defaultClient.authentications["apiKey"].apiKey = apiKey;
    this.brevoEmailClient = new brevo.TransactionalEmailsApi();

    // Initialize SendInBlue client for contacts
    this.sibContactsApi = new SibApiV3Sdk.ContactsApi();
    this.sibContactsApi.authentications["apiKey"].apiKey = apiKey;
  }

  initializeNodemailer(config) {
    this.transporter = nodemailer.createTransport({
      service: config.service || "gmail",
      auth: {
        user: config.user || process.env.GMAIL_USER,
        pass: config.password || process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  async initialize() {
    try {
      // Load template specifications from JSON file
      const specsFile = await fs.readFile(
        path.join(process.cwd(), "data", "emailTemplates.json"),
        "utf-8"
      );
      this.templateSpecs = JSON.parse(specsFile);

      // Only load local templates if not using Brevo
      if (this.provider !== PROVIDER.BREVO) {
        for (const spec of this.templateSpecs) {
          if (!spec.templateId) continue;

          const templatePath = path.join(
            process.cwd(),
            "email-templates",
            `${spec.templateId}.hbs`
          );

          const templateContent = await fs.readFile(templatePath, "utf-8");
          this.templates.set(
            spec.templateId,
            Handlebars.compile(templateContent)
          );
        }
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

  /**
   * Creates a new contact attribute in Brevo using the SendInBlue SDK
   * @param {Object} params - The attribute parameters
   * @param {string} params.category - The attribute category (e.g., "normal", "category", "global")
   * @param {string} params.name - The name of the attribute
   * @param {string} params.type - The type of attribute ("text", "date", "float", "boolean", "category")
   * @param {Array<Object>} [params.enumeration] - Array of {value: number, label: string} for category type
   * @returns {Promise<Object>} The created attribute response
   */
  async createBrevoContactAttribute(params) {
    try {
      if (!params.category || !params.name || !params.type) {
        throw new Error(
          "Category, name, and type are required for creating an attribute"
        );
      }

      // Create attribute using SendInBlue SDK structure
      const createAttribute = new SibApiV3Sdk.CreateAttribute();
      createAttribute.type = params.type;

      // Handle enumeration for category type attributes
      if (params.type === "category" && Array.isArray(params.enumeration)) {
        createAttribute.enumeration = [];
        params.enumeration.forEach((item, index) => {
          createAttribute.enumeration[index] = {
            value: parseInt(item.value),
            label: item.label,
          };
        });
      }

      // Create the attribute using the SendInBlue API
      const result = await this.sibContactsApi.createAttribute(
        params.category,
        params.name,
        createAttribute
      );

      return {
        success: true,
        category: params.category,
        name: params.name,
        type: params.type,
        result,
      };
    } catch (error) {
      console.error("Failed to create contact attribute:", error);
      throw new Error(`Failed to create contact attribute: ${error.message}`);
    }
  }

  /**
   * Creates a new contact in Brevo using the SendInBlue SDK
   * @param {Object} params - The contact parameters
   * @param {string} params.email - The contact's email address
   * @param {Object} [params.attributes] - Optional attributes for the contact
   * @param {Array<number>} [params.listIds] - Optional array of list IDs
   * @returns {Promise<Object>} The created contact response
   */
  async createBrevoContact(params) {
    try {
      if (!params.email) {
        throw new Error("Email is required to create a contact");
      }

      // Create contact using SendInBlue SDK structure
      const createContact = new SibApiV3Sdk.CreateContact();
      createContact.email = params.email;

      if (params.attributes) {
        createContact.attributes = params.attributes;
      }

      if (Array.isArray(params.listIds)) {
        createContact.listIds = params.listIds;
      }

      const result = await this.sibContactsApi.createContact(createContact);

      return {
        success: true,
        email: params.email,
        result,
      };
    } catch (error) {
      console.error("Failed to create contact:", error);
      throw new Error(`Failed to create contact: ${error.message}`);
    }
  }

  async sendEmailViaBrevo({ templateId, to, data = {}, attachments = [] }) {
    try {
      const spec = this.getSpec(templateId);

      if (!spec.brevoTemplateId) {
        throw new Error(`Brevo template ID not found for ${templateId}`);
      }

      // Create and configure email using Brevo SDK
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.templateId = parseInt(spec.brevoTemplateId);

      // Handle single recipient or multiple recipients
      sendSmtpEmail.to = Array.isArray(to)
        ? to.map((recipient) => ({ email: recipient }))
        : [{ email: to }];

      // Set template parameters for personalization
      sendSmtpEmail.params = data;

      // Process attachments if present
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments.map((att) => ({
          name: att.filename,
          content: att.content.toString("base64"),
          type: att.contentType,
        }));
      }

      const result = await this.brevoEmailClient.sendTransacEmail(
        sendSmtpEmail
      );

      return {
        success: true,
        messageId: result.messageId,
        templateId,
        brevoTemplateId: spec.brevoTemplateId,
        to,
      };
    } catch (error) {
      console.error("Failed to send email via Brevo:", error);
      throw error;
    }
  }

  async sendEmailViaNodemailer({
    templateId,
    to,
    data = {},
    attachments = [],
  }) {
    try {
      const spec = this.getSpec(templateId);
      const template = this.templates.get(templateId);

      if (!template) {
        throw new Error(`Template content for ${templateId} not found`);
      }

      // Process subject line template with data
      const subject = spec.subjectLine.replace(
        /{(\w+)}/g,
        (match, key) => data[key] || match
      );

      // Render email content using Handlebars template
      const htmlContent = template(data);

      // Configure email options
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject,
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
      console.error("Failed to send email via Nodemailer:", error);
      throw error;
    }
  }

  async sendEmail(options) {
    switch (this.provider) {
      case PROVIDER.BREVO:
        return this.sendEmailViaBrevo(options);
      case PROVIDER.NODEMAILER:
        return this.sendEmailViaNodemailer(options);
      case PROVIDER.WEBHOOK:
        return this.sendEmailWebhook(options);
      default:
        throw new Error(`Unsupported email provider: ${this.provider}`);
    }
  }
}

export default EmailService;
