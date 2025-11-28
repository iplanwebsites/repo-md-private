# AI Inference API Guide

## Overview

This guide explains how to use the AI inference endpoints available in the repo-build-worker service. These endpoints provide access to powerful AI models for text and image embeddings, enabling semantic search, similarity matching, and other AI-powered features.

## Base URL

All inference endpoints are available under the `/inference` path:

```
https://your-worker-domain.com/inference
```

## Available Endpoints

### 1. CLIP Text Embeddings

**Endpoint:** `POST /inference/clip-by-text`

Generate embeddings for text using the MobileCLIP model. Perfect for text-to-image search and cross-modal similarity.

**Request Body:**
```json
{
  "text": "A beautiful sunset over the mountains"
}
```

**Response:**
```json
{
  "status": "success",
  "embedding": [0.1234, -0.5678, 0.9012, ...], // 512-dimensional array
  "metadata": {
    "model": "mobileclip",
    "dimension": 512,
    "duration": 245,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Example Usage:**
```bash
curl -X POST https://your-worker-domain.com/inference/clip-by-text \
  -H "Content-Type: application/json" \
  -d '{"text": "A cat sitting on a windowsill"}'
```

---

### 2. CLIP Image Embeddings

**Endpoint:** `POST /inference/clip-by-image`

Generate embeddings for images using the MobileCLIP model. Supports both URLs and base64-encoded images.

**Option A - Using Image URL:**
```json
{
  "imageUrl": "https://example.com/path/to/image.jpg"
}
```

**Option B - Using Base64 Image Data:**
```json
{
  "imageData": "/9j/4AAQSkZJRgABAQEAYABgAAD..." // base64 encoded image
}
```

**Response:**
```json
{
  "status": "success",
  "embedding": [0.2345, -0.6789, 0.1234, ...], // 512-dimensional array
  "metadata": {
    "model": "mobileclip",
    "dimension": 512,
    "duration": 892,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Example Usage:**
```bash
# Using image URL
curl -X POST https://your-worker-domain.com/inference/clip-by-image \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://picsum.photos/300/200"}'

# Using base64 image data
curl -X POST https://your-worker-domain.com/inference/clip-by-image \
  -H "Content-Type: application/json" \
  -d '{"imageData": "'$(base64 -i path/to/image.jpg)'"}'
```

---

### 3. Text Embeddings

**Endpoint:** `POST /inference/text-embedding`

Generate embeddings for text using the all-MiniLM-L6-v2 model. Ideal for semantic search, document similarity, and text clustering.

**Request Body:**
```json
{
  "text": "This is the document content to embed",
  "instruction": "Represent the document for semantic search:" // optional
}
```

**Response:**
```json
{
  "status": "success",
  "embedding": [0.3456, -0.7890, 0.2345, ...], // 384-dimensional array
  "metadata": {
    "model": "all-MiniLM-L6-v2",
    "dimension": 384,
    "duration": 156,
    "instruction": "Represent the document for semantic search:",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Example Usage:**
```bash
curl -X POST https://your-worker-domain.com/inference/text-embedding \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is revolutionizing how we process data",
    "instruction": "Represent the document for retrieval:"
  }'
```

## Use Cases

### 1. **Image-Text Matching**
Combine CLIP text and image embeddings to find images that match text descriptions:

```javascript
// Get text embedding
const textResponse = await fetch('/inference/clip-by-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "red sports car" })
});
const textEmbedding = await textResponse.json();

// Get image embedding
const imageResponse = await fetch('/inference/clip-by-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageUrl: "https://example.com/car.jpg" })
});
const imageEmbedding = await imageResponse.json();

// Calculate similarity (cosine similarity)
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

const similarity = cosineSimilarity(
  textEmbedding.embedding, 
  imageEmbedding.embedding
);
console.log(`Similarity: ${similarity}`); // Range: -1 to 1
```

### 2. **Document Search**
Use text embeddings to find similar documents:

```javascript
// Embed search query
const queryResponse = await fetch('/inference/text-embedding', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    text: "artificial intelligence applications",
    instruction: "Represent the query for retrieval:"
  })
});

// Embed documents (do this once, store results)
const documents = ["AI is transforming healthcare...", "Machine learning in finance..."];
const docEmbeddings = await Promise.all(
  documents.map(doc => 
    fetch('/inference/text-embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: doc,
        instruction: "Represent the document for retrieval:"
      })
    }).then(r => r.json())
  )
);

// Find most similar document
const queryEmbedding = await queryResponse.json();
const similarities = docEmbeddings.map(docEmb => 
  cosineSimilarity(queryEmbedding.embedding, docEmb.embedding)
);
const bestMatch = similarities.indexOf(Math.max(...similarities));
```

### 3. **Content Recommendations**
Build recommendation systems using semantic similarity:

```javascript
// Get embeddings for user's liked content
const userLikes = ["sunset photography", "landscape art", "nature scenes"];
const userEmbeddings = await Promise.all(
  userLikes.map(text => 
    fetch('/inference/clip-by-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }).then(r => r.json())
  )
);

// Calculate average user preference vector
const avgEmbedding = userEmbeddings[0].embedding.map((_, i) => 
  userEmbeddings.reduce((sum, emb) => sum + emb.embedding[i], 0) / userEmbeddings.length
);

// Find similar content by comparing with avgEmbedding
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

**Common Errors:**
- `400 Bad Request`: Missing required fields (text, imageUrl, or imageData)
- `500 Internal Server Error`: Model processing errors or server issues

## Performance Notes

- **CLIP Text**: ~200-500ms per request
- **CLIP Image**: ~500-1500ms per request (depends on image size)
- **Text Embedding**: ~100-300ms per request

**Optimization Tips:**
1. **Batch Processing**: For multiple texts, consider batching requests
2. **Caching**: Store embeddings for frequently used content
3. **Image Preprocessing**: Resize large images before sending
4. **Base64 vs URLs**: URLs are generally faster than base64 data

## Rate Limiting

Currently no rate limiting is enforced, but consider implementing client-side throttling for production use.

## Model Information

| Endpoint | Model | Dimensions | Use Case |
|----------|-------|------------|----------|
| `/clip-by-text` | MobileCLIP-S0 | 512 | Cross-modal text-image matching |
| `/clip-by-image` | MobileCLIP-S0 | 512 | Cross-modal image-text matching |
| `/text-embedding` | all-MiniLM-L6-v2 | 384 | Text semantic similarity |

## Integration Examples

### Python
```python
import requests
import numpy as np

def get_text_embedding(text, instruction=None):
    payload = {"text": text}
    if instruction:
        payload["instruction"] = instruction
    
    response = requests.post(
        "https://your-worker-domain.com/inference/text-embedding",
        json=payload
    )
    return response.json()["embedding"]

def get_image_embedding(image_url):
    response = requests.post(
        "https://your-worker-domain.com/inference/clip-by-image",
        json={"imageUrl": image_url}
    )
    return response.json()["embedding"]

# Usage
text_emb = get_text_embedding("A beautiful landscape")
image_emb = get_image_embedding("https://example.com/landscape.jpg")

# Calculate similarity
similarity = np.dot(text_emb, image_emb)
print(f"Similarity: {similarity}")
```

### JavaScript/Node.js
```javascript
class InferenceClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getTextEmbedding(text, instruction) {
    const response = await fetch(`${this.baseUrl}/inference/text-embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, instruction })
    });
    const result = await response.json();
    return result.embedding;
  }

  async getImageEmbedding(imageUrl) {
    const response = await fetch(`${this.baseUrl}/inference/clip-by-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    });
    const result = await response.json();
    return result.embedding;
  }

  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Usage
const client = new InferenceClient('https://your-worker-domain.com');
const embedding = await client.getTextEmbedding('Hello world');
```

## Support

For questions or issues with the inference API, please check:
1. Ensure your request format matches the examples above
2. Verify the service is running and accessible
3. Check server logs for detailed error information

---

*Last Updated: January 2024*
*API Version: 1.0*