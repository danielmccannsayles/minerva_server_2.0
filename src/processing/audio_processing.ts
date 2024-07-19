import { Duplex } from 'stream'

export function audioProcessing (revAiStream: Duplex) {
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
