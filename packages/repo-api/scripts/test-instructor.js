// examples.js
import instructorEmbedder from "./instructor-embedder.js";

// Enable debug mode if needed
// Set to true to see detailed logs about model operations
const DEBUG_MODE = true;
instructorEmbedder.setDebug(DEBUG_MODE);

// Example 1: Basic embedding
async function basicEmbeddingExample() {
  console.log("Running basic embedding example...");

  const sentence =
    "3D ActionSLAM: wearable person tracking in multi-floor environments";
  const instruction = "Represent the Science title:";

  console.time("First embedding");
  // This first call will initialize the model
  const embedding = await instructorEmbedder.getEmbedding(
    instruction,
    sentence
  );
  console.timeEnd("First embedding");

  console.log(`Embedding dimensions: ${embedding.length}`);
  console.log(`First 5 values: [${embedding.slice(0, 5).join(", ")}]`);

  // Second call should be much faster as model is already loaded
  console.time("Second embedding");
  await instructorEmbedder.getEmbedding(instruction, sentence);
  console.timeEnd("Second embedding");
}

// Example 2: Similarity calculation
async function similarityExample() {
  console.log("\nRunning similarity example...");

  const sentenceA = "Parton energy loss in QCD matter";
  const instructionA = "Represent the Science sentence:";

  const sentenceB = "The Chiral Phase Transition in Dissipative Dynamics";
  const instructionB = "Represent the Science sentence:";

  const sentenceC =
    "The Federal Reserve on Wednesday raised its benchmark interest rate";
  const instructionC = "Represent the Financial statement:";

  console.time("Similarity calculation");
  const similarityAB = await instructorEmbedder.calculateSimilarity(
    instructionA,
    sentenceA,
    instructionB,
    sentenceB
  );

  const similarityAC = await instructorEmbedder.calculateSimilarity(
    instructionA,
    sentenceA,
    instructionC,
    sentenceC
  );
  console.timeEnd("Similarity calculation");

  console.log(
    `Similarity between science sentences: ${similarityAB.toFixed(4)}`
  );
  console.log(
    `Similarity between science and finance: ${similarityAC.toFixed(4)}`
  );
}

// Example 3: Document retrieval
async function documentRetrievalExample() {
  console.log("\nRunning document retrieval example...");

  const query = "where is the food stored in a yam plant";
  const queryInstruction =
    "Represent the Wikipedia question for retrieving supporting documents:";

  const documents = [
    "Capitalism has been dominant in the Western world since the end of feudalism, but most feel that the term 'mixed economies' more precisely describes most contemporary economies, due to their containing both private-owned and state-owned enterprises.",
    "The disparate impact theory is especially controversial under the Fair Housing Act because the Act regulates many activities relating to housing, insurance, and mortgage loans.",
    "Yams are perennial herbaceous vines cultivated for the consumption of their starchy tubers in many temperate and tropical regions. The tubers themselves, also called 'yams', come in a variety of forms owing to numerous cultivars and related species.",
    "In botany, a tuber is a type of plant structure that is enlarged to store nutrients. Tubers form at the base of roots or rhizomes. They serve as a plant's primary food storage and, in some plants, enable it to survive winter or dry months.",
    "The sweet potato or sweetpotato is a dicotyledonous plant that belongs to the bindweed or morning glory family, Convolvulaceae. Its large, starchy, sweet-tasting tuberous roots are used as a root vegetable.",
  ];
  const docInstruction = "Represent the Wikipedia document for retrieval:";

  console.time("Document retrieval");
  const results = await instructorEmbedder.findSimilarDocuments(
    queryInstruction,
    query,
    docInstruction,
    documents,
    3 // top 3 results
  );
  console.timeEnd("Document retrieval");

  console.log("Top matching documents:");
  results.forEach((result, i) => {
    console.log(`${i + 1}. Score: ${result.score.toFixed(4)}`);
    console.log(`   ${result.document.slice(0, 100)}...`);
  });
}

// Example 4: Batch processing
async function batchProcessingExample() {
  console.log("\nRunning batch processing example...");

  const pairs = [
    ["Represent the Science title:", "Quantum Computing: A New Paradigm"],
    [
      "Represent the Financial statement:",
      "Inflation rose to 3.2% in January, exceeding analyst expectations",
    ],
    [
      "Represent the Medical research:",
      "New study shows promising results for Alzheimer's treatment",
    ],
    [
      "Represent the Legal document:",
      "The parties hereby agree to the following terms and conditions",
    ],
  ];

  console.time("Batch embeddings");
  const embeddings = await instructorEmbedder.batchGetEmbeddings(pairs);
  console.timeEnd("Batch embeddings");

  console.log(`Generated ${embeddings.length} embeddings`);
  for (let i = 0; i < embeddings.length; i++) {
    console.log(`Embedding ${i + 1} dimensions: ${embeddings[i].length}`);
  }

  // Calculate similarities between all pairs
  console.log("\nSimilarity matrix:");
  const similarityMatrix = [];
  for (let i = 0; i < embeddings.length; i++) {
    similarityMatrix[i] = [];
    for (let j = 0; j < embeddings.length; j++) {
      const similarity = instructorEmbedder.cosineSimilarity(
        embeddings[i],
        embeddings[j]
      );
      similarityMatrix[i][j] = similarity.toFixed(2);
    }
    console.log(similarityMatrix[i].join("\t"));
  }
}

// Run all examples
async function runAllExamples() {
  try {
    await basicEmbeddingExample();
    await similarityExample();
    await documentRetrievalExample();
    await batchProcessingExample();
    console.log("\nAll examples completed successfully!");
  } catch (error) {
    console.error("Error running examples:", error);
  }
}

// Run the examples
runAllExamples();
