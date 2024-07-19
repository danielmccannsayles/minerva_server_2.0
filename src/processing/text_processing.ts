import { Duplex } from 'stream'
import fs from 'fs'
import { formatDocument } from '../llm_stuff/formatDocument.js'
import { OutputPaths } from '../constants_and_types/types.js'
import { getAnswerStreaming } from '../llm_stuff/getAnswerStreaming.js'

export function processTextListener (
  revAiStream: Duplex,
  outputPaths: OutputPaths
) {
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
      const newWord: string = data.elements[data.elements.length - 1]
        .value as string
      if (newWord.toLowerCase().includes('wake')) {
        console.log('waking up')
        /* So when we wake up we want to start an answering process.
        When this process starts we want to alert the client and have it play a quick sound,
        and show avisual
        While the process is ongoing, we are still transcribing words BUT we stop looking for a 
        wake word, and we hold off on calling the format api.
        When the process starts, we take the last 1000 characters and call the format api in
        streaming mode. We stream this into the streaming text to speech, and send a stream of
        audio back to the client.
         */

        // const currentFileText = fs.readFileSync(
        //   `${outputPaths.raw}/conversation_${currentFileIndex}.txt`,
        //   'utf8'
        // )
        // console.log(currentFileText, '\n\n')
        // getAnswerStreaming(currentFileText)
      }
    } else if (data.type === 'final') {
      let sentence = ''
      for (const element of data.elements) {
        sentence +=
          element.value +
          (element.type === 'punct' && element.value === '.' ? '\n' : '')
      }
      fs.appendFile(
        `${outputPaths.raw}/conversation_${currentFileIndex}.txt`,
        sentence,
        err => {
          console.log(`Wrote raw conv to file${err ? ` err:${err}` : ''}`)
        }
      )
      currentFileLength += sentence.length
    }

    // Every 1000 characters format the old file and switch to a new one
    if (currentFileLength >= 1000) {
      formatDocument(outputPaths, currentFileIndex)

      // Incrememnt current index to go to a new file, and then zero current file Length
      currentFileIndex++
      currentFileLength = 0
    }
  })
}
