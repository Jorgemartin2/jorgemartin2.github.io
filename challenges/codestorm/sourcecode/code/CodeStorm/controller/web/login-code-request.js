const app = require("express")();

app.get("/", (req, res) => {
  res.render("code_request");
});

module.exports = app;
