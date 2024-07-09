import { Duplex } from 'stream'
import fs from 'fs'
import { formatDocument } from './llm_stuff.js'

export function processTextListener (
  revAiStream: Duplex,
  outputPaths: { raw: string; generated: string }
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
}
