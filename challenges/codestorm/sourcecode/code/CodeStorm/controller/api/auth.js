require("dotenv").config();
const app = require("express")();
const sequelize = require("../../config");
const { createToken } = require("../../functions/tokenManager");
const { checkTemp } = require("../../middleware/tempAuth");
const User = require("../../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

function generateCODE() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const code = String(randomNum);

  return code;
}

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: "You have reached the request limit. Please try again in a minute.",
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(422).json({ message: "Email is required." });
  }

  if (!password) {
    return res.status(422).json({ message: "Password is required." });
  }

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    const expiresIn = 3600;
    const token = jwt.sign(payload, process.env.SECRET, { expiresIn });
    return res.status(200).json({
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresIn,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "An internal server error occurred. Please try again later.",
      });
  }
});

app.post("/code-request", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(422).json({ message: "Email is required." });
  }

  try {
    const query = `SELECT * FROM users WHERE email = '${email}'`;
    const [results] = await sequelize.query(query);

    if (results.length === 0) {
      return res.status(400).json({ message: "Email not found." });
    }

    const user = results[0];
    const code = generateCODE();
    console.log(code);

    await sequelize.query(
      `UPDATE users SET code = '${code}' WHERE id = '${user.id}'`
    );

    const token = createToken(
      { code: false, sub: user.id },
      process.env.SECRET_KEY_CUSTOM
    );

    console.log(token);

    return res.status(200).json({ temp_token: token });
  } catch (err) {
    return res
      .status(500)
      .json({
        message: "An internal server error occurred. Please try again later.",
      });
  }
});

app.post("/code-verify", checkTemp, limiter, async (req, res) => {
  const { sub } = req.token;
  const { code } = req.body;

  if (!code) {
    return res.status(422).json({ message: "Code is required." });
  }
  try {
    const user = await User.findOne({ where: { id: sub, code: code } });

    if (!user) {
      return res.status(400).json({ message: "Invalid CODE!" });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    const expiresIn = 3600;
    const token = jwt.sign(payload, process.env.SECRET, { expiresIn });
    return res.status(200).json({
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresIn,
    });
  } catch (error) {
    return res.status(500).json({ message: "An internal server error occurred. Please try again later." });
  }
});

module.exports = app;
