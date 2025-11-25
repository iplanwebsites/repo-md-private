# AI Inference API

## Overview

The Repo.md API provides AI inference endpoints for generating embeddings from text and images. These endpoints are available under `/api/inference/`.

## Authentication

Currently no authentication required for these endpoints.

## Available Endpoints

### 1. Text Embeddings

Generate semantic embeddings for text content.

**Endpoint:** `POST /api/inference/text-embedding` or `GET /api/inference/text-embedding`

**POST Body:**
```json
{
  "text": "Machine learning is transforming software development",
  "instruction": "Represent the document for retrieval:" // optional
}
```

**GET Query Parameters:**
```
?text=Machine learning is transforming software development&instruction=Represent the document for retrieval:
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "success",
    "embedding": [0.1234, -0.5678, ...], // 384-dimensional array
    "metadata": {
      "model": "all-MiniLM-L6-v2",
      "dimension": 384,
      "duration": 156
    }
  }
}
```

### 2. CLIP Text Embeddings

Generate CLIP embeddings for text (useful for text-image matching).

**Endpoint:** `POST /api/inference/clip-by-text` or `GET /api/inference/clip-by-text`

**POST Body:**
```json
{
  "text": "A beautiful sunset over mountains"
}
```

**GET Query Parameters:**
```
?text=A beautiful sunset over mountains
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "success",
    "embedding": [0.2345, -0.6789, ...], // 512-dimensional array
    "metadata": {
      "model": "mobileclip",
      "dimension": 512,
      "duration": 245
    }
  }
}
```

### 3. CLIP Image Embeddings

Generate CLIP embeddings for images.

**Endpoint:** `POST /api/inference/clip-by-image`

**Option A - Image URL:**
```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

**Option B - Base64 Image:**
```json
{
  "imageData": "/9j/4AAQSkZJRgABAQEAYABgAAD..." // base64 encoded
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "success",
    "embedding": [0.3456, -0.7890, ...], // 512-dimensional array
    "metadata": {
      "model": "mobileclip",
      "dimension": 512,
      "duration": 892
    }
  }
}
```

## Error Responses

```json
{
  "success": false,
  "message": "Missing required field: text"
}
```

## Example Usage

```javascript
// Text embedding (POST)
const response = await fetch('/api/inference/text-embedding', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    text: "Your text here",
    instruction: "Represent the document for search:"
  })
});

// Text embedding (GET)
const response = await fetch('/api/inference/text-embedding?text=Your text here&instruction=Represent the document for search:');

const result = await response.json();
const embedding = result.data.embedding;

// CLIP text embedding (GET)
const clipResponse = await fetch('/api/inference/clip-by-text?text=red car');
const clipResult = await clipResponse.json();
const textEmb = clipResult.data.embedding;

// Image-text similarity
const imageEmb = await getImageEmbedding("https://example.com/car.jpg");
const similarity = cosineSimilarity(textEmb, imageEmb);
```

## Performance

- **Text embeddings**: ~100-300ms
- **CLIP text**: ~200-500ms  
- **CLIP image**: ~500-1500ms (varies by image size)

## Use Cases

- **Semantic search** - Find similar documents/content
- **Image-text matching** - Match images with text descriptions
- **Content recommendations** - Build recommendation systems
- **Document clustering** - Group similar content