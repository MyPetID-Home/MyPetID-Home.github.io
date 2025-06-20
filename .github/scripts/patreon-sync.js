const fs = require('fs');
const path = require('path');
const axios = require('axios');

const PATREON_ID = process.env.PATREON_ID;
const PATREON_SECRET = process.env.PATREON_SECRET;

// Replace with your actual redirect URI
const REDIRECT_URI = 'https://mypetid-home.github.io/oauth-callback.html';

// Paths
const pendingDir = path.join(__dirname, '../../data/pending');
const patreonDataFile = path.join(__dirname, '../../data/patreon.json');

async function main() {
  if (!fs.existsSync(pendingDir)) return;

  const files = fs.readdirSync(pendingDir);
  if (files.length === 0) {
    console.log('No pending OAuth codes.');
    return;
  }

  let patreonUsers = [];
  if (fs.existsSync(patreonDataFile)) {
    patreonUsers = JSON.parse(fs.readFileSync(patreonDataFile, 'utf8'));
  }

  for (const file of files) {
    const fullPath = path.join(pendingDir, file);
    const pendingData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const code = pendingData.code;

    try {
      // Exchange code for token
      const tokenRes = await axios.post('https://www.patreon.com/api/oauth2/token', null, {
        params: {
          code,
          grant_type: 'authorization_code',
          client_id: PATREON_ID,
          client_secret: PATREON_SECRET,
          redirect_uri: REDIRECT_URI
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const accessToken = tokenRes.data.access_token;

      // Get identity
      const identityRes = await axios.get('https://www.patreon.com/api/oauth2/v2/identity', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          'include': 'memberships',
          'fields[user]': 'full_name,email',
          'fields[member]': 'patron_status,currently_entitled_tiers,pledge_relationship_start'
        }
      });

      const user = identityRes.data.data;
      const membership = identityRes.data.included?.[0];

      const userData = {
        id: user.id,
        name: user.attributes.full_name,
        email: user.attributes.email,
        tier: membership?.relationships?.currently_entitled_tiers?.data?.[0]?.id || 'Unknown',
        joined_at: membership?.attributes?.pledge_relationship_start || new Date().toISOString()
      };

      patreonUsers.push(userData);
      console.log(`Added Patreon user: ${userData.name}`);

      // Delete pending file
      fs.unlinkSync(fullPath);

    } catch (error) {
      console.error(`Failed processing ${file}:`, error.message);
    }
  }

  fs.writeFileSync(patreonDataFile, JSON.stringify(patreonUsers, null, 2));
  console.log(`✅ Updated patreon.json with ${patreonUsers.length} users`);
}

main().catch(console.error);
