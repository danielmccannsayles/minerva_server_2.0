import OpenAI from 'openai'
import { OPEN_API_KEY } from '../constants_and_types/keys.js'
import { Readable, PassThrough } from 'stream'
import fs from 'fs'

const openaiClient = new OpenAI({ apiKey: OPEN_API_KEY })

export async function convertTextToSpeech (text: string) {
  const response = await openaiClient.audio.speech.create({
    input: text,
    model: 'tts-1',
    voice: 'echo'
  })

  if (!response.body) {
    console.log('err no res')
    return
  }

  // OMG... ts type safety was telling me this was a ReadableStream from the web
  // docs.. but it's actually a node Readable already. Casting it was all that was
  // neccessary....
  const castStream = response.body as unknown as Readable
  return castStream
}

// Create a passthrough. As text is recieved (in chunks of 100 or line end), run it through the TTS.
// Write returned audio to the passthrough. When that audio ends, resume textStream
// When the text stream ends, handle the last bit
export function textStreamToAudioStream (textStream: Readable): Readable {
  const passThroughStream = new PassThrough()
  let accumulatedText = ''

  textStream.on('data', async chunk => {
    accumulatedText += chunk.toString()
    if (accumulatedText.length > 100 || accumulatedText.includes('\n')) {
      textStream.pause() // Pause the text stream to wait for the current chunk to be processed
      try {
        // Convert it - cannot be null
        const audioStream = (await convertTextToSpeech(
          accumulatedText
        )) as Readable
        audioStream.pipe(passThroughStream, { end: false })
        audioStream.on('end', () => {
          textStream.resume() // Resume the text stream after the chunk is processed
        })
      } catch (err) {
        passThroughStream.emit('error', err)
      }
      accumulatedText = ''
    }
  })

  textStream.on('end', async () => {
    if (accumulatedText) {
      try {
        // Convert it - cannot be null
        const audioStream = (await convertTextToSpeech(
          accumulatedText
        )) as Readable
        audioStream.pipe(passThroughStream, { end: false })
        audioStream.on('end', () => {
          passThroughStream.end() // End the passThroughStream when the last chunk is processed
        })
      } catch (err) {
        passThroughStream.emit('error', err)
      }
    } else {
      passThroughStream.end() // End the passThroughStream if there's no remaining text
    }
  })

  textStream.on('error', err => {
    passThroughStream.emit('error', err)
  })

  return passThroughStream
}
