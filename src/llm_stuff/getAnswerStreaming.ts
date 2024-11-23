import { Readable, Stream } from 'stream'
import { OPEN_AI_KEY } from '../constants_and_types/keys'
import OpenAI from 'openai'

const openaiClient = new OpenAI({ apiKey: OPEN_AI_KEY })

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

    return Readable.from(response)
  } catch (error) {
    console.error('Error calling OpenAI API:', error)
  }
}

export async function getAnswerStreaming (
  userMessage: string
): Promise<Readable | undefined> {
  console.log('starting to stream')
  const messages = [
    { role: 'system', content: ANSWER_PROMPT },
    { role: 'user', content: userMessage }
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  return await getChatStream(messages)
}

const ANSWER_PROMPT = `
You are are an automatic assistant. You have just been called because the 'wake' word was said.
Please respond to any questions asked in the following statement. 
Please note that the statement has been transcribed from audio`
