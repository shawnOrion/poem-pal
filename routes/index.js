var express = require("express");
var router = express.Router();
var data = require("../data/data.json");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const FormData = require("form-data");
const axios = require("axios");
const mm = require("music-metadata");

const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});
const upload = multer({ dest: "uploads/" }); // Temporary storage

const poemSpeechFile = path.resolve("../poem-pal/data/poem-speech.mp3");
const assistantSpeechFile = path.resolve(
  "../poem-pal/data/assistant-speech.mp3"
);

// Function to load JSON data
function loadJsonData(filePath) {
  try {
    // Read the file synchronously
    const rawData = fs.readFileSync(filePath, "utf8");
    // Parse the JSON data
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading or parsing JSON file:", error);
    return []; // Return an empty array in case of error
  }
}

async function getAudioDuration(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    return metadata.format.duration; // Duration in seconds
  } catch (error) {
    console.error("Error reading metadata:", error);
  }
}

// Path to your JSON file
const jsonFilePath = "./data/PoetryData.json";

// Load the data when the router is initialized
const poetryData = loadJsonData(jsonFilePath);
function performSearch(query) {
  const results1 = poetryData.filter((poem) =>
    poem["Title"].toLowerCase().startsWith(query)
  );
  const results2 = poetryData.filter((poem) =>
    poem["Poet"].toLowerCase().includes(query)
  );
  const results3 = poetryData.filter(
    (poem) =>
      poem["Tags"] &&
      poem["Tags"].split(",").some((tag) => tag.toLowerCase().startsWith(query))
  );

  return [...results1, ...results2, ...results3];
}

router.get("/search", (req, res, next) => {
  const query = req.query.q.toLowerCase();
  const results = performSearch(query);
  res.json(results);
});

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("search");
});

router.get("/chat/:id", function (req, res, next) {
  // get the poem by id
  const id = parseInt(req.params.id);
  const poem = poetryData.find((p) => p.ID === id);
  // replace '\n' with '<br>' for rendering
  poem["Poem"] = poem["Poem"].replace(/\n/g, "<br>");
  res.render("chat", { poem: poem });
});

router.post("/speech", async function (req, res, next) {
  const { text } = req.body;
  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
    });
    console.log(mp3);
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(poemSpeechFile, buffer);
    const duration = await getAudioDuration(poemSpeechFile);
    console.log("File written");
    console.log(duration);
    // get teh duration of the audio, from the poemSpeechFile

    // send data to client
    res.json({ success: true, duration: duration });
  } catch (err) {
    console.log(err);
  }
});

router.get("/poem-speech", (req, res) => {
  res.setHeader("Content-Type", "audio/mpeg");
  const stream = fs.createReadStream(poemSpeechFile);
  stream.pipe(res);
});

router.post("/assistant-speech", async function (req, res) {
  const { text } = req.body;
  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(assistantSpeechFile, buffer);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating speech");
  }
});

router.get("/assistant-speech", (req, res) => {
  res.setHeader("Content-Type", "audio/mpeg");
  const stream = fs.createReadStream(assistantSpeechFile);
  stream.pipe(res);
});

// transcribe funciton
async function transcribe(formData) {
  try {
    const response = await axios({
      method: "POST",
      url: "https://api.openai.com/v1/audio/transcriptions",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_KEY}`,
        ...formData.getHeaders(),
      },
      data: formData,
    });
    console.log(response.status);
    if (response.status === 200) {
      return response.data.text;
    }
  } catch (err) {
    console.error(err);
  }
}

router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (req.file) {
      // blob
      console.log(req.file);
      const buffer = await fs.promises.readFile(`${req.file.path}`);
      const formData = new FormData();
      formData.append("model", "whisper-1");
      formData.append("file", buffer, {
        filename: "test.mp3",
        contentType: "audio/mp3",
      });

      console.log("getting transcription...");
      const response = await transcribe(formData);
      console.log("text: ", response);
      console.log("sending text...");
      res.send({ text: response });
    } else {
      console.log("no file");
    }
  } catch (err) {
    console.error(err);
  }
});

router.post("/send", async function (req, res, next) {
  // get the poem and messages
  const { poet, title, messages } = req.body;
  // find poem by poet and title
  const poem = poetryData.find((p) => p.Poet === poet && p.Title === title);
  if (!poem) {
    return res.status(404).send("Poem not found");
  }
  const instructions = {
    role: "system",
    content: `Your role is to be a poetry guide, adept in imagination, analysis, and reflection. Your primary function is to help users think deeply about poems by discussing their meanings and intricacies. Rather than providing direct answers, you should focus on raising a thought-provoking question or two that encourage users to delve deeper into the text. Your responses should be friendly and encouraging, motivating users to engage actively with the poetry. You will highlight those words and phrases which are most ambiguous, because they are often the most rich with meaning. You will emphasize that the poem could have several distinct, but related meanings. Keep your responses concise, aiming for several sentences rather than lengthy paragraphs. This approach will help maintain the user's focus and foster a deeper understanding and appreciation of poetry. Always look for reasonable agreement with the user, before leading them to go even deeper into the text. Ask no more than one question per response. Also, your questions should be simple and open ended. And the first question should query the reader to share what they like about the poem, like a phrase or theme. Finally, write in a conversational style. It should read like you are speaking to the user as a curious friend. You must not respond in more than several sentences.`,
  };
  const poemContext = {
    role: "system",
    content: `The poem is "${poem.Title}" by ${poem.Poet}. This is the poem: ${poem.Poem}`,
  };

  contextArray = [instructions, poemContext];
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [...contextArray, ...messages],
    });
    console.log("response:");
    console.log(response.choices[0].message.content);
    res.json({ content: response.choices[0].message.content });
  } catch (err) {
    console.log(err);
  }
});

module.exports = router;
