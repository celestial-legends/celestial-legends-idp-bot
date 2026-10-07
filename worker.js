export default {
  async fetch(request, env) {
    try {
      const result = await env.DB
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all();

      return Response.json({
        ok: true,
        message: "CELESTIAL LEGENDS IDP backend is connected to D1!",
        tables: result.results
      });
    } catch (error) {
      return Response.json({
        ok: false,
        error: error.message
      }, { status: 500 });
    }
  }
};
