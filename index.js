export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        bot: "CELESTIAL LEGENDS IDP bot",
        database: "connected"
      });
    }

    // Test D1 connection
    if (url.pathname === "/api/db-test") {
      try {
        const result = await env.DB
          .prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
          `)
          .all();

        return Response.json({
          ok: true,
          tables: result.results
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

    return new Response(
      "CELESTIAL LEGENDS IDP bot backend is online!",
      {
        headers: {
          "content-type": "text/plain; charset=UTF-8"
        }
      }
    );
  }
};
