const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const INDEX_FILE = path.join(__dirname, "index.html");

function sendJSON(res, statusCode, data) {
res.writeHead(statusCode, {
"Content-Type": "application/json; charset=utf-8"
});

res.end(JSON.stringify(data));
}

function sendPage(res) {
fs.readFile(INDEX_FILE, "utf8", (error, html) => {
if (error) {
console.error("Unable to read index.html:", error);

  sendJSON(res, 500, {
    success: false,
    message: "Training page could not be loaded."
  });

  return;
}

res.writeHead(200, {
  "Content-Type": "text/html; charset=utf-8"
});

res.end(html);

});
}

function handleTrainingSubmission(req, res) {
let body = "";

req.on("data", chunk => {
body += chunk;

// Prevent unnecessarily large request bodies.
if (body.length > 10000) {
  req.destroy();
}

});

req.on("end", () => {
try {
const data = JSON.parse(body);

  const email =
    typeof data.email === "string"
      ? data.email.trim()
      : "";

  const password =
    typeof data.password === "string"
      ? data.password.trim()
      : "";

  // Basic email validation for the training exercise.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    sendJSON(res, 400, {
      success: false,
      message: "Enter a valid email address."
    });

    return;
  }

  if (!password) {
    sendJSON(res, 400, {
      success: false,
      message: "Enter your password."
    });

    return;
  }

  // Training/demo validation.
  // The database will be connected in the next step.
  console.log("Email received:", {
    email,
    password,
    submittedAt: new Date().toISOString()
  });

  sendJSON(res, 200, {
    success: true,
    message: "Email verified successfully."
  });

} catch (error) {
  sendJSON(res, 400, {
    success: false,
    message: "Invalid training submission."
  });
}

});
}

const server = http.createServer((req, res) => {

if (req.method === "GET" && req.url === "/") {
sendPage(res);
return;
}

if (req.method === "POST" && req.url === "/training") {
handleTrainingSubmission(req, res);
return;
}

sendJSON(res, 404, {
success: false,
message: "Page or endpoint not found."
});
});

server.listen(PORT, "0.0.0.0", () => {
console.log(`OpenAI server running on port ${PORT}`);
});
