export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // ================================
      // HEALTH CHECK
      // ================================

      if (
        request.method === "GET" &&
        url.pathname === "/api/health"
      ) {
        return json({
          ok: true,
          status: "online",
          database: "connected"
        });
      }

      // ================================
      // SETUP PAGE
      // ================================

      if (
        request.method === "GET" &&
        url.pathname === "/setup"
      ) {
        return new Response(
          `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CELESTIAL LEGENDS Setup</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111;
      color: #fff;
      font-family: Arial, sans-serif;
    }

    .box {
      width: min(90%, 420px);
      background: #1d1d1d;
      padding: 25px;
      border-radius: 18px;
    }

    h2 {
      margin-top: 0;
    }

    input,
    button {
      width: 100%;
      padding: 14px;
      margin-top: 12px;
      border-radius: 10px;
      border: 0;
      font-size: 16px;
    }

    button {
      background: #fff;
      color: #000;
      font-weight: bold;
    }

    #result {
      margin-top: 15px;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>

<body>

  <div class="box">
    <h2>CELESTIAL LEGENDS</h2>

    <p>Discord bot setup</p>

    <input
      id="code"
      type="password"
      placeholder="Enter setup code"
    >

    <button onclick="setup()">
      Register /admin
    </button>

    <div id="result"></div>
  </div>

  <script>
    async function setup() {
      const code =
        document.getElementById("code").value;

      const result =
        document.getElementById("result");

      result.textContent = "Setting up...";

      try {
        const response = await fetch("/setup", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + code
          }
        });

        const data = await response.json();

        result.textContent =
          JSON.stringify(data, null, 2);

      } catch (error) {
        result.textContent =
          "ERROR: " + error.message;
      }
    }
  </script>

</body>
</html>`,
          {
            headers: {
              "Content-Type":
                "text/html; charset=UTF-8"
            }
          }
        );
      }

      // ================================
      // SETUP POST
      // ================================

      if (
        request.method === "POST" &&
        url.pathname === "/setup"
      ) {
        const authorization =
          request.headers.get("Authorization");

        if (
          authorization !==
          `Bearer ${env.SETUP_CODE}`
        ) {
          return json(
            {
              ok: false,
              error: "Invalid setup code"
            },
            401
          );
        }

        return await registerAdminCommand(env);
      }

      // ================================
      // DISCORD INTERACTIONS
      // ================================

      if (
        request.method === "POST" &&
        url.pathname === "/discord/interactions"
      ) {
        return await handleDiscordInteraction(
          request,
          env
        );
      }

      // ================================
      // 404
      // ================================

      return json(
        {
          ok: false,
          error: "Not found"
        },
        404
      );

    } catch (error) {

      console.error(
        "WORKER ERROR:",
        error
      );

      return json(
        {
          ok: false,
          error: error?.message ||
            "Unknown Worker error"
        },
        500
      );
    }
  }
};


// ======================================
// REGISTER /ADMIN
// ======================================

async function registerAdminCommand(env) {

  if (!env.APPLICATION_ID) {
    return json(
      {
        ok: false,
        error: "APPLICATION_ID secret is missing"
      },
      500
    );
  }

  if (!env.DISCORD_TOKEN) {
    return json(
      {
        ok: false,
        error: "DISCORD_TOKEN secret is missing"
      },
      500
    );
  }

  const command = {
    name: "admin",
    description:
      "Open the CELESTIAL LEGENDS admin panel"
  };

  const response = await fetch(
    `https://discord.com/api/v10/applications/${env.APPLICATION_ID}/commands`,
    {
      method: "PUT",

      headers: {
        "Authorization":
          `Bot ${env.DISCORD_TOKEN}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify([
        command
      ])
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    return json(
      {
        ok: false,
        error:
          "Discord command registration failed",

        discord_status:
          response.status,

        details:
          data
      },
      response.status
    );
  }

  return json({
    ok: true,

    message:
      "The /admin command was registered successfully."
  });
}


// ======================================
// DISCORD INTERACTION HANDLER
// ======================================

async function handleDiscordInteraction(
  request,
  env
) {

  const signature =
    request.headers.get(
      "X-Signature-Ed25519"
    );

  const timestamp =
    request.headers.get(
      "X-Signature-Timestamp"
    );

  // IMPORTANT:
  // Discord signs the exact raw request body.

  const body =
    await request.text();

  if (!signature) {
    console.error(
      "Missing X-Signature-Ed25519"
    );

    return new Response(
      "Missing signature",
      {
        status: 401
      }
    );
  }

  if (!timestamp) {
    console.error(
      "Missing X-Signature-Timestamp"
    );

    return new Response(
      "Missing timestamp",
      {
        status: 401
      }
    );
  }

  if (!env.DISCORD_PUBLIC_KEY) {
    console.error(
      "DISCORD_PUBLIC_KEY secret is missing"
    );

    return new Response(
      "DISCORD_PUBLIC_KEY missing",
      {
        status: 500
      }
    );
  }

  const valid =
    await verifyDiscordSignature(
      signature,
      timestamp,
      body,
      env.DISCORD_PUBLIC_KEY
    );

  if (!valid) {
    console.error(
      "Discord signature verification failed"
    );

    return new Response(
      "Invalid Discord signature",
      {
        status: 401
      }
    );
  }

  let interaction;

  try {
    interaction =
      JSON.parse(body);
  } catch (error) {

    console.error(
      "Invalid JSON:",
      error
    );

    return new Response(
      "Invalid JSON",
      {
        status: 400
      }
    );
  }

  // ================================
  // DISCORD PING
  // ================================

  if (interaction.type === 1) {

    return Response.json({
      type: 1
    });
  }

  // ================================
  // SLASH COMMAND
  // ================================

  if (interaction.type === 2) {

    const commandName =
      interaction.data?.name;

    if (commandName === "admin") {

      const userId =
        interaction.member?.user?.id ||
        interaction.user?.id;

      if (!userId) {
        return discordMessage(
          "Unable to identify your Discord account."
        );
      }

      return Response.json({
        type: 9,

        data: {
          custom_id:
            `admin_login:${userId}`,

          title:
            "CELESTIAL LEGENDS ADMIN",

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
  }

  // ================================
  // MODAL SUBMIT
  // ================================

  if (interaction.type === 5) {

    return await handleModalSubmit(
      interaction,
      env
    );
  }

  // ================================
  // BUTTON
  // ================================

  if (interaction.type === 3) {

    return await handleButtonClick(
      interaction,
      env
    );
  }

  return discordMessage(
    "Unknown Discord interaction."
  );
}


// ======================================
// DISCORD SIGNATURE VERIFICATION
// ======================================

async function verifyDiscordSignature(
  signatureHex,
  timestamp,
  body,
  publicKeyHex
) {

  try {

    const publicKeyBytes =
      hexToBytes(publicKeyHex);

    const signatureBytes =
      hexToBytes(signatureHex);

    const message =
      new TextEncoder().encode(
        timestamp + body
      );

    const publicKey =
      await crypto.subtle.importKey(
        "raw",

        publicKeyBytes,

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

      publicKey,

      signatureBytes,

      message
    );

  } catch (error) {

    console.error(
      "Signature verification error:",
      error
    );

    return false;
  }
}


// ======================================
// HEX → UINT8ARRAY
// ======================================

function hexToBytes(hex) {

  if (
    !hex ||
    typeof hex !== "string" ||
    hex.length % 2 !== 0
  ) {
    throw new Error(
      "Invalid hexadecimal value"
    );
  }

  const bytes =
    new Uint8Array(
      hex.length / 2
    );

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


// ======================================
// NORMAL JSON RESPONSE
// ======================================

function json(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(data),

    {
      status,

      headers: {
        "Content-Type":
          "application/json"
      }
    }
  );
}
// ======================================
// BUTTON HANDLER
// ======================================

async function handleButtonClick(
  interaction,
  env
) {

  const customId =
    interaction.data?.custom_id || "";

  const parts =
    customId.split(":");

  const action =
    parts[0];

  const adminUserId =
    parts[1];

  const currentUserId =
    interaction.member?.user?.id ||
    interaction.user?.id;

  if (
    !adminUserId ||
    currentUserId !== adminUserId
  ) {

    return discordMessage(
      "You are not authorized to use this admin panel."
    );
  }

  // -------------------------------
  // MANAGERS
  // -------------------------------

  if (action === "managers") {

    return await showManagers(
      env,
      adminUserId
    );
  }

  // -------------------------------
  // SOURCES
  // -------------------------------

  if (action === "sources") {

    return await showSources(
      env,
      adminUserId
    );
  }

  // -------------------------------
  // DESTINATIONS
  // -------------------------------

  if (action === "destinations") {

    return await showDestinations(
      env,
      adminUserId
    );
  }

  // -------------------------------
  // ADD MANAGER
  // -------------------------------

  if (action === "add_manager") {

    return Response.json({
      type: 9,

      data: {
        custom_id:
          `add_manager:${adminUserId}`,

        title:
          "ADD MANAGER",

        components: [

          inputRow(
            "manager_name",
            "Manager Name",
            "Enter manager name"
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

  // -------------------------------
  // ADD SOURCE
  // -------------------------------

  if (action === "add_source") {

    return Response.json({
      type: 9,

      data: {
        custom_id:
          `add_source:${adminUserId}`,

        title:
          "ADD IDP SOURCE",

        components: [

          inputRow(
            "source_manager_id",
            "Manager ID",
            "Enter manager database ID"
          ),

          inputRow(
            "source_name",
            "Source Name",
            "Example: Main IDP"
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

  // -------------------------------
  // ADD DESTINATION
  // -------------------------------

  if (action === "add_destination") {

    return Response.json({
      type: 9,

      data: {
        custom_id:
          `add_destination:${adminUserId}`,

        title:
          "ADD DESTINATION",

        components: [

          inputRow(
            "destination_source_id",
            "Source ID",
            "Enter source database ID"
          ),

          inputRow(
            "destination_guild_id",
            "Discord Server ID",
            "Enter Discord server ID"
          ),

          inputRow(
            "destination_channel_id",
            "Channel ID",
            "Enter destination channel ID"
          )
        ]
      }
    });
  }

  // -------------------------------
  // BACK TO ADMIN
  // -------------------------------

  if (action === "admin") {

    return adminPanel(
      adminUserId
    );
  }

  return discordMessage(
    "Unknown admin action."
  );
}


// ======================================
// MODAL HANDLER
// ======================================

async function handleModalSubmit(
  interaction,
  env
) {

  const customId =
    interaction.data?.custom_id || "";

  const parts =
    customId.split(":");

  const action =
    parts[0];

  const adminUserId =
    parts[1];

  const currentUserId =
    interaction.member?.user?.id ||
    interaction.user?.id;

  if (
    !adminUserId ||
    currentUserId !== adminUserId
  ) {

    return discordMessage(
      "You are not authorized to use this admin panel."
    );
  }

  // ================================
  // ADMIN LOGIN
  // ================================

  if (action === "admin_login") {

    const code =
      getModalValue(
        interaction,
        "admin_code"
      );

    if (
      !env.ADMIN_CODE
    ) {

      console.error(
        "ADMIN_CODE secret is missing"
      );

      return discordMessage(
        "ADMIN_CODE is not configured in Cloudflare."
      );
    }

    if (
      code !== env.ADMIN_CODE
    ) {

      return discordMessage(
        "Invalid admin code."
      );
    }

    return adminPanel(
      adminUserId
    );
  }

  // ================================
  // ADD MANAGER
  // ================================

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

      await env.DB.prepare(
        `INSERT INTO managers
        (
          name,
          discord_user_id
        )
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
        `Failed to add manager: ${error.message}`
      );
    }
  }

  // ================================
  // ADD SOURCE
  // ================================

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

    if (
      !managerId ||
      !name
    ) {

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

    try {

      await env.DB.prepare(
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
        `Failed to add source: ${error.message}`
      );
    }
  }

  // ================================
  // ADD DESTINATION
  // ================================

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

      await env.DB.prepare(
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
        `Failed to add destination: ${error.message}`
      );
    }
  }

  return discordMessage(
    "Unknown modal."
  );
}


// ======================================
// ADMIN PANEL
// ======================================

function adminPanel(
  userId
) {

  return Response.json({

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


// ======================================
// GET MODAL VALUE
// ======================================

function getModalValue(
  interaction,
  customId
) {

  const rows =
    interaction.data?.components || [];

  for (
    const actionRow of rows
  ) {

    const components =
      actionRow.components || [];

    for (
      const component of components
    ) {

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


// ======================================
// MODAL INPUT ROW
// ======================================

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


// ======================================
// BUTTON
// ======================================

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


// ======================================
// ACTION ROW
// ======================================

function row(
  components
) {

  return {

    type: 1,

    components
  };
}
// ======================================
// SHOW MANAGERS
// ======================================

async function showManagers(env, userId) {
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, discord_user_id, active
       FROM managers
       ORDER BY id DESC`
    ).all();

    const managers = result.results || [];

    if (managers.length === 0) {
      return Response.json({
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

    let text = "### MANAGERS\n\n";

    for (const manager of managers) {
      text +=
        `**#${manager.id} — ${manager.name}**\n` +
        `Discord ID: ${manager.discord_user_id || "Not set"}\n` +
        `Status: ${manager.active ? "Active" : "Inactive"}\n\n`;
    }

    return Response.json({
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
      `Failed to load managers: ${error.message}`
    );
  }
}


// ======================================
// SHOW SOURCES
// ======================================

async function showSources(env, userId) {
  try {
    const result = await env.DB.prepare(
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
    ).all();

    const sources = result.results || [];

    if (sources.length === 0) {
      return Response.json({
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

    let text = "### IDP SOURCES\n\n";

    for (const source of sources) {
      text +=
        `**#${source.id} — ${source.name}**\n` +
        `Manager: ${source.manager_name || "Unknown"}\n` +
        `Channel: ${source.channel_name || "Not set"}\n` +
        `Type: ${source.source_type}\n` +
        `Status: ${source.active ? "Active" : "Inactive"}\n\n`;
    }

    return Response.json({
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
      `Failed to load sources: ${error.message}`
    );
  }
}


// ======================================
// SHOW DESTINATIONS
// ======================================

async function showDestinations(env, userId) {
  try {
    const result = await env.DB.prepare(
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
    ).all();

    const destinations =
      result.results || [];

    if (destinations.length === 0) {
      return Response.json({
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

    for (
      const destination
      of destinations
    ) {
      text +=
        `**#${destination.id}**\n` +
        `Source: ${destination.source_name || "Unknown"}\n` +
        `Server ID: ${destination.guild_id}\n` +
        `Channel ID: ${destination.channel_id}\n` +
        `Status: ${destination.active ? "Active" : "Inactive"}\n\n`;
    }

    return Response.json({
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
      `Failed to load destinations: ${error.message}`
    );
  }
}


// ======================================
// DISCORD MESSAGE
// ======================================

function discordMessage(
  content,
  components = []
) {

  return Response.json({
    type: 4,

    data: {
      content,

      flags: 64,

      components
    }
  });
}
