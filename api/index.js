// Vercel serverless function — imports the compiled Express app
// Build step (npm run build) compiles src/ → dist/ first
const app = require("../dist/index.js");
module.exports = app.default || app;
