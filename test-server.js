const express = require("express");
const app = express();
app.get("/health", (req, res) => res.json({ ok: true, time: new Date(), message: "Sambandh server is alive!" }));
app.get("/", (req, res) => res.send("<h1>Sambandh API</h1><p>Server is running. Try <a href=/health>/health</a></p>"));
app.listen(3001, () => console.log("[OK] Test server running on http://localhost:3001"));
