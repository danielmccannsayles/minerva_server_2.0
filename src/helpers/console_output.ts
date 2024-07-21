// import readline from 'readline'

// // Generator function for progress sequence
// const progressGenerator = (function* progressSequence () {
//   const progressChars = ['.', '..', '...']
//   let index = 0

//   while (true) {
//     yield progressChars[index]
//     index = (index + 1) % progressChars.length
//   }
// })()

// // Function to increment the progress - called dataRecieved
// export function dataReceived () {
//   readline.clearLine(process.stdout, 0)
//   readline.cursorTo(process.stdout, 0)
//   process.stdout.write(progressGenerator.next().value)
// }

// // Override console.log to handle custom behavior
// const originalConsoleLog = console.log
// console.log = function (...args) {
//   dataReceived() // Move the progress bar to a new line
//   originalConsoleLog.apply(console, args) // Call the original console.log
//   dataReceived() // Restart the progress bar on the new line
// }

//TODO: make this work correctly - want to log '.', '..', '...' sequentially as data hits.
// ALso want to be able to console.log() and have it make a new line and just move the ., .., ...
// down a line. Not workign currently and spiking my CPU so likely needs to be optimized
