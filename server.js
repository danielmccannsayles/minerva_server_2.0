const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { PassThrough } = require("stream");
const revai = require("revai-node-sdk");
const app = express();
const PORT = 3000;
const REV_AI_API_KEY =
  "02EAixTWWL4TaqwQGVIWW7MGB8l6bDuK1nmVR16yhCMA5qpzpLrMiIVjU4u5Cjk7fynW3pM9PmeJ9T9TFQ1BlgKGOnnE0"; // Replace with your Rev.ai API key

// Initialize Rev.ai client with audio configuration
const audioConfig = new revai.AudioConfig(
  "audio/x-raw",
  "interleaved",
  16000,
  "S16LE",
  1
);

// Use bodyParser to parse raw binary data
app.use(bodyParser.raw({ type: "audio/aac", limit: "10mb" }));
//** Moving stuff out - maybe this only needs to be done once */

// *** REV.ai SETUP

const client = new revai.RevAiStreamingClient(REV_AI_API_KEY, audioConfig);
// Create a stream for the Rev.ai client
var revAiStream = client.start();
// Handle events from the Rev.ai client
client.on("close", (code, reason) => {
  console.log(`Connection closed, ${code}: ${reason}`);
});
client.on("httpResponse", (code) => {
  console.log(`Streaming client received HTTP response with code: ${code}`);
});
client.on("connectFailed", (error) => {
  console.log(`Connection failed with error: ${error}`);
});
client.on("connect", (connectionMessage) => {
  console.log(`Connected with message: ${JSON.stringify(connectionMessage)}`);
});
// Process data received from Rev.ai
revAiStream.on("data", (data) => {
  console.log(data);
  fs.appendFile("transcriptions.json", JSON.stringify(data) + "\n", (err) => {
    if (err) {
      console.error("Error writing to file", err);
    } else {
      console.log("Transcription appended to file");
    }
  });
});
revAiStream.on("warning", (warning) => {
  console.log(`Warning: ${warning}`);
});
revAiStream.on("end", () => {
  console.log("End of Stream");
});

// The req.body is a buffer. It seems like maybe usig this passthrough stream
// will allow me to send the buffer as a stream
var bufferStream = new PassThrough();
bufferStream.pipe(revAiStream);
bufferStream.on("error", (err) => {
  console.error("PassThrough stream error:", err);
});

app.post("/audio", (req, res) => {
  console.log("*");

  bufferStream.write(req.body);

  res.send("\nAudio received successfully");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
