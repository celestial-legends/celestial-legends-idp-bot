const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require("discord.js");

// =====================================================
// CELESTIAL LEGENDS IDP BOT
// =====================================================

const ADMIN_CODE = "CLE@2026";

const API_URL =
  "https://celestial-legends-idp-bot.celestiallegendsesports.workers.dev";

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("ERROR: DISCORD_TOKEN is missing.");
  process.exit(1);
}

// =====================================================
// DISCORD CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// Users who have authenticated.
// This resets when the bot restarts.
const admins = new Set();

// =====================================================
// API HELPER
// =====================================================

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {
      ok: false,
      error: "Invalid response from Cloudflare Worker"
    };
  }

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error || `Worker returned HTTP ${response.status}`
    );
  }

  return data;
}

// =====================================================
// ADMIN PANEL
// =====================================================

function adminPanel() {
  const embed = new EmbedBuilder()
    .setTitle("CELESTIAL LEGENDS — ADMIN")
    .setDescription(
      "Manage the IDP system from Discord.\n\n" +
      "Choose an option below."
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("managers")
      .setLabel("Managers")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("sources")
      .setLabel("IDP Sources")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("destinations")
      .setLabel("Destinations")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("add_manager")
      .setLabel("Add Manager")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("add_source")
      .setLabel("Add Source")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("add_destination")
      .setLabel("Add Destination")
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true
  };
}

// =====================================================
// MANAGERS
// =====================================================

async function managersMenu() {
  const data = await api("/api/managers");

  if (!data.managers.length) {
    return {
      content: "No managers have been added yet.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("add_manager")
            .setLabel("Add Manager")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("admin_back")
            .setLabel("Back")
            .setStyle(ButtonStyle.Secondary)
        )
      ],
      ephemeral: true
    };
  }

  const description = data.managers
    .map(manager => {
      const status = manager.active
        ? "🟢 Active"
        : "🔴 Inactive";

      return (
        `**${manager.id}. ${manager.name}**\n` +
        `${status}\n` +
        `Discord ID: ${manager.discord_user_id || "Not set"}`
      );
    })
    .join("\n\n");

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Managers")
        .setDescription(description)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_manager")
          .setLabel("Add Manager")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("manager_actions")
          .setLabel("Manage Manager")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("admin_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  };
}

// =====================================================
// SOURCES
// =====================================================

async function sourcesMenu() {
  const data = await api("/api/sources");

  if (!data.sources.length) {
    return {
      content: "No IDP sources have been added yet.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("add_source")
            .setLabel("Add Source")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("admin_back")
            .setLabel("Back")
            .setStyle(ButtonStyle.Secondary)
        )
      ],
      ephemeral: true
    };
  }

  const description = data.sources
    .map(source => {
      const status = source.active
        ? "🟢 Active"
        : "🔴 Inactive";

      return (
        `**${source.id}. ${source.name}**\n` +
        `Manager: ${source.manager_name}\n` +
        `Channel: ${source.channel_name || "Not set"}\n` +
        `Type: ${source.source_type}\n` +
        `Source URL: ${source.source_url || "Not set"}\n` +
        `${status}`
      );
    })
    .join("\n\n");

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("IDP Sources")
        .setDescription(description)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_source")
          .setLabel("Add Source")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("source_actions")
          .setLabel("Manage Source")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("admin_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  };
}

// =====================================================
// DESTINATIONS
// =====================================================

async function destinationsMenu() {
  const data = await api("/api/destinations");

  if (!data.destinations.length) {
    return {
      content: "No destinations have been added yet.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("add_destination")
            .setLabel("Add Destination")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("admin_back")
            .setLabel("Back")
            .setStyle(ButtonStyle.Secondary)
        )
      ],
      ephemeral: true
    };
  }

  const description = data.destinations
    .map(destination => {
      const status = destination.active
        ? "🟢 Active"
        : "🔴 Inactive";

      return (
        `**${destination.id}. Destination**\n` +
        `Manager: ${destination.manager_name}\n` +
        `Source: ${destination.source_name}\n` +
        `Server ID: ${destination.guild_id}\n` +
        `Channel ID: ${destination.channel_id}\n` +
        `${status}`
      );
    })
    .join("\n\n");

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Destinations")
        .setDescription(description)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("add_destination")
          .setLabel("Add Destination")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("destination_actions")
          .setLabel("Manage Destination")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("admin_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  };
}

// =====================================================
// ADMIN LOGIN MODAL
// =====================================================

function adminLoginModal() {
  const modal = new ModalBuilder()
    .setCustomId("admin_login")
    .setTitle("CELESTIAL LEGENDS Admin");

  const code = new TextInputBuilder()
    .setCustomId("admin_code")
    .setLabel("Admin Code")
    .setPlaceholder("Enter admin code")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(code)
  );

  return modal;
}

// =====================================================
// ADD MANAGER MODAL
// =====================================================

function addManagerModal() {
  const modal = new ModalBuilder()
    .setCustomId("add_manager_modal")
    .setTitle("Add Manager");

  const name = new TextInputBuilder()
    .setCustomId("manager_name")
    .setLabel("Manager name")
    .setPlaceholder("Example: Manager 1")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const discordId = new TextInputBuilder()
    .setCustomId("discord_user_id")
    .setLabel("Discord User ID")
    .setPlaceholder("Optional")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(discordId)
  );

  return modal;
}

// =====================================================
// ADD SOURCE MODAL
// =====================================================

function addSourceModal() {
  const modal = new ModalBuilder()
    .setCustomId("add_source_modal")
    .setTitle("Add IDP Source");

  const manager = new TextInputBuilder()
    .setCustomId("manager_id")
    .setLabel("Manager ID")
    .setPlaceholder("Example: 1")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const name = new TextInputBuilder()
    .setCustomId("source_name")
    .setLabel("Source name")
    .setPlaceholder("Example: Manager 1 IDP")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const channel = new TextInputBuilder()
    .setCustomId("channel_name")
    .setLabel("Source channel name")
    .setPlaceholder("Example: idp-room")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const type = new TextInputBuilder()
    .setCustomId("source_type")
    .setLabel("Source type")
    .setPlaceholder("Example: webhook")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const sourceUrl = new TextInputBuilder()
    .setCustomId("source_url")
    .setLabel("Source URL")
    .setPlaceholder("Authorized source endpoint")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(manager),
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(channel),
    new ActionRowBuilder().addComponents(type),
    new ActionRowBuilder().addComponents(sourceUrl)
  );

  return modal;
}

// =====================================================
// ADD DESTINATION MODAL
// =====================================================

function addDestinationModal() {
  const modal = new ModalBuilder()
    .setCustomId("add_destination_modal")
    .setTitle("Add Destination");

  const source = new TextInputBuilder()
    .setCustomId("source_id")
    .setLabel("Source ID")
    .setPlaceholder("Example: 1")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const guild = new TextInputBuilder()
    .setCustomId("guild_id")
    .setLabel("Discord Server ID")
    .setPlaceholder("Discord server ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const channel = new TextInputBuilder()
    .setCustomId("channel_id")
    .setLabel("Discord Channel ID")
    .setPlaceholder("Discord channel ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(source),
    new ActionRowBuilder().addComponents(guild),
    new ActionRowBuilder().addComponents(channel)
  );

  return modal;
}

// =====================================================
// MANAGER ACTION MENU
// =====================================================

async function managerActions() {
  const data = await api("/api/managers");

  if (!data.managers.length) {
    return {
      content: "There are no managers.",
      ephemeral: true
    };
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("manager_select")
    .setPlaceholder("Select a manager");

  for (const manager of data.managers.slice(0, 25)) {
    menu.addOptions({
      label: `${manager.id} — ${manager.name}`.slice(0, 100),
      value: String(manager.id),
      description: manager.active
        ? "Active"
        : "Inactive"
    });
  }

  return {
    content: "Select a manager:",
    components: [
      new ActionRowBuilder().addComponents(menu),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("admin_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  };
}

// =====================================================
// SOURCE ACTION MENU
// =====================================================

async function sourceActions() {
  const data = await api("/api/sources");

  if (!data.sources.length) {
    return {
      content: "There are no sources.",
      ephemeral: true
    };
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("source_select")
    .setPlaceholder("Select a source");

  for (const source of data.sources.slice(0, 25)) {
    menu.addOptions({
      label: `${source.id} — ${source.name}`.slice(0, 100),
      value: String(source.id),
      description: source.active
        ? "Active"
        : "Inactive"
    });
  }

  return {
    content: "Select a source:",
    components: [
      new ActionRowBuilder().addComponents(menu),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("admin_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  };
}

// =====================================================
// DESTINATION ACTION MENU
// =====================================================

async function destinationActions() {
  const data = await api("/api/destinations");

  if (!data.destinations.length) {
    return {
      content: "There are no destinations.",
      ephemeral: true
    };
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("destination_select")
    .setPlaceholder("Select a destination");

  for (const destination of data.destinations.slice(0, 25)) {
    menu.addOptions({
      label: `Destination ${destination.id}`,
      value: String(destination.id),
      description: destination.active
        ? "Active"
        : "Inactive"
    });
  }

  return {
    content: "Select a destination:",
    components: [
      new ActionRowBuilder().addComponents(menu),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("admin_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  };
}

// =====================================================
// BOT READY
// =====================================================

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("admin")
      .setDescription(
        "Open the CELESTIAL LEGENDS admin panel"
      )
  ];

  const rest = new REST({
    version: "10"
  }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands.map(command =>
          command.toJSON()
        )
      }
    );

    console.log("Slash command registered.");
    console.log(
      "CELESTIAL LEGENDS IDP bot is online."
    );
  } catch (error) {
    console.error(
      "Failed to register slash command:",
      error
    );
  }
});

// =====================================================
// INTERACTIONS
// =====================================================

client.on("interactionCreate", async interaction => {
  try {

    // =================================================
    // /admin
    // =================================================

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "admin") {

        if (admins.has(interaction.user.id)) {
          return interaction.reply(adminPanel());
        }

        return interaction.showModal(
          adminLoginModal()
        );
      }
    }

    // =================================================
    // MODALS
    // =================================================

    if (interaction.isModalSubmit()) {

      // -----------------------------------------------
      // ADMIN LOGIN
      // -----------------------------------------------

      if (interaction.customId === "admin_login") {

        const enteredCode =
          interaction.fields.getTextInputValue(
            "admin_code"
          );

        if (enteredCode !== ADMIN_CODE) {
          return interaction.reply({
            content: "❌ Invalid admin code.",
            ephemeral: true
          });
        }

        admins.add(interaction.user.id);

        return interaction.reply({
          content: "✅ Admin access granted.",
          ...adminPanel()
        });
      }

      // -----------------------------------------------
      // ADD MANAGER
      // -----------------------------------------------

      if (
        interaction.customId ===
        "add_manager_modal"
      ) {

        if (!admins.has(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Admin session expired.",
            ephemeral: true
          });
        }

        const name =
          interaction.fields.getTextInputValue(
            "manager_name"
          );

        const discordUserId =
          interaction.fields.getTextInputValue(
            "discord_user_id"
          ) || null;

        const result = await api(
          "/api/managers",
          {
            method: "POST",
            body: JSON.stringify({
              name,
              discord_user_id:
                discordUserId
            })
          }
        );

        return interaction.reply({
          content:
            "✅ Manager added successfully.\n\n" +
            `Manager ID: **${result.manager_id}**`,
          ephemeral: true
        });
      }

      // -----------------------------------------------
      // ADD SOURCE
      // -----------------------------------------------

      if (
        interaction.customId ===
        "add_source_modal"
      ) {

        if (!admins.has(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Admin session expired.",
            ephemeral: true
          });
        }

        const managerId =
          interaction.fields.getTextInputValue(
            "manager_id"
          );

        const name =
          interaction.fields.getTextInputValue(
            "source_name"
          );

        const channel =
          interaction.fields.getTextInputValue(
            "channel_name"
          );

        const type =
          interaction.fields.getTextInputValue(
            "source_type"
          );

        const sourceUrl =
          interaction.fields.getTextInputValue(
            "source_url"
          );

        const result = await api(
          "/api/sources",
          {
            method: "POST",
            body: JSON.stringify({
              manager_id: Number(managerId),
              name,
              channel_name:
                channel || null,
              source_type: type,
              source_url:
                sourceUrl || null
            })
          }
        );

        return interaction.reply({
          content:
            "✅ IDP source added successfully.\n\n" +
            `Source ID: **${result.source_id}**`,
          ephemeral: true
        });
      }

      // -----------------------------------------------
      // ADD DESTINATION
      // -----------------------------------------------

      if (
        interaction.customId ===
        "add_destination_modal"
      ) {

        if (!admins.has(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Admin session expired.",
            ephemeral: true
          });
        }

        const sourceId =
          interaction.fields.getTextInputValue(
            "source_id"
          );

        const guildId =
          interaction.fields.getTextInputValue(
            "guild_id"
          );

        const channelId =
          interaction.fields.getTextInputValue(
            "channel_id"
          );

        const result = await api(
          "/api/destinations",
          {
            method: "POST",
            body: JSON.stringify({
              source_id: Number(sourceId),
              guild_id: guildId,
              channel_id: channelId
            })
          }
        );

        return interaction.reply({
          content:
            "✅ Destination added successfully.\n\n" +
            `Destination ID: **${result.destination_id}**`,
          ephemeral: true
        });
      }
    }

    // =================================================
    // BUTTONS
    // =================================================

    if (interaction.isButton()) {

      if (!admins.has(interaction.user.id)) {
        return interaction.reply({
          content:
            "❌ Please use `/admin` and log in first.",
          ephemeral: true
        });
      }

      if (
        interaction.customId ===
        "admin_back"
      ) {
        return interaction.update(
          adminPanel()
        );
      }

      if (
        interaction.customId ===
        "managers"
      ) {
        return interaction.update(
          await managersMenu()
        );
      }

      if (
        interaction.customId ===
        "sources"
      ) {
        return interaction.update(
          await sourcesMenu()
        );
      }

      if (
        interaction.customId ===
        "destinations"
      ) {
        return interaction.update(
          await destinationsMenu()
        );
      }

      if (
        interaction.customId ===
        "add_manager"
      ) {
        return interaction.showModal(
          addManagerModal()
        );
      }

      if (
        interaction.customId ===
        "add_source"
      ) {
        return interaction.showModal(
          addSourceModal()
        );
      }

      if (
        interaction.customId ===
        "add_destination"
      ) {
        return interaction.showModal(
          addDestinationModal()
        );
      }

      if (
        interaction.customId ===
        "manager_actions"
      ) {
        return interaction.update(
          await managerActions()
        );
      }

      if (
        interaction.customId ===
        "source_actions"
      ) {
        return interaction.update(
          await sourceActions()
        );
      }

      if (
        interaction.customId ===
        "destination_actions"
      ) {
        return interaction.update(
          await destinationActions()
        );
      }
    }

    // =================================================
    // SELECT MENUS
    // =================================================

    if (interaction.isStringSelectMenu()) {

      if (!admins.has(interaction.user.id)) {
        return interaction.reply({
          content: "❌ Admin session expired.",
          ephemeral: true
        });
      }

      // -----------------------------------------------
      // MANAGER SELECT
      // -----------------------------------------------

      if (
        interaction.customId ===
        "manager_select"
      ) {

        const id =
          interaction.values[0];

        const buttons =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `manager_activate_${id}`
                )
                .setLabel("Activate")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `manager_deactivate_${id}`
                )
                .setLabel("Deactivate")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId(
                  `manager_delete_${id}`
                )
                .setLabel("Delete")
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        return interaction.update({
          content:
            `Manager ID **${id}** selected.`,
          components: [
            buttons,
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "managers"
                  )
                  .setLabel("Back")
                  .setStyle(
                    ButtonStyle.Secondary
                  )
              )
          ]
        });
      }

      // -----------------------------------------------
      // SOURCE SELECT
      // -----------------------------------------------

      if (
        interaction.customId ===
        "source_select"
      ) {

        const id =
          interaction.values[0];

        const buttons =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `source_activate_${id}`
                )
                .setLabel("Activate")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `source_deactivate_${id}`
                )
                .setLabel("Deactivate")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId(
                  `source_delete_${id}`
                )
                .setLabel("Delete")
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        return interaction.update({
          content:
            `Source ID **${id}** selected.`,
          components: [
            buttons,
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "sources"
                  )
                  .setLabel("Back")
                  .setStyle(
                    ButtonStyle.Secondary
                  )
              ]
          ]
        });
      }

      // -----------------------------------------------
      // DESTINATION SELECT
      // -----------------------------------------------

      if (
        interaction.customId ===
        "destination_select"
      ) {

        const id =
          interaction.values[0];

        const buttons =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `destination_activate_${id}`
                )
                .setLabel("Activate")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `destination_deactivate_${id}`
                )
                .setLabel("Deactivate")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId(
                  `destination_delete_${id}`
                )
                .setLabel("Delete")
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        return interaction.update({
          content:
            `Destination ID **${id}** selected.`,
          components: [
            buttons,
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "destinations"
                  )
                  .setLabel("Back")
                  .setStyle(
                    ButtonStyle.Secondary
                  )
              ]
          ]
        });
      }
    }

    // =================================================
    // MANAGER ACTION BUTTONS
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "manager_activate_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "manager_activate_",
          ""
        );

      await api(
        `/api/managers/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            active: true
          })
        }
      );

      return interaction.update({
        content:
          `🟢 Manager **${id}** activated.`,
        components: []
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "manager_deactivate_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "manager_deactivate_",
          ""
        );

      await api(
        `/api/managers/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            active: false
          })
        }
      );

      return interaction.update({
        content:
          `🔴 Manager **${id}** deactivated.`,
        components: []
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "manager_delete_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "manager_delete_",
          ""
        );

      await api(
        `/api/managers/${id}`,
        {
          method: "DELETE"
        }
      );

      return interaction.update({
        content:
          `🗑️ Manager **${id}** deleted.`,
        components: []
      });
    }

    // =================================================
    // SOURCE ACTION BUTTONS
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "source_activate_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "source_activate_",
          ""
        );

      await api(
        `/api/sources/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            active: true
          })
        }
      );

      return interaction.update({
        content:
          `🟢 Source **${id}** activated.`,
        components: []
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "source_deactivate_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "source_deactivate_",
          ""
        );

      await api(
        `/api/sources/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            active: false
          })
        }
      );

      return interaction.update({
        content:
          `🔴 Source **${id}** deactivated.`,
        components: []
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "source_delete_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "source_delete_",
          ""
        );

      await api(
        `/api/sources/${id}`,
        {
          method: "DELETE"
        }
      );

      return interaction.update({
        content:
          `🗑️ Source **${id}** deleted.`,
        components: []
      });
    }

    // =================================================
    // DESTINATION ACTION BUTTONS
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "destination_activate_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "destination_activate_",
          ""
        );

      await api(
        `/api/destinations/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            active: true
          })
        }
      );

      return interaction.update({
        content:
          `🟢 Destination **${id}** activated.`,
        components: []
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "destination_deactivate_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "destination_deactivate_",
          ""
        );

      await api(
        `/api/destinations/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            active: false
          })
        }
      );

      return interaction.update({
        content:
          `🔴 Destination **${id}** deactivated.`,
        components: []
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith(
        "destination_delete_"
      )
    ) {

      const id =
        interaction.customId.replace(
          "destination_delete_",
          ""
        );

      await api(
        `/api/destinations/${id}`,
        {
          method: "DELETE"
        }
      );

      return interaction.update({
        content:
          `🗑️ Destination **${id}** deleted.`,
        components: []
      });
    }

  } catch (error) {

    console.error(error);

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction.followUp({
        content:
          `❌ Error: ${error.message}`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content:
          `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
});

// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN);
