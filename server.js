const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { PassThrough } = require("stream");
const revai = require("revai-node-sdk");

// Initial setup
const PORT = 3000;
const REV_AI_API_KEY =
  "02EAixTWWL4TaqwQGVIWW7MGB8l6bDuK1nmVR16yhCMA5qpzpLrMiIVjU4u5Cjk7fynW3pM9PmeJ9T9TFQ1BlgKGOnnE0"; // Replace with your Rev.ai API key
const app = express();

// Use bodyParser to parse raw binary data
app.use(bodyParser.raw({ type: "audio/l16", limit: "10mb" }));

// Rev.ai - going to use streaming
const audioConfig = new revai.AudioConfig(
  "audio/x-raw",
  "interleaved",
  16000,
  "S16LE",
  1
);
// Init client and start stream - TODO: make a function that re-starts the streaming if needed :).
const client = new revai.RevAiStreamingClient(REV_AI_API_KEY, audioConfig);
var revAiStream = client.start();

// Handle events from the Rev.ai client stream (send)
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

// Process events received from Rev.ai transcript (response) stream
revAiStream.on("data", (data) => {
  console.log(data);
  fs.appendFile(
    "./output/transcriptions.jsonl",
    JSON.stringify(data) + "\n",
    (err) => {
      if (err) {
        console.error("Error writing to file", err);
      } else {
        console.log("Transcription appended to file");
      }
    }
  );
});
revAiStream.on("warning", (warning) => {
  console.log(`RevAiStream Warning: ${warning}`);
});
revAiStream.on("error", (err) => {
  console.log(`RevAiStream error : ${err}`);
});
revAiStream.on("end", () => {
  console.log("End of RevAi Stream");
});

// Buffer stream to handle incoming PCM data
var bufferStream = new PassThrough();
bufferStream.on("error", (err) => {
  console.error("BufferStream error:", err);
});

// Create a write stream for the final WAV output
let rawWriter = fs.createWriteStream("./output/total.pcm");

// Pipe the duplex stream to both rawWriter and revAiStream
bufferStream.pipe(rawWriter);
bufferStream.pipe(revAiStream);

app.post("/audio", (req, res) => {
  console.log("*");
  //   console.log("Received audio chunk, size:", req.body.length);
  //   console.log("First 16 bytes:", req.body.slice(0, 16).toString("hex"));

  // Write PCM data to buffer stream
  bufferStream.write(req.body);

  res.send("\nAudio received successfully");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
