import fs from 'fs'
import { OPEN_API_KEY } from '../constants_and_types/keys.js'
import OpenAI from 'openai'

const openaiClient = new OpenAI({ apiKey: OPEN_API_KEY })

async function getChatStream (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) {
  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      max_tokens: 1000, // Dunno if this matters
      stream: true
    })

    // The response is an async iterable
    for await (const chunk of response) {
      const { choices } = chunk
      const content = choices[0]?.delta?.content
      if (content) {
        console.log(content)
      }
    }

    console.log('Stream finished.')
  } catch (error) {
    console.error('Error calling OpenAI API:', error)
  }
}

export function getAnswerStreaming (userMessage: string) {
  console.log('starting to stream')
  const messages = [
    { role: 'system', content: ANSWER_PROMPT },
    { role: 'user', content: userMessage }
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  getChatStream(messages).then(() => {
    console.log('finished streaming I think?')
  })
}

const ANSWER_PROMPT = `
You are are an automatic assistant. You have just been called because the 'wake' word was said.
Please respond to any questions asked in the following statement. 
Please note that the statement has been transcribed from audio`
