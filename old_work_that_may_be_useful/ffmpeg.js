// I wrote the server using this ffmpeg.js code, so I'm going to keep it here at least for a bit.
// But then I found out that rev.ai takes pcm audio lol. But.. if I ever move away from rev.ai it
// will be useful to have :).

const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

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
