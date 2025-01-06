
import { Duplex, PassThrough,  } from 'stream'
import { AudioConfig, RevAiStreamingClient } from 'revai-node-sdk'
import { REV_AI_API_KEY } from '../constants_and_types/keys'
import { audioProcessing } from '../processing/audio_processing'

// RevClient, revAiStream, and bufferStream are global variables passed in by reference, and modified in this function
export function startStreamingSession (revClient: RevAiStreamingClient | null, revAiStream: Duplex | null, bufferStream: PassThrough | null) {
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
  