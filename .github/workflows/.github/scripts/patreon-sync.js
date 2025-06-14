const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const pendingDir = path.join(__dirname, "../../data/pending");
const outputFile = path.join(__dirname, "../../data/patreon.json");

const CLIENT_ID = process.env.PATREON_CLIENT_ID;
const CLIENT_SECRET = process.env.PATREON_CLIENT_SECRET;
const REDIRECT_URI = "https://mypetid-home.github.io/oauth/callback.html";

async function getPatreonData(code) {
  const res = await fetch("https://www.patreon.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenData = await res.json();
  if (!tokenData.access_token) throw new Error("Failed to exchange token");

  const userRes = await fetch("https://www.patreon.com/api/oauth2/v2/identity?include=memberships", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  return await userRes.json();
}

(async () => {
  let patreonDB = [];

  const files = fs.readdirSync(pendingDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(pendingDir, file), "utf-8"));
    try {
      const userData = await getPatreonData(data.code);
      patreonDB.push({
        username: data.username,
        patreon: userData,
      });

      fs.unlinkSync(path.join(pendingDir, file)); // delete after processing
    } catch (err) {
      console.error("Failed processing", file, err);
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(patreonDB, null, 2));
})();
