import { Duplex, PassThrough } from 'stream'
import { RevAiStreamingClient } from 'revai-node-sdk'
import { processTextListener } from './text_processing.js'

export function audioProcessing (
  revAiStream: Duplex,
  outputPaths: { raw: string; generated: string }
) {
  revAiStream.on('warning', warning => {
    console.log(`RevAiStream Warning: ${warning}`)
  })
  revAiStream.on('error', err => {
    console.log(`RevAiStream error : ${err}`)
  })
  revAiStream.on('end', () => {
    console.log('End of RevAi Stream')
  })
}
