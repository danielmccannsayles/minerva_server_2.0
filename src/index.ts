import express from 'express'
import parser, { json } from 'body-parser'
import { Duplex, PassThrough } from 'stream'
import { AudioConfig, RevAiStreamingClient } from 'revai-node-sdk'
import { setupFolders } from './setup_folders.js'
import { REV_AI_API_KEY } from './constants_and_types/keys.js'
import { audioProcessing } from './processing/audio_processing.js'
import { OutputPaths } from './constants_and_types/types.js'
import { processTextListener } from './processing/text_processing.js'

// Set up Express
const PORT = 3000
const app = express()
app.use(parser.raw({ type: 'audio/l16', limit: '10mb' })) // Parse raw binary data

// Global variables
let revClient: RevAiStreamingClient | null = null
let revAiStream: Duplex | null = null
let bufferStream: PassThrough | null = null
let outputPaths: OutputPaths

function startStreamingSession () {
  // Rev.ai
  const audioConfig = new AudioConfig(
    'audio/x-raw',
    'interleaved',
    16000,
    'S16LE',
    1
  )

  // New Rev client and stream
  revClient = new RevAiStreamingClient(REV_AI_API_KEY, audioConfig)
  revAiStream = revClient.start()

  // Listen once for initialization
  let connectedPromise: Promise<{ connected: boolean; error?: string }> =
    new Promise((resolve, _) => {
      revClient!.once('connectFailed', error => {
        resolve({ connected: false, error })
      })

      revClient!.once('connect', connectionMessage => {
        console.log(
          `Connected with message: ${JSON.stringify(connectionMessage)}`
        )
        resolve({ connected: true })
      })

      setTimeout(() => {
        resolve({
          connected: false,
          error: 'Took longer than 5 seconds to initiate'
        })
      }, 5000)
    })

  //Add listeners to audio stream
  audioProcessing(revAiStream)

  // Buffer stream to handle incoming PCM data
  bufferStream = new PassThrough()
  bufferStream.on('error', err => {
    console.error('BufferStream error:', err)
  })

  // Pipe the duplex stream to both rawWriter and revAiStream
  bufferStream.pipe(revAiStream)

  return connectedPromise
}

/** Initiate a new recording stream
 * Starts a new rev ai session.
 * When the rev ai session is ready, responds with true.
 * If it fails, or after a set amount of time, responds with false
 */
app.get('/startSession', async (_, res) => {
  const response = await startStreamingSession()
  if (response.connected) {
    // Start a new folder path for this recording
    outputPaths = setupFolders()
    // Add text listener to revAiStream.
    // Cast revAiStream since I believe it cannot be null here - since response was true
    // TODO: ^ maybe make sure this is always true, or add error handling
    processTextListener(revAiStream as Duplex, outputPaths)
    res.sendStatus(200)
  } else {
    res.status(400).send(`Error starting session: ${response.error}`)
  }
})

/** Closes rev.ai streaming session
 * Returns a 400 if it takes longer than 5 seconds
 * Returns a 200 if it closes
 */
app.get('/endSession', (_, res) => {
  if (!revClient || !revAiStream || !bufferStream) {
    res
      .status(400)
      .send("Stream wasn't initialized properly. Try re-intializing")
  } else {
    new Promise(resolve => {
      // Create a timeout to resolve with false after 5 seconds
      const timeout = setTimeout(() => {
        resolve('took longer than 5 seconds to close')
      }, 5000)

      revClient!.once('close', () => {
        clearTimeout(timeout) // Clear the timeout if the close event is triggered
        resolve('closed')
      })

      revClient!.end()
    }).then(result => {
      // Reset all to null, so audio endpoint will fail
      if (result === 'closed') {
        revClient = null
        revAiStream = null
        bufferStream = null
        res.sendStatus(200)
      } else {
        res.status(400).send(result)
      }
    })
  }
})

/** Stream audio from app to the server */
app.post('/audio', (req, res) => {
  if (!revClient || !revAiStream || !bufferStream) {
    res
      .status(400)
      .send("Stream wasn't initialized properly. Try re-intializing")
  } else {
    // Write PCM data to buffer stream
    bufferStream.write(req.body)

    res.send('\nAudio received successfully')
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
