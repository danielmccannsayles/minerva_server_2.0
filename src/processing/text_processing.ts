import { Duplex } from 'stream'
import { formatDocument } from '../llm_stuff/formatDocument.js'
import {
  OutputPaths,
  TranscriptionDataObject
} from '../constants_and_types/types.js'

export function processTextListener (
  // Has to be an object so we pass the reference
  transcriptionDataObject: TranscriptionDataObject,
  revAiStream: Duplex,
  outputPaths: OutputPaths
) {
  // Process events received from Rev.ai transcript (response) stream
  revAiStream.on('data', data => {
    console.log('*')
    if (data.type === 'partial') {
      // TODO: handle keywords - If keyword is e.g. stop, pause the response
      const newWord: string = data.elements[data.elements.length - 1]
        .value as string
      transcriptionDataObject.partialData += newWord + ' ' // Add new word & space after
    } else if (data.type === 'final') {
      let sentence = ''
      for (const element of data.elements) {
        sentence +=
          element.value +
          (element.type === 'punct' && element.value === '.' ? '\n' : ' ')
      }
      transcriptionDataObject.finalData += sentence
      transcriptionDataObject.partialData = '' // Reset partial each time final updates
    }

    // Call format and reset
    if (transcriptionDataObject.finalData.length >= 100) {
      formatDocument(transcriptionDataObject.finalData, outputPaths)
      transcriptionDataObject.finalData = '' // Reset data after API call
    }
  })

  revAiStream.on('close', (err: any) => {
    if (err) {
      console.error('Pipeline failed: ', err)
    } else {
      console.log('Pipeline succeeded.')
    }
  })
}
