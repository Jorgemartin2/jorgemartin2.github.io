const express = require("express");
const router = require("./router/router");
const sequelize = require("./config.js");
const path = require("path");

const cookieParser = require("cookie-parser");

const app = express();
function handleJSONParseError(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON format." });
  }
  next();
}

app.use(express.json());
app.use(cookieParser());
app.use(handleJSONParseError);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.set("view engine", "ejs");
app.use("/", router);

const User = require("./models/User");
(async () => {
  try {
    await sequelize.sync();
  } catch (error) {
    console.error("Error synchronizing model:", error);
  }
})();

app.listen(PORT, () => {
  console.log(`Server running in http://127.0.0.1:${PORT}`);
});
