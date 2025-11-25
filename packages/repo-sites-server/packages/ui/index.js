/**
 * Shared UI components for multi-tenant templates
 * This is a stub - in a real implementation, this would be a proper UI library
 */

// Mock UI component library for demonstration purposes
const components = {
  /**
   * Creates a themed button based on tenant configuration
   * @param {Object} config - The tenant configuration
   * @param {string} text - The button text
   * @returns {string} HTML for the button
   */
  Button: (config, text) => {
    const { primaryColor } = config.theme || { primaryColor: '#000000' };
    
    return `
      <button style="background-color: ${primaryColor}; color: white; padding: 8px 16px; border: none; border-radius: 4px;">
        ${text}
      </button>
    `;
  },
  
  /**
   * Creates a themed header based on tenant configuration
   * @param {Object} config - The tenant configuration
   * @param {string} text - The header text
   * @returns {string} HTML for the header
   */
  Header: (config, text) => {
    const { primaryColor, fontFamily } = config.theme || { primaryColor: '#000000', fontFamily: 'sans-serif' };
    
    return `
      <header style="background-color: ${primaryColor}; color: white; padding: 16px; font-family: ${fontFamily};">
        <h1>${text}</h1>
      </header>
    `;
  },
  
  /**
   * Creates a themed footer based on tenant configuration
   * @param {Object} config - The tenant configuration
   * @param {string} text - The footer text
   * @returns {string} HTML for the footer
   */
  Footer: (config, text) => {
    const { secondaryColor, fontFamily } = config.theme || { secondaryColor: '#cccccc', fontFamily: 'sans-serif' };
    
    return `
      <footer style="background-color: ${secondaryColor}; color: white; padding: 16px; font-family: ${fontFamily}; text-align: center;">
        <p>${text}</p>
      </footer>
    `;
  }
};

module.exports = components;
