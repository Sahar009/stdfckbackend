const cron = require('node-cron');
const axios = require('axios');
const logger = require('./logger'); // Optional: Create this for better logging

// Schedule tasks to be run on the server
const initCronJobs = () => {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        try {
            const response = await axios.get(process.env.SERVER_URL || 'http://localhost:10000');
            logger.info('Cron job successful:', {
                status: response.status,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Cron job failed:', {
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    console.log('Cron jobs initialized');
};

module.exports = initCronJobs; 