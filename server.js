require('dotenv').config();
const createApp = require('./app');
const { validateProductionEnv } = require('./config/validateEnv');

validateProductionEnv();

const port = process.env.PORT || 3000;
createApp().listen(port, () => console.log(`Listening on http://localhost:${port}`));
