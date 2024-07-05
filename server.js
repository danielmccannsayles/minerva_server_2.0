const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { PassThrough } = require("stream");
const revai = require("revai-node-sdk");
const app = express();
const PORT = 3000;
const REV_AI_API_KEY =
  "02EAixTWWL4TaqwQGVIWW7MGB8l6bDuK1nmVR16yhCMA5qpzpLrMiIVjU4u5Cjk7fynW3pM9PmeJ9T9TFQ1BlgKGOnnE0"; // Replace with your Rev.ai API key

// conversion stuff -ffmpeg
const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

// Tell fluent-ffmpeg where it can find FFmpeg - should avoid having to download it?
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
  console.log(`RevAiStream Warning: ${warning}`);
});
revAiStream.on("error", (err) => {
  console.log(`RevAiStream error : ${err}`);
});
revAiStream.on("end", () => {
  console.log("End of RevAi Stream");
});

// The req.body is a buffer. It seems like maybe usig this passthrough stream
// will allow me to send the buffer as a stream
var bufferStream = new PassThrough();
bufferStream.on("error", (err) => {
  console.error("BufferStream error:", err);
});

//TODO: remove this -  Testing out by creating a file writer
let wavWriter = fs.createWriteStream("./output/total.wav");
let aacWriter = fs.createWriteStream("./output/total.aac");

// Add ffmpeg - should take in the buffer and then send it to the revAi Stream
const ffmpegStream = ffmpeg(bufferStream)
  .inputFormat("aac")
  .audioChannels(1)
  .audioFrequency(44100)
  .audioCodec("pcm_s32le")
  .format("wav");

ffmpegStream.on("end", () => {
  console.log("File created successfully");
});
ffmpegStream.on("error", (err) => {
  console.error("Error in ffmpeg conversion:", err);
});
ffmpegStream.on("stderr", (stderrLine) => {
  console.log("FFmpeg stderr output:", stderrLine);
});

ffmpegStream.pipe(wavWriter);
// ffmpegStream.pipe(revAiStream); // ffmpg only supports one output stream

//Testing
bufferStream.pipe(aacWriter);

app.post("/audio", (req, res) => {
  console.log("*");

  bufferStream.push(req.body);
  fs.writeFileSync("./output/single_packet.aac", req.body);

  res.send("\nAudio received successfully");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
