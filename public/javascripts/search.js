const searchResultsElement = document.getElementById("search-results");
const searchInput = document.getElementById("search-input");
let currentBatchIndex = 0;
const batchSize = 10;
let results = [];

async function searchPoems(query) {
  try {
    const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching search results:", error);
  }
}

function displaySearchResults(results) {
  const loadMoreBtn = document.querySelector(".load-more-btn");

  if (results.length === 0) {
    loadMoreBtn.classList.add("hidden");
  } else {
    loadMoreBtn.classList.remove("hidden");
  }

  if (currentBatchIndex === 0) {
    searchResultsElement.innerHTML = ""; // Clear results only if new search
  }
  if (currentBatchIndex * batchSize >= results.length) {
    // Disable load more button if no more results
    document.getElementById("load-more-btn").disabled = true;
    return;
  }
  console.log(currentBatchIndex);
  const startIdx = currentBatchIndex * batchSize;
  const endIdx = startIdx + batchSize;
  results.slice(startIdx, endIdx).forEach((poem) => {
    const resultElement = document.createElement("div");
    resultElement.classList.add("search-result");

    const title = document.createElement("a");
    title.href = `/chat/${poem["ID"]}`;
    title.textContent = poem["Title"];

    const author = document.createElement("p");
    author.textContent = poem["Poet"];

    const snippet = document.createElement("p");
    if (poem["Poem"].length > 100) {
      snippet.textContent = poem["Poem"].substring(0, 100) + "...";
    } else {
      snippet.textContent = poem["Poem"];
    }

    resultElement.appendChild(title);
    resultElement.appendChild(author);
    resultElement.appendChild(snippet);

    searchResultsElement.appendChild(resultElement);
  });

  currentBatchIndex++;
}

// Reset batch index on new search
searchInput.addEventListener("input", async (e) => {
  const query = e.target.value;
  if (query.length > 0) {
    currentBatchIndex = 0; // Reset the index on new search
    results = await searchPoems(query);
    displaySearchResults(results);
  } else {
    searchResultsElement.innerHTML = "";
    document.querySelector(".load-more-btn").classList.add("hidden");
  }
});
// Load more button event listener
document.querySelector(".load-more-btn").addEventListener("click", () => {
  displaySearchResults(results);
});
