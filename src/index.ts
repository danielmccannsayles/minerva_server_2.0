import express from 'express'
import parser from 'body-parser'
import fs from 'fs'
import { PassThrough } from 'stream'
import { AudioConfig, RevAiStreamingClient } from 'revai-node-sdk'
import { formatDocument } from './processing.js'
import { setupFolders } from './setup_folders.js'
import { REV_AI_API_KEY } from './keys.js'

// Set up output folder structure
const outputPaths = setupFolders()

// Set up Express
const PORT = 3000
const app = express()
app.use(parser.raw({ type: 'audio/l16', limit: '10mb' })) // Parse raw binary data

// Rev.ai
const audioConfig = new AudioConfig(
  'audio/x-raw',
  'interleaved',
  16000,
  'S16LE',
  1
)
// TODO: make a function that re-starts the streaming when needed :).
const client = new RevAiStreamingClient(REV_AI_API_KEY, audioConfig)
var revAiStream = client.start()

// Handle events from the Rev.ai client stream (send)
client.on('close', (code, reason) => {
  console.log(`Connection closed, ${code}: ${reason}`)
})
client.on('connectFailed', error => {
  console.log(`Connection failed with error: ${error}`)
})
client.on('connect', connectionMessage => {
  console.log(`Connected with message: ${JSON.stringify(connectionMessage)}`)
})

// Has length of current file being written to
let currentFileLength = 0
// Index of the current file being written to
let currentFileIndex = 0

// Process events received from Rev.ai transcript (response) stream
revAiStream.on('data', data => {
  fs.appendFile(
    `${outputPaths.raw}/transcriptions.jsonl`,
    JSON.stringify(data) + '\n',
    err => {
      console.log(`Wrote transcription${err ? ` err:${err}` : ''}`)
    }
  )

  // Handle partials - search for keywords
  // Write finals to text document
  if (data.type === 'partial') {
    const newWord = data.elements[data.elements.length - 1].value
    if (newWord.includes('Wake')) {
      console.log('waking up')
    }
  } else if (data.type === 'final') {
    const sentenceArr = data.elements.map((element: any) => element.value)
    const sentence = sentenceArr.join('')
    fs.appendFile(
      `${outputPaths.raw}/conversation_${currentFileIndex}.txt`,
      sentence,
      err => {
        console.log(`Wrote raw conv to file${err ? ` err:${err}` : ''}`)
      }
    )
    currentFileLength += sentence.length
  }

  // TODO: change this from 200 to 500 or something longer. At 200 for testign
  // every 500 characters format the old file and switch to a new one
  if (currentFileLength >= 200) {
    formatDocument(outputPaths, currentFileIndex)

    // Incrememnt current index to go to a new file, and then zero current file Length
    currentFileIndex++
    currentFileLength = 0
  }
})

revAiStream.on('warning', warning => {
  console.log(`RevAiStream Warning: ${warning}`)
})
revAiStream.on('error', err => {
  console.log(`RevAiStream error : ${err}`)
})
revAiStream.on('end', () => {
  console.log('End of RevAi Stream')
})

// Buffer stream to handle incoming PCM data
var bufferStream = new PassThrough()
bufferStream.on('error', err => {
  console.error('BufferStream error:', err)
})

// Create a write stream for the total audio output
let rawWriter = fs.createWriteStream(`${outputPaths.raw}/total.pcm`)

// Pipe the duplex stream to both rawWriter and revAiStream
bufferStream.pipe(rawWriter)
bufferStream.pipe(revAiStream)

app.post('/audio', (req, res) => {
  // Write PCM data to buffer stream
  bufferStream.write(req.body)

  res.send('\nAudio received successfully')
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
