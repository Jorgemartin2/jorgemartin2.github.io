const app = require("express")();
const api = require("../controller/api");
const web = require("../controller/web");

app.use("/api", api);
app.use("/", web);

module.exports = app;
