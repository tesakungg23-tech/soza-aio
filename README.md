![Animated Background](https://i.imgur.com/ECZKmlO.gif)

<h1 align="center" style="font-family: Arial, sans-serif; color: #FF6F61; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
  ALL IN ONE BOT 1.4.1.0
</h1>

<p align="center">
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square&logo=opensource"
      alt="License: MIT" />
  </a>

  <a href="https://www.paypal.me/@GlaceYT">
    <img src="https://img.shields.io/badge/Donate-PayPal-0079C1?style=flat-square&logo=paypal"
      alt="Donate" />
  </a>
</p>

<p align="center">
  <a href="https://www.youtube.com/channel/@GlaceYT">
    <img src="https://img.shields.io/badge/YouTube-Subscribe-red?style=flat-square&logo=youtube"
      alt="YouTube" />
  </a>

  <a href="https://discord.gg/xQF9f9yUEM">
    <img src="https://img.shields.io/badge/Discord-Join-blue?style=flat-square&logo=discord"
      alt="Join Discord" />
  </a>

  <a href="https://www.instagram.com/glaceytt">
    <img src="https://img.shields.io/badge/Instagram-Follow-E4405F?style=flat-square&logo=instagram"
      alt="Instagram" />
  </a>

  <a href="https://www.facebook.com/youulewd/">
    <img src="https://img.shields.io/badge/Facebook-Follow-1877F2?style=flat-square&logo=facebook"
      alt="Facebook" />
  </a>
</p>

<h2>Discord All-in-One BOT Installation Guide</h2>

<h3>How to Install</h3>

<h4>Step 1: Configure environment variables</h4>

<ol>
  <li>Set the variables in your hosting provider. Do not commit tokens or database credentials to <code>config.json</code>.</li>
</ol>

<h4>ENV SETUP</h4>

<pre>
TOKEN=
FACEBOOK_ACCESS_TOKEN=
FORTNITE_API_KEY=
YOUTUBE_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
TWITCH_CLIENT_ID=
TWITCH_ACCESS_TOKEN=
INSTAGRAM_ACCESS_TOKEN=
MONGODB_URI=
DISCORD_USER_ID=
BOT_API=
DISCORD_GUILD_ID=
REQUIRE_BOT_VERIFICATION=false
</pre>

<p><strong>24/7 voice:</strong> <code>/join</code> connects without playing audio, saves the selected voice channel in MongoDB, and restores the connection automatically after a bot restart or Railway redeploy. Keep <code>MONGODB_URI</code> configured in Railway so the saved voice session is available after redeploys.</p>

<h4>Step 2: Set Up Hosting Service</h4>

<ol>
  <li>Create a new service in <a href="https://railway.com/">Railway</a> from this repository.</li>
  <li>Railway will use <code>railway.json</code> and install the project with pnpm.</li>
  <li>Add at least <code>TOKEN</code> and <code>MONGODB_URI</code> in the service Variables.</li>
  <li>Set <code>DISCORD_GUILD_ID</code> to your server ID so slash commands appear immediately while deploying. Without it, Discord registers them globally and propagation can take up to an hour.</li>
</ol>

<h4>Step 3: Add Build and Start Commands</h4>
<pre>
Run the following commands to install dependencies and start your bot:

pnpm install
pnpm start
</pre>

<h4>Step 4: Get Your Bot Token</h4>
<ol>
  <li>Navigate to the Discord Developer Portal.</li>
  <li>Find your application, and retrieve the bot token from the "Bot" section.</li>
</ol>

<h4>Step 5: Set Environment Variable</h4>
<ol>
  <li>Create an environment variable with the following details:</li>
  <ul>
    <li>Key: TOKEN</li>
    <li>Value: [your bot token]</li>
  </ul>
  <li>Deploy your application using your hosting service’s deployment process.</li>
</ol>

<h4>Step 6: Wait and Test</h4>
<ol>
  <li>Wait approximately five minutes for your bot to deploy and start up.</li>
  <li>Test your bot by sending commands to ensure it is operational.</li>
</ol>

<p>🎉 Congratulations! Your bot is now up and running. 🥳</p>

<h3>Additional Resources</h3>
<p><strong>Video Tutorial:</strong> If you prefer a video guide, watch this YouTube tutorial [ Soon ].</p>
<p><strong>Common Errors:</strong> Consult the errors section for troubleshooting.</p>

<h3>Useful Files</h3>
<ul>
  <li><code>UI/banners/musicard.js</code>: Change, add, or remove music cards here.</li>
  <li><code>UI/icons/musicicons.js</code>: Change, add, or remove music icons here.</li>
</ul>
