export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // =========================
    // HEALTH
    // =========================
    if (url.pathname === "/api/health") {
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
      const result = await env.DB
        .prepare("SELECT * FROM managers ORDER BY id DESC")
        .all();

      return Response.json({
        ok: true,
        managers: result.results
      });
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
            INSERT INTO managers (name, discord_user_id)
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

    // DELETE /api/managers/:id
    if (
      url.pathname.startsWith("/api/managers/") &&
      method === "DELETE"
    ) {
      const id = url.pathname.split("/").pop();

      await env.DB
        .prepare("DELETE FROM managers WHERE id = ?")
        .bind(id)
        .run();

      return Response.json({
        ok: true,
        message: "Manager deleted"
      });
    }

    // =========================
    // SOURCES
    // =========================

    // GET /api/sources
    if (url.pathname === "/api/sources" && method === "GET") {
      const result = await env.DB
        .prepare(`
          SELECT
            sources.*,
            managers.name AS manager_name
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

    // DELETE /api/sources/:id
    if (
      url.pathname.startsWith("/api/sources/") &&
      method === "DELETE"
    ) {
      const id = url.pathname.split("/").pop();

      await env.DB
        .prepare("DELETE FROM sources WHERE id = ?")
        .bind(id)
        .run();

      return Response.json({
        ok: true,
        message: "Source deleted"
      });
    }

    return new Response(
      "CELESTIAL LEGENDS IDP bot backend is online!"
    );
  }
};
