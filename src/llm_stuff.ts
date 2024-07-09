import fs from 'fs'
import { OPEN_API_KEY } from './keys.js'
import OpenAI from 'openai'
import { OutputPaths } from './types.js'

const openaiClient = new OpenAI({ apiKey: OPEN_API_KEY })

async function getChatCompletion (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) {
  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      max_tokens: 300 // Dunno if this matters
    })

    const completion = response.choices[0]
    console.log('Completion:', completion)
    return completion.message
  } catch (error) {
    console.error('Error calling OpenAI API:', error)
  }
}

/** Calls chat complete to reformat document. Passed in  */
export async function formatDocument (outputPaths: OutputPaths, index: number) {
  console.log('formatting document')
  const unformattedFile = fs.readFileSync(
    `${outputPaths.raw}/conversation_${index}.txt`,
    'utf8'
  )
  const messages = [
    { role: 'system', content: REFORMAT_PROMPT },
    { role: 'user', content: unformattedFile }
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]

  const responsePromise = getChatCompletion(messages)
  responsePromise.then(response => {
    console.log('response recieved: ' + response?.content)
    fs.writeFile(
      `${outputPaths.generated}/note_${index}.md`,
      response?.content || '',
      err => {
        console.log(
          `Wrote reformatted notes to file${err ? ` err:${err}` : ''}`
        )
      }
    )
  })
}

const REFORMAT_PROMPT = `
You are a helpful assistant. I will send you a single line string created with speech to text. 
Reformat it for readability and correctness, and return it as Markdown. If something seems off, correct it. 
Do not remove content. Only add content to it. 

Content added by you, the assistant, should follow this format:
** I am some added content **

This added content should be notes, questions, and ideas for improving the ideas talked about. For instance:
** This approach could be improved by doing {actionable thing} **
** How will {this application/idea} make money? **
** {process1} might not be the best way of doing {task/idea} - {process2} might be better

Corrected words should have *sic* displayed after them. Any word that is not in the original and is not an addition
should have *sic* after it
corrected_word *sic*

Examples:
- Input: "Okay so I was thinnking that I should make this idea new project idea I'm going to create an app that can interface with a llm and then connect that to a no instance with a server. I'll be able to talk to this application. So this application needs to proces speed to text. Yeah speed to test. Then it will make notes for me. And every so often, a LLM will be called that will both format my nose into something better and also answer questions."
  - Output: 
    ## Project Idea:
      Application that interfaces with a LLM. Connects to a node *sic* instance. 
      Features:
        - Needs to proces speech *sic* to text
        - Makes notes for me ** What type of notes? **
        - Formats notes *sic* for me
        - LLM called to answer questions ** The application should use a RAG system to add the notes to context **

      ** This application will likely need to have text to speech so it can answer questions **


- Input: "So large language models right now don't have a sequential conciousness they are just getting re-run what seperates them from human conciseness well we have sequential processing is that it? maybe hmm huh I see yes that makes sense our neurons stay in the same play over time. That's where conciousness comes from"
  - Output:
    Large language models currently don't have a sequential conciousness they just get re-run.
    Human conciousness *sic* is different because we have sequential processing. Our neurons stay in the same
    place *sic* over time. This is where conciousness comes from.


Respond ONLY with the re-written markdown string.
`
