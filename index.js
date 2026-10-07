export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // ─────────────────────────────────────────────
      // BASIC
      // ─────────────────────────────────────────────

      if (request.method === "GET" && url.pathname === "/") {
        return json({
          ok: true,
          name: "CELESTIAL LEGENDS IDP bot",
          runtime: "Cloudflare Workers",
          status: "online"
        });
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({
          ok: true,
          status: "online",
          database: "connected"
        });
      }

      // ─────────────────────────────────────────────
      // DISCORD INTERACTIONS ENDPOINT
      // ─────────────────────────────────────────────

      if (
        request.method === "POST" &&
        url.pathname === "/discord/interactions"
      ) {
        return await handleDiscordInteraction(request, env);
      }

      // ─────────────────────────────────────────────
      // COMMAND REGISTRATION
      // ─────────────────────────────────────────────

      if (
        request.method === "POST" &&
        url.pathname === "/api/register-command"
      ) {
        const auth = request.headers.get("Authorization");

        if (auth !== `Bearer ${env.SETUP_CODE}`) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        return await registerAdminCommand(env);
      }

      // ─────────────────────────────────────────────
      // MANAGERS
      // ─────────────────────────────────────────────

      if (url.pathname === "/api/managers" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT *
          FROM managers
          ORDER BY id DESC
        `).all();

        return json({
          ok: true,
          managers: result.results
        });
      }

      if (url.pathname === "/api/managers" && request.method === "POST") {
        const body = await request.json();

        if (!body.name) {
          return json({
            ok: false,
            error: "Manager name is required"
          }, 400);
        }

        const result = await env.DB.prepare(`
          INSERT INTO managers
          (name, discord_user_id, active)
          VALUES (?, ?, 1)
        `)
          .bind(
            body.name,
            body.discord_user_id || null
          )
          .run();

        return json({
          ok: true,
          id: result.meta.last_row_id
        });
      }

      const managerMatch = url.pathname.match(
        /^\/api\/managers\/(\d+)$/
      );

      if (managerMatch) {
        const id = Number(managerMatch[1]);

        if (request.method === "DELETE") {
          await env.DB.prepare(`
            DELETE FROM managers
            WHERE id = ?
          `).bind(id).run();

          return json({
            ok: true
          });
        }

        if (request.method === "PATCH") {
          const body = await request.json();

          if (body.active !== undefined) {
            await env.DB.prepare(`
              UPDATE managers
              SET active = ?
              WHERE id = ?
            `)
              .bind(
                body.active ? 1 : 0,
                id
              )
              .run();
          }

          if (body.name !== undefined) {
            await env.DB.prepare(`
              UPDATE managers
              SET name = ?
              WHERE id = ?
            `)
              .bind(body.name, id)
              .run();
          }

          return json({
            ok: true
          });
        }
      }

      // ─────────────────────────────────────────────
      // SOURCES
      // ─────────────────────────────────────────────

      if (url.pathname === "/api/sources" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT
            sources.*,
            managers.name AS manager_name
          FROM sources
          LEFT JOIN managers
            ON managers.id = sources.manager_id
          ORDER BY sources.id DESC
        `).all();

        return json({
          ok: true,
          sources: result.results
        });
      }

      if (url.pathname === "/api/sources" && request.method === "POST") {
        const body = await request.json();

        if (!body.manager_id || !body.name || !body.source_type) {
          return json({
            ok: false,
            error: "manager_id, name and source_type are required"
          }, 400);
        }

        const result = await env.DB.prepare(`
          INSERT INTO sources
          (
            manager_id,
            name,
            channel_name,
            source_type,
            source_url,
            active
          )
          VALUES (?, ?, ?, ?, ?, 1)
        `)
          .bind(
            body.manager_id,
            body.name,
            body.channel_name || null,
            body.source_type,
            body.source_url || null
          )
          .run();

        return json({
          ok: true,
          id: result.meta.last_row_id
        });
      }

      const sourceMatch = url.pathname.match(
        /^\/api\/sources\/(\d+)$/
      );

      if (sourceMatch) {
        const id = Number(sourceMatch[1]);

        if (request.method === "DELETE") {
          await env.DB.prepare(`
            DELETE FROM sources
            WHERE id = ?
          `).bind(id).run();

          return json({
            ok: true
          });
        }

        if (request.method === "PATCH") {
          const body = await request.json();

          if (body.active !== undefined) {
            await env.DB.prepare(`
              UPDATE sources
              SET active = ?
              WHERE id = ?
            `)
              .bind(
                body.active ? 1 : 0,
                id
              )
              .run();
          }

          return json({
            ok: true
          });
        }
      }

      // ─────────────────────────────────────────────
      // DESTINATIONS
      // ─────────────────────────────────────────────

      if (
        url.pathname === "/api/destinations" &&
        request.method === "GET"
      ) {
        const result = await env.DB.prepare(`
          SELECT
            destinations.*,
            sources.name AS source_name
          FROM destinations
          LEFT JOIN sources
            ON sources.id = destinations.source_id
          ORDER BY destinations.id DESC
        `).all();

        return json({
          ok: true,
          destinations: result.results
        });
      }

      if (
        url.pathname === "/api/destinations" &&
        request.method === "POST"
      ) {
        const body = await request.json();

        if (
          !body.source_id ||
          !body.guild_id ||
          !body.channel_id
        ) {
          return json({
            ok: false,
            error: "source_id, guild_id and channel_id are required"
          }, 400);
        }

        const result = await env.DB.prepare(`
          INSERT INTO destinations
          (
            source_id,
            guild_id,
            channel_id,
            active
          )
          VALUES (?, ?, ?, 1)
        `)
          .bind(
            body.source_id,
            body.guild_id,
            body.channel_id
          )
          .run();

        return json({
          ok: true,
          id: result.meta.last_row_id
        });
      }

      const destinationMatch = url.pathname.match(
        /^\/api\/destinations\/(\d+)$/
      );

      if (destinationMatch) {
        const id = Number(destinationMatch[1]);

        if (request.method === "DELETE") {
          await env.DB.prepare(`
            DELETE FROM destinations
            WHERE id = ?
          `).bind(id).run();

          return json({
            ok: true
          });
        }

        if (request.method === "PATCH") {
          const body = await request.json();

          if (body.active !== undefined) {
            await env.DB.prepare(`
              UPDATE destinations
              SET active = ?
              WHERE id = ?
            `)
              .bind(
                body.active ? 1 : 0,
                id
              )
              .run();
          }

          return json({
            ok: true
          });
        }
      }

      return json({
        ok: false,
        error: "Not found"
      }, 404);

    } catch (error) {
      return json({
        ok: false,
        error: error.message
      }, 500);
    }
  }
};


// ═════════════════════════════════════════════════════
// DISCORD
// ═════════════════════════════════════════════════════

async function handleDiscordInteraction(request, env) {
  const signature = request.headers.get(
    "X-Signature-Ed25519"
  );

  const timestamp = request.headers.get(
    "X-Signature-Timestamp"
  );

  const body = await request.text();

  if (!signature || !timestamp) {
    return new Response("Missing signature", {
      status: 401
    });
  }

  const valid = await verifyDiscordSignature(
    signature,
    timestamp,
    body,
    env.DISCORD_PUBLIC_KEY
  );

  if (!valid) {
    return new Response("Invalid signature", {
      status: 401
    });
  }

  const interaction = JSON.parse(body);

  // Discord PING
  if (interaction.type === 1) {
    return json({
      type: 1
    });
  }

  // Slash command
  if (
    interaction.type === 2 &&
    interaction.data?.name === "admin"
  ) {
    return {
      ...modalResponse(),
      headers: {
        "Content-Type": "application/json"
      }
    };
  }

  // Modal submit
  if (
    interaction.type === 5 &&
    interaction.data?.custom_id === "admin_login"
  ) {
    const code =
      interaction.data.components?.[0]?.components?.[0]?.value;

    if (code !== env.ADMIN_CODE) {
      return discordResponse(
        "❌ Incorrect admin code."
      );
    }

    const token = await createAdminToken(
      interaction.member?.user?.id ||
      interaction.user?.id,
      env.ADMIN_CODE
    );

    return discordAdminPanel(token);
  }

  // Buttons
  if (
    interaction.type === 3 &&
    interaction.data?.custom_id
  ) {
    return await handleAdminButton(
      interaction,
      env
    );
  }

  // Select menus
  if (
    interaction.type === 3 &&
    interaction.data?.custom_id
  ) {
    return await handleAdminSelect(
      interaction,
      env
    );
  }

  return discordResponse(
    "Unknown interaction."
  );
}


// ═════════════════════════════════════════════════════
// ADMIN LOGIN MODAL
// ═════════════════════════════════════════════════════

function modalResponse() {
  return {
    type: 9,
    data: {
      custom_id: "admin_login",
      title: "CELESTIAL LEGENDS ADMIN",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "admin_code",
              label: "Admin Code",
              style: 1,
              required: true,
              min_length: 1,
              max_length: 100,
              placeholder: "Enter admin code"
            }
          ]
        }
      ]
    }
  };
}


// ═════════════════════════════════════════════════════
// ADMIN PANEL
// ═════════════════════════════════════════════════════

function discordAdminPanel(token) {
  return discordResponse(
    "🔐 **CELESTIAL LEGENDS ADMIN PANEL**\n\nChoose an option:",
    [
      row([
        button(
          "Managers",
          `adm:${token}:managers`,
          1
        ),
        button(
          "IDP Sources",
          `adm:${token}:sources`,
          1
        ),
        button(
          "Destinations",
          `adm:${token}:destinations`,
          1
        )
      ]),
      row([
        button(
          "Add Manager",
          `adm:${token}:addmanager`,
          3
        ),
        button(
          "Add Source",
          `adm:${token}:addsource`,
          3
        ),
        button(
          "Add Destination",
          `adm:${token}:adddestination`,
          3
        )
      ])
    ]
  );
}


// ═════════════════════════════════════════════════════
// ADMIN BUTTONS
// ═════════════════════════════════════════════════════

async function handleAdminButton(interaction, env) {
  const id = interaction.data.custom_id;

  if (!id.startsWith("adm:")) {
    return discordResponse("Invalid admin session.");
  }

  const parts = id.split(":");

  const token = parts[1];
  const action = parts[2];

  const valid = await verifyAdminToken(
    token,
    env.ADMIN_CODE
  );

  if (!valid) {
    return discordResponse(
      "❌ Admin session expired. Use `/admin` again."
    );
  }

  if (action === "managers") {
    return await showManagers(env, token);
  }

  if (action === "sources") {
    return await showSources(env, token);
  }

  if (action === "destinations") {
    return await showDestinations(env, token);
  }

  if (action === "addmanager") {
    return managerModal();
  }

  if (action === "addsource") {
    return sourceModal();
  }

  if (action === "adddestination") {
    return destinationModal();
  }

  return discordResponse("Unknown admin action.");
}


// ═════════════════════════════════════════════════════
// MANAGERS VIEW
// ═════════════════════════════════════════════════════

async function showManagers(env, token) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM managers
    ORDER BY id DESC
  `).all();

  if (!result.results.length) {
    return discordResponse(
      "👤 **Managers**\n\nNo managers added yet.",
      [
        row([
          button(
            "⬅ Back",
            `adm:${token}:back`,
            2
          )
        ])
      ]
    );
  }

  let text = "👤 **MANAGERS**\n\n";

  for (const manager of result.results) {
    text +=
      `**#${manager.id} — ${manager.name}**\n` +
      `Status: ${manager.active ? "🟢 Active" : "🔴 Disabled"}\n`;

    if (manager.discord_user_id) {
      text += `Discord ID: ${manager.discord_user_id}\n`;
    }

    text += "\n";
  }

  return discordResponse(
    text,
    [
      row([
        button(
          "⬅ Back",
          `adm:${token}:back`,
          2
        )
      ])
    ]
  );
}


// ═════════════════════════════════════════════════════
// SOURCES VIEW
// ═════════════════════════════════════════════════════

async function showSources(env, token) {
  const result = await env.DB.prepare(`
    SELECT
      sources.*,
      managers.name AS manager_name
    FROM sources
    LEFT JOIN managers
      ON managers.id = sources.manager_id
    ORDER BY sources.id DESC
  `).all();

  if (!result.results.length) {
    return discordResponse(
      "📡 **IDP SOURCES**\n\nNo sources added yet.",
      [
        row([
          button(
            "⬅ Back",
            `adm:${token}:back`,
            2
          )
        ])
      ]
    );
  }

  let text = "📡 **IDP SOURCES**\n\n";

  for (const source of result.results) {
    text +=
      `**#${source.id} — ${source.name}**\n` +
      `Manager: ${source.manager_name || "Unknown"}\n` +
      `Channel: ${source.channel_name || "-"}\n` +
      `Type: ${source.source_type}\n` +
      `Status: ${source.active ? "🟢 Active" : "🔴 Disabled"}\n\n`;
  }

  return discordResponse(
    text,
    [
      row([
        button(
          "⬅ Back",
          `adm:${token}:back`,
          2
        )
      ])
    ]
  );
}


// ═════════════════════════════════════════════════════
// DESTINATIONS VIEW
// ═════════════════════════════════════════════════════

async function showDestinations(env, token) {
  const result = await env.DB.prepare(`
    SELECT
      destinations.*,
      sources.name AS source_name
    FROM destinations
    LEFT JOIN sources
      ON sources.id = destinations.source_id
    ORDER BY destinations.id DESC
  `).all();

  if (!result.results.length) {
    return discordResponse(
      "📢 **DESTINATIONS**\n\nNo destinations added yet.",
      [
        row([
          button(
            "⬅ Back",
            `adm:${token}:back`,
            2
          )
        ])
      ]
    );
  }

  let text = "📢 **DESTINATIONS**\n\n";

  for (const destination of result.results) {
    text +=
      `**#${destination.id}**\n` +
      `Source: ${destination.source_name || "Unknown"}\n` +
      `Guild ID: ${destination.guild_id}\n` +
      `Channel ID: ${destination.channel_id}\n` +
      `Status: ${destination.active ? "🟢 Active" : "🔴 Disabled"}\n\n`;
  }

  return discordResponse(
    text,
    [
      row([
        button(
          "⬅ Back",
          `adm:${token}:back`,
          2
        )
      ])
    ]
  );
}


// ═════════════════════════════════════════════════════
// MODALS
// ═════════════════════════════════════════════════════

function managerModal() {
  return {
    type: 9,
    data: {
      custom_id: "add_manager",
      title: "Add Manager",
      components: [
        inputRow(
          "manager_name",
          "Manager Name",
          "e.g. Main Manager"
        ),
        inputRow(
          "discord_user_id",
          "Discord User ID",
          "Optional"
        )
      ]
    }
  };
}


function sourceModal() {
  return {
    type: 9,
    data: {
      custom_id: "add_source",
      title: "Add IDP Source",
      components: [
        inputRow(
          "manager_id",
          "Manager ID",
          "e.g. 1"
        ),
        inputRow(
          "source_name",
          "Source Name",
          "e.g. IDP Channel"
        ),
        inputRow(
          "channel_name",
          "Source Channel",
          "Optional"
        ),
        inputRow(
          "source_type",
          "Source Type",
          "webhook / api / authorized-feed"
        ),
        inputRow(
          "source_url",
          "Source URL",
          "Optional"
        )
      ]
    }
  };
}


function destinationModal() {
  return {
    type: 9,
    data: {
      custom_id: "add_destination",
      title: "Add Destination",
      components: [
        inputRow(
          "source_id",
          "Source ID",
          "e.g. 1"
        ),
        inputRow(
          "guild_id",
          "Discord Server ID",
          "Destination server ID"
        ),
        inputRow(
          "channel_id",
          "Discord Channel ID",
          "Destination channel ID"
        )
      ]
    }
  };
}


function inputRow(customId, label, placeholder) {
  return {
    type: 1,
    components: [
      {
        type: 4,
        custom_id: customId,
        label,
        style: 1,
        required: true,
        max_length: 200,
        placeholder
      }
    ]
  };
}


// ═════════════════════════════════════════════════════
// SELECT HANDLER
// ═════════════════════════════════════════════════════

async function handleAdminSelect(interaction, env) {
  return discordResponse(
    "Select menu received."
  );
}


// ═════════════════════════════════════════════════════
// DISCORD API
// ═════════════════════════════════════════════════════

async function registerAdminCommand(env) {
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

  const data = await response.json();

  if (!response.ok) {
    return json({
      ok: false,
      error: data
    }, response.status);
  }

  return json({
    ok: true,
    message: "Global /admin command registered.",
    data
  });
}


// ═════════════════════════════════════════════════════
// SIGNATURE VERIFICATION
// ═════════════════════════════════════════════════════

async function verifyDiscordSignature(
  signature,
  timestamp,
  body,
  publicKeyHex
) {
  try {
    const publicKey = hexToBytes(
      publicKeyHex
    );

    const sig = hexToBytes(
      signature
    );

    const data = new TextEncoder().encode(
      timestamp + body
    );

    const key = await crypto.subtle.importKey(
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
      key,
      sig,
      data
    );

  } catch {
    return false;
  }
}


// ═════════════════════════════════════════════════════
// ADMIN TOKEN
// ═════════════════════════════════════════════════════

async function createAdminToken(
  userId,
  secret
) {
  const expires =
    Date.now() + 30 * 60 * 1000;

  const payload =
    `${userId}.${expires}`;

  const signature =
    await hmac(payload, secret);

  return b64url(
    `${payload}.${signature}`
  );
}


async function verifyAdminToken(
  token,
  secret
) {
  try {
    const decoded =
      atob(
        token
          .replace(/-/g, "+")
          .replace(/_/g, "/")
      );

    const parts =
      decoded.split(".");

    if (parts.length !== 3) {
      return false;
    }

    const userId = parts[0];
    const expires = Number(parts[1]);
    const signature = parts[2];

    if (
      !userId ||
      !expires ||
      !signature
    ) {
      return false;
    }

    if (Date.now() > expires) {
      return false;
    }

    const expected =
      await hmac(
        `${userId}.${expires}`,
        secret
      );

    return signature === expected;

  } catch {
    return false;
  }
}


async function hmac(message, secret) {
  const key =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(message)
    );

  return [...new Uint8Array(signature)]
    .map(
      x => x.toString(16).padStart(2, "0")
    )
    .join("");
}


function b64url(text) {
  return btoa(text)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


function hexToBytes(hex) {
  const bytes = new Uint8Array(
    hex.length / 2
  );

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] =
      parseInt(
        hex.substr(i * 2, 2),
        16
      );
  }

  return bytes;
}


// ═════════════════════════════════════════════════════
// DISCORD UI HELPERS
// ═════════════════════════════════════════════════════

function discordResponse(
  content,
  components = []
) {
  return {
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: 4,
      data: {
        content,
        flags: 64,
        components
      }
    })
  };
}


function row(components) {
  return {
    type: 1,
    components
  };
}


function button(
  label,
  customId,
  style
) {
  return {
    type: 2,
    style,
    label,
    custom_id: customId
  };
}


// ═════════════════════════════════════════════════════
// JSON
// ═════════════════════════════════════════════════════

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
