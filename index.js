export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // =========================
    // HEALTH
    // =========================

    if (url.pathname === "/api/health" && method === "GET") {
      return Response.json({
        ok: true,
        bot: "CELESTIAL LEGENDS IDP bot",
        database: "connected"
      });
    }

    // =========================
    // MANAGERS
    // =========================

    // GET /api/managers
    if (url.pathname === "/api/managers" && method === "GET") {
      try {
        const result = await env.DB
          .prepare(`
            SELECT *
            FROM managers
            ORDER BY id DESC
          `)
          .all();

        return Response.json({
          ok: true,
          managers: result.results
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // POST /api/managers
    if (url.pathname === "/api/managers" && method === "POST") {
      try {
        const body = await request.json();

        if (!body.name) {
          return Response.json(
            {
              ok: false,
              error: "Manager name is required"
            },
            { status: 400 }
          );
        }

        const result = await env.DB
          .prepare(`
            INSERT INTO managers (
              name,
              discord_user_id
            )
            VALUES (?, ?)
          `)
          .bind(
            body.name,
            body.discord_user_id || null
          )
          .run();

        return Response.json({
          ok: true,
          manager_id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // PATCH /api/managers/:id
    if (
      url.pathname.startsWith("/api/managers/") &&
      method === "PATCH"
    ) {
      try {
        const id = url.pathname.split("/").pop();
        const body = await request.json();

        const active =
          body.active === true || body.active === 1 ? 1 : 0;

        await env.DB
          .prepare(`
            UPDATE managers
            SET active = ?
            WHERE id = ?
          `)
          .bind(active, id)
          .run();

        return Response.json({
          ok: true,
          message: active
            ? "Manager activated"
            : "Manager deactivated"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // DELETE /api/managers/:id
    if (
      url.pathname.startsWith("/api/managers/") &&
      method === "DELETE"
    ) {
      try {
        const id = url.pathname.split("/").pop();

        await env.DB
          .prepare(`
            DELETE FROM managers
            WHERE id = ?
          `)
          .bind(id)
          .run();

        return Response.json({
          ok: true,
          message: "Manager deleted"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // =========================
    // SOURCES
    // =========================

    // GET /api/sources
    if (url.pathname === "/api/sources" && method === "GET") {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              sources.*,
              managers.name AS manager_name,
              managers.active AS manager_active
            FROM sources
            JOIN managers
              ON managers.id = sources.manager_id
            ORDER BY sources.id DESC
          `)
          .all();

        return Response.json({
          ok: true,
          sources: result.results
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // POST /api/sources
    if (url.pathname === "/api/sources" && method === "POST") {
      try {
        const body = await request.json();

        if (!body.manager_id) {
          return Response.json(
            {
              ok: false,
              error: "manager_id is required"
            },
            { status: 400 }
          );
        }

        if (!body.name) {
          return Response.json(
            {
              ok: false,
              error: "Source name is required"
            },
            { status: 400 }
          );
        }

        if (!body.source_type) {
          return Response.json(
            {
              ok: false,
              error: "source_type is required"
            },
            { status: 400 }
          );
        }

        const manager = await env.DB
          .prepare(`
            SELECT id
            FROM managers
            WHERE id = ?
          `)
          .bind(body.manager_id)
          .first();

        if (!manager) {
          return Response.json(
            {
              ok: false,
              error: "Manager not found"
            },
            { status: 404 }
          );
        }

        const result = await env.DB
          .prepare(`
            INSERT INTO sources (
              manager_id,
              name,
              channel_name,
              source_type,
              source_url
            )
            VALUES (?, ?, ?, ?, ?)
          `)
          .bind(
            body.manager_id,
            body.name,
            body.channel_name || null,
            body.source_type,
            body.source_url || null
          )
          .run();

        return Response.json({
          ok: true,
          source_id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // PATCH /api/sources/:id
    if (
      url.pathname.startsWith("/api/sources/") &&
      method === "PATCH"
    ) {
      try {
        const id = url.pathname.split("/").pop();
        const body = await request.json();

        const active =
          body.active === true || body.active === 1 ? 1 : 0;

        await env.DB
          .prepare(`
            UPDATE sources
            SET active = ?
            WHERE id = ?
          `)
          .bind(active, id)
          .run();

        return Response.json({
          ok: true,
          message: active
            ? "Source activated"
            : "Source deactivated"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // DELETE /api/sources/:id
    if (
      url.pathname.startsWith("/api/sources/") &&
      method === "DELETE"
    ) {
      try {
        const id = url.pathname.split("/").pop();

        await env.DB
          .prepare(`
            DELETE FROM sources
            WHERE id = ?
          `)
          .bind(id)
          .run();

        return Response.json({
          ok: true,
          message: "Source deleted"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // =========================
    // DESTINATIONS
    // =========================

    // GET /api/destinations
    if (
      url.pathname === "/api/destinations" &&
      method === "GET"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              destinations.*,
              sources.name AS source_name,
              sources.manager_id,
              managers.name AS manager_name
            FROM destinations
            JOIN sources
              ON sources.id = destinations.source_id
            JOIN managers
              ON managers.id = sources.manager_id
            ORDER BY destinations.id DESC
          `)
          .all();

        return Response.json({
          ok: true,
          destinations: result.results
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // POST /api/destinations
    if (
      url.pathname === "/api/destinations" &&
      method === "POST"
    ) {
      try {
        const body = await request.json();

        if (!body.source_id) {
          return Response.json(
            {
              ok: false,
              error: "source_id is required"
            },
            { status: 400 }
          );
        }

        if (!body.guild_id) {
          return Response.json(
            {
              ok: false,
              error: "guild_id is required"
            },
            { status: 400 }
          );
        }

        if (!body.channel_id) {
          return Response.json(
            {
              ok: false,
              error: "channel_id is required"
            },
            { status: 400 }
          );
        }

        const source = await env.DB
          .prepare(`
            SELECT id
            FROM sources
            WHERE id = ?
          `)
          .bind(body.source_id)
          .first();

        if (!source) {
          return Response.json(
            {
              ok: false,
              error: "Source not found"
            },
            { status: 404 }
          );
        }

        const result = await env.DB
          .prepare(`
            INSERT INTO destinations (
              source_id,
              guild_id,
              channel_id
            )
            VALUES (?, ?, ?)
          `)
          .bind(
            body.source_id,
            body.guild_id,
            body.channel_id
          )
          .run();

        return Response.json({
          ok: true,
          destination_id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // PATCH /api/destinations/:id
    if (
      url.pathname.startsWith("/api/destinations/") &&
      method === "PATCH"
    ) {
      try {
        const id = url.pathname.split("/").pop();
        const body = await request.json();

        const active =
          body.active === true || body.active === 1 ? 1 : 0;

        await env.DB
          .prepare(`
            UPDATE destinations
            SET active = ?
            WHERE id = ?
          `)
          .bind(active, id)
          .run();

        return Response.json({
          ok: true,
          message: active
            ? "Destination activated"
            : "Destination deactivated"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // DELETE /api/destinations/:id
    if (
      url.pathname.startsWith("/api/destinations/") &&
      method === "DELETE"
    ) {
      try {
        const id = url.pathname.split("/").pop();

        await env.DB
          .prepare(`
            DELETE FROM destinations
            WHERE id = ?
          `)
          .bind(id)
          .run();

        return Response.json({
          ok: true,
          message: "Destination deleted"
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // =========================
    // 404
    // =========================

    return Response.json(
      {
        ok: false,
        error: "Endpoint not found"
      },
      { status: 404 }
    );
  }
};
