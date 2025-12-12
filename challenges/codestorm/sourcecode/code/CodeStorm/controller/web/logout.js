const app = require("express")();

app.get("/", (req, res) => {
  res.cookie("token", "", { expires: new Date(0) });
  res.redirect("/");
});

module.exports = app;
