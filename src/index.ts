import express from 'express'
import parser from 'body-parser'
import fs from 'fs'
import { Duplex, PassThrough, Transform } from 'stream'
import { RevAiStreamingClient } from 'revai-node-sdk'
import { setupFolders } from './setup_folders'
import {
  OutputPaths,
  RespondingState,
  TranscriptionDataObject
} from './constants_and_types/types'
import { processTextListener } from './processing/text_processing'
import { getAnswerStreaming } from './llm_stuff/getAnswerStreaming'
import { ChatCompletionChunk } from 'openai/resources/index'
import { formatDocument } from './llm_stuff/formatDocument'
import {
  convertTextToSpeech,
  textStreamToAudioStream
} from './llm_stuff/text_to_speech'
import { startStreamingSession } from './helpers/rev-streaming'

//TODO: remove this
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Set up Express
const PORT = 3000
const app = express()
app.use(parser.raw({ type: 'audio/l16', limit: '10mb' })) // Parse raw binary data

// Global variables
let revClient: RevAiStreamingClient | null = null
let revAiStream: Duplex | null = null
let bufferStream: PassThrough | null = null
let outputPaths: OutputPaths

// Global states - objects are passed by reference
let isRespondingState: RespondingState = { isResponding: false }
let transcriptionDataObject: TranscriptionDataObject = {
  partialData: '',
  finalData: ''
}

/** Initiate a new recording stream
 * Starts a new rev ai session.
 * When the rev ai session is ready, responds with true.
 * If it fails, or after a set amount of time, responds with false
 */
app.get('/startSession', async (_, res) => {
  const response = await startStreamingSession(revClient, revAiStream, bufferStream)
  if (response.connected) {
    // Start a new folder path for this recording
    outputPaths = setupFolders()
    // Add text listener to revAiStream.
    // Pass in global isRespondingState - it's an obj so passes reference
    // Cast revAiStream since I believe it cannot be null here - since response was true
    // TODO: ^ maybe make sure this is always true, or add error handling
    processTextListener(
      transcriptionDataObject,
      revAiStream as Duplex,
      outputPaths
    )
    res.sendStatus(200)
  } else {
    res.status(400).send(`Error starting session: ${response.error}`)
  }
})

/**
 * Tell the agent to wake and get a response. Initiate getting a
 * response. Recording session does not stop.
 */
app.get('/wake', (req, res) => {
  if (isRespondingState.isResponding) return
  isRespondingState.isResponding = true
  console.log('wake endpoint hit')

  // Wait for 3s to finish getting all transcription data. May need to wait longer
  setTimeout(async () => {
    // Get the formatted notes. Add in the transciptionDataObject. Send this to the gpt api
    let formattedFile = ''
    const ffPath = `${outputPaths.generated}/formatted_note.md`
    if (fs.existsSync(ffPath)) {
      formattedFile = fs.readFileSync(ffPath, 'utf-8')
    }
    const fChunk =
      formattedFile.length > 4000 ? formattedFile.slice(-4000) : formattedFile
    const extraData =
      transcriptionDataObject.finalData + transcriptionDataObject.partialData

    console.log(
      'Asking AI Assistnat for response, message: ' + fChunk + extraData
    )
    formatDocument(extraData, outputPaths)
    const chatResponse = await getAnswerStreaming(fChunk + extraData)

    // Convert gpt response stream to text stream
    const textStream = new Transform({
      writableObjectMode: true,
      transform (chunk: ChatCompletionChunk, encoding, callback) {
        const finishReason = chunk.choices[0].finish_reason
        if (finishReason) {
          if (finishReason !== 'stop') console.log(finishReason)
          // End stream
          this.push(null)
          return callback()
        }
        this.push(chunk.choices[0].delta.content ?? 'ERR')
        callback()
      }
    })
    chatResponse?.pipe(textStream)
    // TTS - currently writing to output file
    const audioStream = textStreamToAudioStream(textStream)
    // const writableStream = fs.createWriteStream('stitched_output_audio.mp3')
    // audioStream.pipe(writableStream)

    // Pipe audio to response
    res.setHeader('Content-Type', 'audio/mpeg') // Set the correct content type for mp3
    res.setHeader('Transfer-Encoding', 'chunked')
    audioStream.pipe(res)
    // res.sendFile(path.join(__dirname, '../stitched_output_audio.mp3'))

    // Add text to accumulator, then write it to the formatted notes file
    let assistantResponse = ''
    textStream?.on('data', (data: string) => {
      assistantResponse += data
    })
    textStream?.on('finish', () => {
      console.log('finished textStream')
      isRespondingState.isResponding = false
      const deliniatedAssistantResponse =
        '\n <Assistant Response>\n' + assistantResponse + '\n <End Response>\n'
      fs.appendFileSync(
        `${outputPaths.generated}/formatted_note.md`,
        deliniatedAssistantResponse
      )
    })
  }, 3000)
})

//TODO:
//app.get('sleep') - cancels the wake. Reattaches the listener

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

/** Used to trigger whatever I'm currently testing */
app.get('/test', async (req, res) => {
  console.log('testing')
  const text = 'Turn this text into sound. Woo!'
  await convertTextToSpeech(text)
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
