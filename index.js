export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // -----------------------------
      // HEALTH CHECK
      // -----------------------------
      if (request.method === "GET" && url.pathname === "/api/health") {
        let database = "disconnected";

        try {
          await env.DB.prepare("SELECT 1").first();
          database = "connected";
        } catch (error) {
          console.error("HEALTH DB ERROR:", error);
        }

        return json({
          ok: true,
          status: "online",
          database
        });
      }

      // -----------------------------
      // SETUP PAGE
      // -----------------------------
      if (request.method === "GET" && url.pathname === "/setup") {
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CELESTIAL LEGENDS Setup</title>
<style>
body{
  margin:0;
  background:#080808;
  color:#fff;
  font-family:Arial,sans-serif;
  display:flex;
  justify-content:center;
  align-items:center;
  min-height:100vh;
}
.box{
  width:min(90%,420px);
  background:#151515;
  border:1px solid #333;
  border-radius:18px;
  padding:28px;
  box-sizing:border-box;
}
h1{
  margin-top:0;
  font-size:22px;
}
input{
  width:100%;
  box-sizing:border-box;
  padding:14px;
  margin:12px 0;
  border-radius:10px;
  border:1px solid #444;
  background:#090909;
  color:white;
}
button{
  width:100%;
  padding:14px;
  border:0;
  border-radius:10px;
  background:white;
  color:black;
  font-weight:bold;
}
#result{
  margin-top:15px;
  white-space:pre-wrap;
  font-size:14px;
}
</style>
</head>
<body>
<div class="box">
<h1>CELESTIAL LEGENDS IDP</h1>
<p>Register the Discord /admin command.</p>

<input id="code" type="password" placeholder="Setup code">

<button onclick="setup()">Register /admin</button>

<div id="result"></div>
</div>

<script>
async function setup(){
  const code=document.getElementById("code").value;
  const result=document.getElementById("result");

  result.textContent="Registering...";

  try{
    const response=await fetch("/setup",{
      method:"POST",
      headers:{
        "Authorization":"Bearer "+code
      }
    });

    const text=await response.text();
    result.textContent=text;
  }catch(error){
    result.textContent="ERROR: "+error.message;
  }
}
</script>
</body>
</html>`,
          {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=UTF-8"
            }
          }
        );
      }

      // -----------------------------
      // SETUP COMMAND
      // -----------------------------
      if (request.method === "POST" && url.pathname === "/setup") {
        const authorization = request.headers.get("Authorization");

        if (!env.SETUP_CODE) {
          return json({
            ok: false,
            error: "SETUP_CODE secret is missing"
          }, 500);
        }

        if (authorization !== `Bearer ${env.SETUP_CODE}`) {
          return json({
            ok: false,
            error: "Invalid setup code"
          }, 401);
        }

        return await registerAdminCommand(env);
      }

      // -----------------------------
      // DISCORD INTERACTIONS
      // -----------------------------
      if (
        request.method === "POST" &&
        url.pathname === "/discord/interactions"
      ) {
        return await handleDiscordInteraction(request, env);
      }

      return json({
        ok: false,
        error: "Not found"
      }, 404);

    } catch (error) {
      console.error("TOP LEVEL WORKER ERROR:", error);

      return json({
        ok: false,
        error: "Internal Worker error",
        detail: error?.message || String(error)
      }, 500);
    }
  }
};


// ======================================================
// REGISTER /ADMIN
// ======================================================

async function registerAdminCommand(env) {
  try {
    if (!env.APPLICATION_ID) {
      return json({
        ok: false,
        error: "APPLICATION_ID secret is missing"
      }, 500);
    }

    if (!env.DISCORD_TOKEN) {
      return json({
        ok: false,
        error: "DISCORD_TOKEN secret is missing"
      }, 500);
    }

    const command = {
      name: "admin",
      description: "Open the CELESTIAL LEGENDS admin panel"
    };

    const response = await fetch(
      `https://discord.com/api/v10/applications/${env.APPLICATION_ID}/commands`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bot ${env.DISCORD_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([command])
      }
    );

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    if (!response.ok) {
      console.error(
        "DISCORD COMMAND REGISTRATION ERROR:",
        response.status,
        data
      );

      return json({
        ok: false,
        error: "Discord command registration failed",
        discord_status: response.status,
        details: data
      }, 500);
    }

    return json({
      ok: true,
      message: "The /admin command was registered successfully."
    });

  } catch (error) {
    console.error("REGISTER COMMAND ERROR:", error);

    return json({
      ok: false,
      error: error?.message || "Command registration error"
    }, 500);
  }
}


// ======================================================
// DISCORD INTERACTION HANDLER
// ======================================================

async function handleDiscordInteraction(request, env) {
  const signature =
    request.headers.get("X-Signature-Ed25519");

  const timestamp =
    request.headers.get("X-Signature-Timestamp");

  const body = await request.text();

  console.log(
    "DISCORD INTERACTION RECEIVED:",
    JSON.stringify({
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      bodyLength: body.length
    })
  );

  if (!signature) {
    console.error("Missing Discord signature");
    return new Response("Missing signature", {
      status: 401
    });
  }

  if (!timestamp) {
    console.error("Missing Discord timestamp");
    return new Response("Missing timestamp", {
      status: 401
    });
  }

  if (!env.DISCORD_PUBLIC_KEY) {
    console.error("DISCORD_PUBLIC_KEY secret is missing");

    return new Response("DISCORD_PUBLIC_KEY missing", {
      status: 500
    });
  }

  // Verify Discord's Ed25519 signature.
  let valid = false;

  try {
    valid = await verifyDiscordSignature(
      signature,
      timestamp,
      body,
      env.DISCORD_PUBLIC_KEY
    );
  } catch (error) {
    console.error(
      "SIGNATURE VERIFICATION EXCEPTION:",
      error
    );

    return new Response(
      "Signature verification error",
      { status: 401 }
    );
  }

  if (!valid) {
    console.error("Discord signature was INVALID");

    return new Response("Invalid Discord signature", {
      status: 401
    });
  }

  console.log("Discord signature verified.");

  let interaction;

  try {
    interaction = JSON.parse(body);
  } catch (error) {
    console.error("DISCORD JSON ERROR:", error);

    return new Response("Invalid JSON", {
      status: 400
    });
  }

  console.log(
    "Discord interaction type:",
    interaction.type
  );

  // ====================================================
  // TYPE 1 = PING
  // Discord uses this when validating the endpoint.
  // ====================================================

  if (interaction.type === 1) {
    return discordJson({
      type: 1
    });
  }

  // ====================================================
  // TYPE 2 = SLASH COMMAND
  // ====================================================

  if (interaction.type === 2) {
    const commandName = interaction.data?.name;

    console.log(
      "Discord command:",
      commandName
    );

    if (commandName === "admin") {
      const userId =
        interaction.member?.user?.id ||
        interaction.user?.id;

      if (!userId) {
        return discordMessage(
          "Unable to identify your Discord account."
        );
      }

      return discordJson({
        type: 9,

        data: {
          custom_id: `admin_login:${userId}`,

          title: "CELESTIAL LEGENDS ADMIN",

          components: [
            inputRow(
              "admin_code",
              "Admin Code",
              "Enter the admin code"
            )
          ]
        }
      });
    }

    return discordMessage(
      "Unknown slash command."
    );
  }

  // ====================================================
  // TYPE 5 = MODAL SUBMIT
  // ====================================================

  if (interaction.type === 5) {
    return await handleModalSubmit(
      interaction,
      env
    );
  }

  // ====================================================
  // TYPE 3 = BUTTON
  // ====================================================

  if (interaction.type === 3) {
    return await handleButtonClick(
      interaction,
      env
    );
  }

  return discordMessage(
    "Unsupported Discord interaction type."
  );
}


// ======================================================
// ED25519 VERIFICATION
// ======================================================

async function verifyDiscordSignature(
  signatureHex,
  timestamp,
  body,
  publicKeyHex
) {
  if (
    typeof signatureHex !== "string" ||
    typeof timestamp !== "string" ||
    typeof body !== "string" ||
    typeof publicKeyHex !== "string"
  ) {
    throw new Error(
      "Invalid signature verification input"
    );
  }

  const publicKey = hexToBytes(
    publicKeyHex,
    "Discord public key"
  );

  const signature = hexToBytes(
    signatureHex,
    "Discord signature"
  );

  // Discord public keys are 32 bytes.
  if (publicKey.length !== 32) {
    throw new Error(
      `Discord public key must be 32 bytes, received ${publicKey.length}`
    );
  }

  // Ed25519 signatures are 64 bytes.
  if (signature.length !== 64) {
    throw new Error(
      `Discord signature must be 64 bytes, received ${signature.length}`
    );
  }

  const message =
    new TextEncoder().encode(
      timestamp + body
    );

  const cryptoKey =
    await crypto.subtle.importKey(
      "raw",
      publicKey,
      {
        name: "Ed25519"
      },
      false,
      ["verify"]
    );

  return await crypto.subtle.verify(
    {
      name: "Ed25519"
    },
    cryptoKey,
    signature,
    message
  );
}


function hexToBytes(hex, label = "hex value") {
  if (
    typeof hex !== "string" ||
    hex.length === 0
  ) {
    throw new Error(
      `${label} is missing`
    );
  }

  if (hex.length % 2 !== 0) {
    throw new Error(
      `${label} has invalid hexadecimal length`
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      `${label} contains invalid hexadecimal characters`
    );
  }

  const bytes =
    new Uint8Array(hex.length / 2);

  for (
    let i = 0;
    i < hex.length;
    i += 2
  ) {
    bytes[i / 2] =
      parseInt(
        hex.slice(i, i + 2),
        16
      );
  }

  return bytes;
}


// ======================================================
// GENERIC JSON RESPONSE
// ======================================================

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8"
      }
    }
  );
}


// ======================================================
// DISCORD JSON RESPONSE
// ======================================================

function discordJson(data) {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8"
      }
    }
  );
}
async function handleButtonClick(
  interaction,
  env
) {
  const customId =
    interaction.data?.custom_id || "";

  const parts =
    customId.split(":");

  const action = parts[0];
  const adminUserId = parts[1];

  const currentUserId =
    interaction.member?.user?.id ||
    interaction.user?.id;

  // Security check:
  // Only the Discord user who opened the panel
  // can use its buttons.
  if (
    !adminUserId ||
    !currentUserId ||
    currentUserId !== adminUserId
  ) {
    return discordMessage(
      "You are not authorized to use this admin panel."
    );
  }

  console.log(
    "ADMIN BUTTON:",
    action
  );

  // -----------------------------
  // BACK TO ADMIN
  // -----------------------------

  if (action === "admin") {
    return adminPanel(
      adminUserId
    );
  }

  // -----------------------------
  // VIEW MANAGERS
  // -----------------------------

  if (action === "managers") {
    return await showManagers(
      env,
      adminUserId
    );
  }

  // -----------------------------
  // VIEW SOURCES
  // -----------------------------

  if (action === "sources") {
    return await showSources(
      env,
      adminUserId
    );
  }

  // -----------------------------
  // VIEW DESTINATIONS
  // -----------------------------

  if (action === "destinations") {
    return await showDestinations(
      env,
      adminUserId
    );
  }

  // -----------------------------
  // ADD MANAGER
  // -----------------------------

  if (action === "add_manager") {
    return discordJson({
      type: 9,

      data: {
        custom_id:
          `add_manager:${adminUserId}`,

        title: "ADD MANAGER",

        components: [
          inputRow(
            "manager_name",
            "Manager Name",
            "Enter manager name",
            true
          ),

          inputRow(
            "manager_discord_id",
            "Discord User ID",
            "Optional Discord user ID",
            false
          )
        ]
      }
    });
  }

  // -----------------------------
  // ADD SOURCE
  // -----------------------------

  if (action === "add_source") {
    return discordJson({
      type: 9,

      data: {
        custom_id:
          `add_source:${adminUserId}`,

        title: "ADD IDP SOURCE",

        components: [
          inputRow(
            "source_manager_id",
            "Manager ID",
            "Enter manager database ID",
            true
          ),

          inputRow(
            "source_name",
            "Source Name",
            "Example: Main IDP",
            true
          ),

          inputRow(
            "source_channel",
            "Channel Name",
            "Example: idp-results",
            false
          ),

          inputRow(
            "source_type",
            "Source Type",
            "Example: discord",
            false
          ),

          inputRow(
            "source_url",
            "Source URL",
            "Optional source URL",
            false
          )
        ]
      }
    });
  }

  // -----------------------------
  // ADD DESTINATION
  // -----------------------------

  if (action === "add_destination") {
    return discordJson({
      type: 9,

      data: {
        custom_id:
          `add_destination:${adminUserId}`,

        title: "ADD DESTINATION",

        components: [
          inputRow(
            "destination_source_id",
            "Source ID",
            "Enter source database ID",
            true
          ),

          inputRow(
            "destination_guild_id",
            "Discord Server ID",
            "Enter Discord server ID",
            true
          ),

          inputRow(
            "destination_channel_id",
            "Channel ID",
            "Enter destination channel ID",
            true
          )
        ]
      }
    });
  }

  return discordMessage(
    "Unknown admin action."
  );
}


// ======================================================
// MODAL SUBMISSIONS
// ======================================================

async function handleModalSubmit(
  interaction,
  env
) {
  const customId =
    interaction.data?.custom_id || "";

  const parts =
    customId.split(":");

  const action = parts[0];
  const adminUserId = parts[1];

  const currentUserId =
    interaction.member?.user?.id ||
    interaction.user?.id;

  if (
    !adminUserId ||
    !currentUserId ||
    currentUserId !== adminUserId
  ) {
    return discordMessage(
      "You are not authorized to use this admin panel."
    );
  }

  console.log(
    "ADMIN MODAL:",
    action
  );

  // ====================================================
  // ADMIN LOGIN
  // ====================================================

  if (action === "admin_login") {
    const code =
      getModalValue(
        interaction,
        "admin_code"
      );

    if (!env.ADMIN_CODE) {
      console.error(
        "ADMIN_CODE secret is missing"
      );

      return discordMessage(
        "ADMIN_CODE is not configured in Cloudflare."
      );
    }

    if (code !== env.ADMIN_CODE) {
      return discordMessage(
        "Invalid admin code."
      );
    }

    return adminPanel(
      adminUserId
    );
  }

  // ====================================================
  // ADD MANAGER
  // ====================================================

  if (action === "add_manager") {
    const name =
      getModalValue(
        interaction,
        "manager_name"
      );

    const discordUserId =
      getModalValue(
        interaction,
        "manager_discord_id"
      );

    if (!name) {
      return discordMessage(
        "Manager name is required."
      );
    }

    try {
      await env.DB
        .prepare(
          `INSERT INTO managers
           (name, discord_user_id)
           VALUES (?, ?)`
        )
        .bind(
          name,
          discordUserId || null
        )
        .run();

      return discordMessage(
        `Manager "${name}" added successfully.`
      );

    } catch (error) {
      console.error(
        "ADD MANAGER ERROR:",
        error
      );

      return discordMessage(
        `Failed to add manager: ${error?.message || "Database error"}`
      );
    }
  }

  // ====================================================
  // ADD SOURCE
  // ====================================================

  if (action === "add_source") {
    const managerId =
      getModalValue(
        interaction,
        "source_manager_id"
      );

    const name =
      getModalValue(
        interaction,
        "source_name"
      );

    const channelName =
      getModalValue(
        interaction,
        "source_channel"
      );

    const sourceType =
      getModalValue(
        interaction,
        "source_type"
      ) || "discord";

    const sourceUrl =
      getModalValue(
        interaction,
        "source_url"
      );

    if (!managerId || !name) {
      return discordMessage(
        "Manager ID and source name are required."
      );
    }

    const managerNumber =
      Number(managerId);

    if (
      !Number.isInteger(managerNumber) ||
      managerNumber <= 0
    ) {
      return discordMessage(
        "Manager ID must be a valid number."
      );
    }

    // Make sure the manager actually exists.
    try {
      const manager =
        await env.DB
          .prepare(
            `SELECT id
             FROM managers
             WHERE id = ?`
          )
          .bind(managerNumber)
          .first();

      if (!manager) {
        return discordMessage(
          `Manager #${managerNumber} does not exist.`
        );
      }

      await env.DB
        .prepare(
          `INSERT INTO sources
           (
             manager_id,
             name,
             channel_name,
             source_type,
             source_url
           )
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          managerNumber,
          name,
          channelName || null,
          sourceType,
          sourceUrl || null
        )
        .run();

      return discordMessage(
        `Source "${name}" added successfully.`
      );

    } catch (error) {
      console.error(
        "ADD SOURCE ERROR:",
        error
      );

      return discordMessage(
        `Failed to add source: ${error?.message || "Database error"}`
      );
    }
  }

  // ====================================================
  // ADD DESTINATION
  // ====================================================

  if (action === "add_destination") {
    const sourceId =
      getModalValue(
        interaction,
        "destination_source_id"
      );

    const guildId =
      getModalValue(
        interaction,
        "destination_guild_id"
      );

    const channelId =
      getModalValue(
        interaction,
        "destination_channel_id"
      );

    if (
      !sourceId ||
      !guildId ||
      !channelId
    ) {
      return discordMessage(
        "All destination fields are required."
      );
    }

    const sourceNumber =
      Number(sourceId);

    if (
      !Number.isInteger(sourceNumber) ||
      sourceNumber <= 0
    ) {
      return discordMessage(
        "Source ID must be a valid number."
      );
    }

    try {
      const source =
        await env.DB
          .prepare(
            `SELECT id
             FROM sources
             WHERE id = ?`
          )
          .bind(sourceNumber)
          .first();

      if (!source) {
        return discordMessage(
          `Source #${sourceNumber} does not exist.`
        );
      }

      await env.DB
        .prepare(
          `INSERT INTO destinations
           (
             source_id,
             guild_id,
             channel_id
           )
           VALUES (?, ?, ?)`
        )
        .bind(
          sourceNumber,
          guildId,
          channelId
        )
        .run();

      return discordMessage(
        "Destination added successfully."
      );

    } catch (error) {
      console.error(
        "ADD DESTINATION ERROR:",
        error
      );

      return discordMessage(
        `Failed to add destination: ${error?.message || "Database error"}`
      );
    }
  }

  return discordMessage(
    "Unknown modal."
  );
}


// ======================================================
// ADMIN PANEL
// ======================================================

function adminPanel(userId) {
  return discordJson({
    type: 4,

    data: {
      content:
        "### CELESTIAL LEGENDS ADMIN PANEL\nChoose an option:",

      flags: 64,

      components: [
        row([
          button(
            "Managers",
            `managers:${userId}`,
            1
          ),

          button(
            "IDP Sources",
            `sources:${userId}`,
            1
          )
        ]),

        row([
          button(
            "Destinations",
            `destinations:${userId}`,
            1
          )
        ]),

        row([
          button(
            "Add Manager",
            `add_manager:${userId}`,
            3
          ),

          button(
            "Add Source",
            `add_source:${userId}`,
            3
          )
        ]),

        row([
          button(
            "Add Destination",
            `add_destination:${userId}`,
            3
          )
        ])
      ]
    }
  });
}


// ======================================================
// MODAL VALUE READER
// ======================================================

function getModalValue(
  interaction,
  customId
) {
  const rows =
    interaction.data?.components || [];

  for (const actionRow of rows) {
    const components =
      actionRow.components || [];

    for (const component of components) {
      if (
        component.custom_id === customId
      ) {
        return (
          component.value?.trim() || ""
        );
      }
    }
  }

  return "";
}


// ======================================================
// DISCORD COMPONENT HELPERS
// ======================================================

function inputRow(
  customId,
  label,
  placeholder,
  required = true
) {
  return {
    type: 1,

    components: [
      {
        type: 4,
        custom_id: customId,
        label,
        style: 1,
        placeholder,
        required,
        max_length: 4000
      }
    ]
  };
}


function button(
  label,
  customId,
  style = 2
) {
  return {
    type: 2,
    style,
    label,
    custom_id: customId
  };
}


function row(components) {
  return {
    type: 1,
    components
  };
}
async function showManagers(
  env,
  userId
) {
  try {
    const result =
      await env.DB
        .prepare(
          `SELECT
             id,
             name,
             discord_user_id,
             active
           FROM managers
           ORDER BY id DESC`
        )
        .all();

    const managers =
      result?.results || [];

    if (managers.length === 0) {
      return discordJson({
        type: 4,

        data: {
          content:
            "### MANAGERS\n\nNo managers have been added yet.",

          flags: 64,

          components: [
            row([
              button(
                "Back",
                `admin:${userId}`,
                2
              )
            ])
          ]
        }
      });
    }

    let text =
      "### MANAGERS\n\n";

    for (const manager of managers) {
      text +=
        `**#${manager.id} — ${manager.name}**\n` +
        `Discord ID: ${manager.discord_user_id || "Not set"}\n` +
        `Status: ${manager.active ? "Active" : "Inactive"}\n\n`;
    }

    return discordJson({
      type: 4,

      data: {
        content: text,
        flags: 64,

        components: [
          row([
            button(
              "Back",
              `admin:${userId}`,
              2
            )
          ])
        ]
      }
    });

  } catch (error) {
    console.error(
      "SHOW MANAGERS ERROR:",
      error
    );

    return discordMessage(
      `Failed to load managers: ${error?.message || "Database error"}`
    );
  }
}


// ======================================================
// SHOW SOURCES
// ======================================================

async function showSources(
  env,
  userId
) {
  try {
    const result =
      await env.DB
        .prepare(
          `SELECT
             sources.id,
             sources.name,
             sources.channel_name,
             sources.source_type,
             sources.source_url,
             sources.active,
             managers.name AS manager_name
           FROM sources
           LEFT JOIN managers
             ON managers.id = sources.manager_id
           ORDER BY sources.id DESC`
        )
        .all();

    const sources =
      result?.results || [];

    if (sources.length === 0) {
      return discordJson({
        type: 4,

        data: {
          content:
            "### IDP SOURCES\n\nNo sources have been added yet.",

          flags: 64,

          components: [
            row([
              button(
                "Back",
                `admin:${userId}`,
                2
              )
            ])
          ]
        }
      });
    }

    let text =
      "### IDP SOURCES\n\n";

    for (const source of sources) {
      text +=
        `**#${source.id} — ${source.name}**\n` +
        `Manager: ${source.manager_name || "Unknown"}\n` +
        `Channel: ${source.channel_name || "Not set"}\n` +
        `Type: ${source.source_type || "Unknown"}\n` +
        `Status: ${source.active ? "Active" : "Inactive"}\n\n`;
    }

    return discordJson({
      type: 4,

      data: {
        content: text,
        flags: 64,

        components: [
          row([
            button(
              "Back",
              `admin:${userId}`,
              2
            )
          ])
        ]
      }
    });

  } catch (error) {
    console.error(
      "SHOW SOURCES ERROR:",
      error
    );

    return discordMessage(
      `Failed to load sources: ${error?.message || "Database error"}`
    );
  }
}


// ======================================================
// SHOW DESTINATIONS
// ======================================================

async function showDestinations(
  env,
  userId
) {
  try {
    const result =
      await env.DB
        .prepare(
          `SELECT
             destinations.id,
             destinations.guild_id,
             destinations.channel_id,
             destinations.active,
             sources.name AS source_name
           FROM destinations
           LEFT JOIN sources
             ON sources.id = destinations.source_id
           ORDER BY destinations.id DESC`
        )
        .all();

    const destinations =
      result?.results || [];

    if (destinations.length === 0) {
      return discordJson({
        type: 4,

        data: {
          content:
            "### DESTINATIONS\n\nNo destinations have been added yet.",

          flags: 64,

          components: [
            row([
              button(
                "Back",
                `admin:${userId}`,
                2
              )
            ])
          ]
        }
      });
    }

    let text =
      "### DESTINATIONS\n\n";

    for (const destination of destinations) {
      text +=
        `**#${destination.id}**\n` +
        `Source: ${destination.source_name || "Unknown"}\n` +
        `Server ID: ${destination.guild_id}\n` +
        `Channel ID: ${destination.channel_id}\n` +
        `Status: ${destination.active ? "Active" : "Inactive"}\n\n`;
    }

    return discordJson({
      type: 4,

      data: {
        content: text,
        flags: 64,

        components: [
          row([
            button(
              "Back",
              `admin:${userId}`,
              2
            )
          ])
        ]
      }
    });

  } catch (error) {
    console.error(
      "SHOW DESTINATIONS ERROR:",
      error
    );

    return discordMessage(
      `Failed to load destinations: ${error?.message || "Database error"}`
    );
  }
}


// ======================================================
// SIMPLE DISCORD MESSAGE
// ======================================================

function discordMessage(
  content,
  components = []
) {
  return discordJson({
    type: 4,

    data: {
      content,
      flags: 64,
      components
    }
  });
}
