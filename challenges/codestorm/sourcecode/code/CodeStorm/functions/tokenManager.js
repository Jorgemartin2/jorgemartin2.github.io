const crypto = require("crypto");

function createToken(payload, secretKey) {
  const cipher = crypto.createCipher("aes-256-cbc", secretKey);
  let encrypted = cipher.update(JSON.stringify(payload), "utf-8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function decryptToken(token, secretKey) {
  const decipher = crypto.createDecipher("aes-256-cbc", secretKey);
  let decrypted = decipher.update(token, "base64", "utf-8");
  decrypted += decipher.final("utf-8");
  return JSON.parse(decrypted);
}

module.exports = { createToken, decryptToken };
