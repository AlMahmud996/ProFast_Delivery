let handler;
let loadError;

try {
  handler = (await import("../index.js")).default;
} catch (error) {
  loadError = error;
  console.error("Startup error:", error);
}

export default function (req, res) {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("Startup error:\n\n" + (loadError.stack || String(loadError)));
    return;
  }
  return handler(req, res);
}
