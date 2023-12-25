window.addEventListener("DOMContentLoaded", async () => {
  // chat.js
  class Chat {
    constructor(title, poet, messages = []) {
      this.title = title;
      this.poet = poet;
      this.messages = messages; // Array of message objects { role: '', content: '' }
    }

    updateChat(role, content) {
      this.messages.push({ role: role, content: content });
      saveChatToLocalStorage(this);
    }

    async getResponseAsync() {
      try {
        const response = await fetch("/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: this.title,
            poet: this.poet,
            messages: this.messages,
          }),
        });
        const data = await response.json();
        return data.content;
      } catch (error) {
        console.error("Error fetching response:", error);
        return "";
      }
    }

    updateMessagesDisplay() {
      const messagesContainer = document.querySelector("#messages");
      messagesContainer.innerHTML = ""; // Clear current messages

      this.messages.forEach((msg, index) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", msg.role);
        const textElement = document.createElement("p");
        textElement.textContent = msg.content;
        messageElement.appendChild(textElement);
        if (msg.role === "assistant") {
          //
          const ttsButton = document.createElement("button");
          ttsButton.classList.add("tts-button");
          ttsButton.textContent = "Speak";
          ttsButton.onclick = () => {
            if (ttsButton.textContent === "Speak") {
              stopAssistantAudio();
              getAssistantSpeech(msg.content, index);
              ttsButton.textContent = "Stop";
            } else {
              ttsButton.textContent = "Speak";
              stopAssistantAudio();
            }
          };
          messageElement.appendChild(ttsButton);
        }

        messagesContainer.appendChild(messageElement);
      });
    }
  }
  function saveChatToLocalStorage(chat) {
    try {
      const chatData = JSON.stringify(chat);
      localStorage.setItem(`${chat.title}-${chat.poet}`, chatData);
    } catch (error) {
      console.error("Error saving chat to local storage:", error);
    }
  }

  function restoreChatFromLocalStorage(title, poet) {
    try {
      const chatData = localStorage.getItem(`${title}-${poet}`);
      if (chatData) {
        const parsedData = JSON.parse(chatData);
        const { title, poet, messages } = parsedData;
        const chat = new Chat(title, poet, messages);
        return chat;
      }
      return null; // Return null if no chat data found
    } catch (error) {
      console.error("Error restoring chat from local storage:", error);
      return null;
    }
  }

  function stopAssistantAudio() {
    const ttsButtons = document.querySelectorAll(".tts-button");
    ttsButtons.forEach((button) => {
      if (button.textContent === "Stop") {
        button.textContent = "Speak";
      }
    });
    const audioElement = document.querySelector("#assistant-audio");
    audioElement.pause();
    audioElement.currentTime = 0;
  }

  // audio handler
  const poemAudio = document.querySelector("#poem-audio");
  const source = poemAudio.querySelector("source");
  const timeSlider = document.querySelector("#time-slider");
  const playPauseBtn = document.querySelector("#play-pause-btn");

  poemAudio.addEventListener("ended", () => {
    playPauseBtn.textContent = "Play";
  });
  playPauseBtn.addEventListener("click", () => {
    // log the source
    if (source.src === "") {
      console.log("no audio source");
      return;
    }

    if (poemAudio.paused) {
      poemAudio.play();
      playPauseBtn.textContent = "Pause";
    } else {
      poemAudio.pause();
      playPauseBtn.textContent = "Play";
    }
  });

  // Update slider based on audio time
  poemAudio.addEventListener("timeupdate", (e) => {
    // if not paused
    // get the current time
    if (poemAudio.paused) {
      return;
    }
    timeSlider.value = e.target.currentTime;
  });

  // Change audio based on slider
  timeSlider.addEventListener("input", (e) => {
    poemAudio.currentTime = e.target.value;
  });

  function updateAudioSource() {
    const audioElement = document.querySelector("#poem-audio");
    const sourceElement = audioElement.querySelector("source");
    sourceElement.src = "/poem-speech";
    audioElement.load();
  }

  // create async function to get Speech
  async function getPoemSpeech(text) {
    const response = await fetch("/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    });
    if (response.ok) {
      // set the time slider max value
      const data = await response.json();
      const duration = data.duration;
      console.log("duration: ");
      console.log(duration);
      timeSlider.max = duration;
    }
  }

  async function getAssistantSpeech(text, index) {
    // Send text to the server to generate speech
    const response = await fetch("/assistant-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      // Update audio source and play
      const audioElement = document.querySelector("#assistant-audio");
      audioElement.playbackRate = 0.8;
      audioElement.querySelector(
        "source"
      ).src = `/assistant-speech?index=${index}`;
      audioElement.load();
      audioElement.play();
    }
  }

  // Initialize chat object when the page loads
  // Check if chat data is stored in local storage
  const poemHeader = document.querySelector("#title-poet").textContent;
  const title = poemHeader.split(" - by ")[0];
  const poet = poemHeader.split(" - by ")[1];
  let chat = restoreChatFromLocalStorage(title, poet);
  if (chat === null) {
    chat = new Chat(title, poet);
  } else {
    // Update messages display
    chat.updateMessagesDisplay();
  }
  console.log("Chat: ");
  console.log(chat);
  // Event listener for the Submit button
  document
    .querySelector("#submit-message")
    .addEventListener("click", async () => {
      const userInput = document.querySelector("#message-input");

      // Update chat with user message
      chat.updateChat("user", userInput.value);
      chat.updateMessagesDisplay();
      userInput.value = "";

      // Get AI response
      const aiResponse = await chat.getResponseAsync();

      // Update chat with AI response
      chat.updateChat("assistant", aiResponse);
      chat.updateMessagesDisplay();
      console.log("updated chat:");
      console.log(chat.messages);
    });

  // audio recording

  let mediaRecorder;
  let audioChunks = [];

  const startRecordBtn = document.getElementById("start-record-btn");
  const stopRecordBtn = document.getElementById("stop-record-btn");
  const transcribingBtn = document.getElementById("transcribing-btn");
  const messageInput = document.querySelector("#message-input");

  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      switchRecordingButtonState("transcribing");
      const audioBlob = new Blob(audioChunks, { type: "audio/mpeg-3" });
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.mp3");
      const response = await fetch("/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      const text = data.text;
      switchRecordingButtonState("start");
      messageInput.value += text;
    };
  });

  startRecordBtn.addEventListener("click", () => {
    mediaRecorder.start();
    switchRecordingButtonState("stop");
  });

  stopRecordBtn.addEventListener("click", () => {
    mediaRecorder.stop();
    audioChunks = [];
    switchRecordingButtonState("transcribing");
  });

  function switchRecordingButtonState(newState) {
    if (newState == "start") {
      startRecordBtn.classList.remove("hidden");
      stopRecordBtn.classList.add("hidden");
      transcribingBtn.classList.add("hidden");
    } else if (newState == "stop") {
      startRecordBtn.classList.add("hidden");
      stopRecordBtn.classList.remove("hidden");
      transcribingBtn.classList.add("hidden");
    } else if (newState == "transcribing") {
      startRecordBtn.classList.add("hidden");
      stopRecordBtn.classList.add("hidden");
      transcribingBtn.classList.remove("hidden");
    }
  }

  const assistantAudio = document.querySelector("#assistant-audio");
  assistantAudio.addEventListener("ended", () => {
    stopAssistantAudio();
  });

  const loaderWrapper = document.querySelector(".loader-wrapper");
  const poemContent = document.querySelector("#poem-content").textContent;

  // get the audio for the poem
  await getPoemSpeech(poemContent);
  updateAudioSource();

  // now we can show the poem section
  const topSection = document.querySelector(".top-section");
  // remove hidden
  topSection.classList.remove("hidden");
  loaderWrapper.classList.add("hidden");
  // initialize the audio player
});
