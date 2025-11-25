#!/usr/bin/env node

/**
 * Test script for media upload endpoints
 * Usage: node test-media-upload.js
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.AUTH_TOKEN; // Set this to a valid JWT token
const PROJECT_ID = process.env.PROJECT_ID; // Set this to a valid project ID

if (!AUTH_TOKEN || !PROJECT_ID) {
  console.error('❌ Please set AUTH_TOKEN and PROJECT_ID environment variables');
  console.error('Example: AUTH_TOKEN="your-jwt-token" PROJECT_ID="your-project-id" node test-media-upload.js');
  process.exit(1);
}

async function testFileUpload() {
  console.log('🧪 Testing file upload endpoint...');
  
  try {
    // Create a test file
    const testContent = Buffer.from('Hello, this is a test file for media upload!');
    const form = new FormData();
    
    // Add the file to form data
    form.append('files', testContent, {
      filename: 'test-upload.txt',
      contentType: 'text/plain'
    });
    
    // Add optional parameters
    form.append('folder', 'test');
    form.append('commit_message', 'Test upload via API');
    
    const response = await axios.post(
      `${API_BASE_URL}/api/projects/${PROJECT_ID}/upload-files`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    console.log('✅ File upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ File upload failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUnsplashSearch() {
  console.log('\n🧪 Testing Unsplash search endpoint...');
  
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/projects/unsplash/search`,
      {
        params: {
          q: 'mountains',
          per_page: 5
        },
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    console.log('✅ Unsplash search successful!');
    console.log(`Found ${response.data.data.results.length} results`);
    console.log('First result:', response.data.data.results[0]);
    return true;
  } catch (error) {
    console.error('❌ Unsplash search failed:', error.response?.data || error.message);
    return false;
  }
}

async function testStockPhotoUpload() {
  console.log('\n🧪 Testing stock photo upload endpoint...');
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/projects/${PROJECT_ID}/add-stock-photo`,
      {
        unsplash_url: 'https://unsplash.com/photos/Y8lCoTRgHPE', // Example photo
        filename: 'mountain-landscape.jpg',
        folder: 'stock-photos',
        attribution: {
          photographer: 'John Doe',
          unsplash_username: 'johndoe'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Stock photo upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Stock photo upload failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting media upload API tests...');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  
  const results = {
    fileUpload: await testFileUpload(),
    unsplashSearch: await testUnsplashSearch(),
    stockPhotoUpload: await testStockPhotoUpload()
  };
  
  console.log('\n📊 Test Results:');
  console.log('File Upload:', results.fileUpload ? '✅ PASSED' : '❌ FAILED');
  console.log('Unsplash Search:', results.unsplashSearch ? '✅ PASSED' : '❌ FAILED');
  console.log('Stock Photo Upload:', results.stockPhotoUpload ? '✅ PASSED' : '❌ FAILED');
  
  const allPassed = Object.values(results).every(r => r);
  console.log('\nOverall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runTests().catch(console.error);