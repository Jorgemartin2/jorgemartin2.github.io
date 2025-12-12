require("dotenv").config();
const app = require("express")();
const checkAuthFront = require("../../middleware/checkAuthFront");

app.get("/", checkAuthFront, (req, res) => {
  const flag = process.env.FLAG;
  const { username } = req.user;
  res.render("index", { flag, username });
});

module.exports = app;
