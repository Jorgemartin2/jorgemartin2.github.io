require("dotenv").config();
const { decryptToken } = require("../functions/tokenManager");

function checkTempFront(req, res, next) {
  const tokenTemp = req.cookies.temp_token;

  if (!tokenTemp) {
    return res.redirect("/login/code-request");
  }

  try {
    const secret = process.env.SECRET_KEY_CUSTOM;
    const decodedToken = decryptToken(tokenTemp, secret);
    req.token = decodedToken;
    next();
  } catch (error) {
    return res.redirect("/login/code-request");
  }
}

function checkTemp(req, res, next) {
  const tokenTemp = req.headers["temp-token"];

  if (!tokenTemp) {
    return res.redirect("/login/code-request");
  }

  try {
    const secret = process.env.SECRET_KEY_CUSTOM;
    const decodedToken = decryptToken(tokenTemp, secret);
    req.token = decodedToken;
    next();
  } catch (error) {
    return res.redirect("/login/code-request");
  }
}

module.exports = { checkTempFront, checkTemp };
