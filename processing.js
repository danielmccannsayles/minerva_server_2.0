import fs from "fs";
import { OPEN_API_KEY } from "./keys.js";
import OpenAI from "openai";

const openaiClient = new OpenAI({ apiKey: OPEN_API_KEY });

async function getChatCompletion(messages) {
  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      max_tokens: 300, // Dunno if this matters
    });

    const completion = response.choices[0];
    console.log("Completion:", completion);
    return completion.message;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
  }
}

/** Calls chat complete to reformat document. Passed in  */
export async function formatDocument(outputPaths, index) {
  console.log("formatting document");
  const unformattedFile = fs.readFileSync(
    `${outputPaths.raw}/conversation_${index}.txt`,
    "utf8"
  );
  const messages = [
    { role: "system", content: REFORMAT_PROMPT },
    { role: "user", content: unformattedFile },
  ];

  const responsePromise = getChatCompletion(messages);
  responsePromise.then((response) => {
    console.log("response recieved: " + response.content);
    fs.writeFile(
      `${outputPaths.generated}/note_${index}.md`,
      response.content,
      (err) => {
        console.log(
          `Wrote reformatted notes to file${err ? ` err:${err}` : ""}`
        );
      }
    );
  });
}

const REFORMAT_PROMPT = `
You are Minerva, a helpful assistant. I will send you a single line string created with speech to text. 
Reformat it for readability and correctness, and return it as Markdown. If something seems off, correct it. 
This string is a note for future reference.

1. Improve readability.
2. Turn listed items into a list.
3. Titles should be formatted in markdown to be larger.
4. Add useful ideas or context.
5. Commentary from you should be in *italics*.

Examples:
- Input: "buy milk eggs bread cheese"
  - Output: 
    ### Shopping List
    - Milk
    - Eggs
    - Bread
    - Cheese

- Input: "meeting at 10am with team to discuss project updates and deadlines"
  - Output:
    ### Meeting Reminder
    Meeting at 10 AM with the team to discuss:
    - Project updates
    - Deadlines

*Note: Correct any obvious errors and enhance the note for clarity and utility.*

** Respond ONLY with the re-written string. **
`;
