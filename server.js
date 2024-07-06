const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { PassThrough } = require("stream");
const revai = require("revai-node-sdk");
const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
const PORT = 3000;
const REV_AI_API_KEY =
  "02EAixTWWL4TaqwQGVIWW7MGB8l6bDuK1nmVR16yhCMA5qpzpLrMiIVjU4u5Cjk7fynW3pM9PmeJ9T9TFQ1BlgKGOnnE0"; // Replace with your Rev.ai API key

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Initialize Rev.ai client with audio configuration
const audioConfig = new revai.AudioConfig(
  "audio/x-wav",
  "interleaved",
  16000,
  "S16LE",
  1
);

// Use bodyParser to parse raw binary data
app.use(bodyParser.raw({ type: "audio/l16", limit: "10mb" }));

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
  fs.appendFile(
    "./output/transcriptions.json",
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
let wavWriter = fs.createWriteStream("./output/total.wav");

// FFmpeg stream to convert PCM to WAV
const ffmpegStream = ffmpeg(bufferStream)
  .inputFormat("s16le")
  .audioChannels(1)
  .audioFrequency(16000)
  .audioCodec("pcm_s16le")
  .format("wav");

// FFmpeg event handlers
ffmpegStream.on("end", () => {
  console.log("File created successfully");
});
ffmpegStream.on("error", (err) => {
  console.error("Error in ffmpeg conversion:", err);
});
ffmpegStream.on("stderr", (stderrLine) => {
  console.log("FFmpeg stderr output:", stderrLine);
});
ffmpegStream.on("start", (commandLine) => {
  console.log("FFmpeg process started:", commandLine);
});
ffmpegStream.on("progress", (progress) => {
  console.log("FFmpeg progress:", progress);
});

// Create a stream to split the ffmpeg, because it can only output to 1 stream
const splitStream = new PassThrough();
ffmpegStream.pipe(splitStream);

// Pipe the duplex stream to both wavWriter and revAiStream
splitStream.pipe(wavWriter);
splitStream.pipe(revAiStream);

app.post("/audio", (req, res) => {
  console.log("Received audio chunk, size:", req.body.length);
  console.log("First 16 bytes:", req.body.slice(0, 16).toString("hex"));

  // Write PCM data to buffer stream
  bufferStream.write(req.body);

  res.send("\nAudio received successfully");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
