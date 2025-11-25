/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

class Brevo {
  constructor(apiKey, senderEmail, senderName) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.brevo.com/v3";
    this.sender = { email: senderEmail, name: senderName };
  }

  async request(endpoint, method, body = null) {
    const options = {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": this.apiKey,
      },
    };
    if (body) options.body = JSON.stringify(body);
    console.log("Request options:", options, body);
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Brevo API error: ${errorData.message || response.statusText}`
        );
      }

      const r = await response; //.json();
      console.log("Brevo API response:", r);

      return r;
    } catch (error) {
      console.error("Brevo API error:", error);
      throw error;
    }
  }

  async addContact(contactData) {
    return this.request("/contacts", "POST", contactData);
  }

  // Enhanced sendTransacEmail that can optionally create a contact first
  async sendTransacEmail(
    templateId,
    recipientEmail,
    params = { test: " abcd" },
    recipientName = "mon ami",
    options = {}
  ) {
    // The options parameter allows for additional configuration while maintaining backward compatibility
    const {
      addContact = false,
      contactAttributes = { test: "234" },
      contactDelay = 500,
    } = options;

    try {
      // If addContact is true, create the contact first
      if (addContact) {
        await this.addContact({
          email: recipientEmail,
          attributes: {
            name: recipientName,
            ...contactAttributes,
          },
          updateEnabled: true,
        });

        // Wait for contact creation to settle
        await new Promise((resolve) => setTimeout(resolve, contactDelay));
      }

      // Send the transactional email, maintaining the original API structure
      return await this.request("/smtp/email", "POST", {
        sender: this.sender,
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        templateId,
        params: { ...params, test: "1234" },
      });
    } catch (error) {
      // Enhance error with context while preserving the original error
      const enhancedError = new Error(
        addContact
          ? "Contact creation and email sending failed"
          : "Email sending failed"
      );
      enhancedError.originalError = error;
      enhancedError.context = {
        email: recipientEmail,
        templateId,
        addedContact: addContact,
        timestamp: new Date().toISOString(),
      };
      throw enhancedError;
    }
  }
}

export default Brevo;
