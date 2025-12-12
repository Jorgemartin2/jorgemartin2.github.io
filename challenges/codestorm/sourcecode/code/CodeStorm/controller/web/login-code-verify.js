const app = require("express")();
const { checkTempFront } = require("../../middleware/tempAuth");

app.get("/", checkTempFront, (req, res) => {
  res.render("code_verify");
});

module.exports = app;
