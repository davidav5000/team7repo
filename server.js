require('dotenv').config();
const createApp = require('./app');

const port = process.env.PORT || 3000;
createApp().listen(port, () => console.log(`Listening on http://localhost:${port}`));
