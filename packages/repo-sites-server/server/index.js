require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { router } = require('./router');
const { setupApiRoutes } = require('./api');
const logger = require('../packages/utils/logger');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Setup API routes
setupApiRoutes(app);

// Use the tenant router for all other requests
app.use('/', router);

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
