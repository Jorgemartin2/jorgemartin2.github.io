const app = require("express")();

app.get("/", (req, res) => {
  res.render("login");
});

module.exports = app;
