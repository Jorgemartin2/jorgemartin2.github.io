const app = require("express")();
const index = require("./web/index");
const login = require("./web/login");
const code_request = require("./web/login-code-request");
const code_verify = require("./web/login-code-verify");
const logout = require("./web/logout");

app.use("/", index);
app.use("/login", login);
app.use("/login/code-request", code_request);
app.use("/login/code-verify", code_verify);
app.use("/logout", logout);

module.exports = app;
