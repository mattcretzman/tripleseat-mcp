const path = require("path");
const app = require(path.join(__dirname, "..", "dist", "index.js"));
module.exports = app.default || app;
