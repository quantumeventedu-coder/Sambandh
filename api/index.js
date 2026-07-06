// Vercel serverless entry — wraps the Express app. DB connection is created
// once per warm lambda and reused; a failed connect is retried next request.
const { app, ready } = require('../src/server');

module.exports = async (req, res) => {
  try {
    await ready();
  } catch (err) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Database unavailable: ' + err.message }));
  }
  return app(req, res);
};
