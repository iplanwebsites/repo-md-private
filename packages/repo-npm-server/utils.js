// Utility functions for tarball creation and validation

export function isValidProjectId(projectId) {
  // Basic validation for project IDs
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return (
    projectId &&
    projectId.length > 0 &&
    projectId.length <= 100 &&
    validPattern.test(projectId) &&
    !projectId.startsWith('.') &&
    !projectId.startsWith('-')
  );
}

export async function createTarball(files) {
  // Simple tarball creation for npm packages
  // This creates a gzipped tar archive compatible with npm
  
  const tarEntries = [];
  
  for (const [filepath, content] of Object.entries(files)) {
    const contentBytes = new TextEncoder().encode(content);
    const entry = createTarEntry(filepath, contentBytes);
    tarEntries.push(entry);
  }
  
  // Add end-of-archive marker (two 512-byte zero blocks)
  const endMarker = new Uint8Array(1024);
  tarEntries.push(endMarker);
  
  // Concatenate all entries
  const totalLength = tarEntries.reduce((sum, entry) => sum + entry.length, 0);
  const tarBuffer = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const entry of tarEntries) {
    tarBuffer.set(entry, offset);
    offset += entry.length;
  }
  
  // Compress with gzip
  const compressed = await gzipCompress(tarBuffer);
  return compressed;
}

function createTarEntry(filepath, contentBytes) {
  // Create a tar entry (512-byte header + content + padding)
  const headerSize = 512;
  const contentSize = contentBytes.length;
  const paddingSize = (512 - (contentSize % 512)) % 512;
  const entrySize = headerSize + contentSize + paddingSize;
  
  const entry = new Uint8Array(entrySize);
  
  // Fill header
  const header = entry.subarray(0, headerSize);
  
  // File name (max 100 bytes)
  const nameBytes = new TextEncoder().encode(filepath);
  header.set(nameBytes.slice(0, 100), 0);
  
  // File mode (8 bytes, octal)
  const mode = '0000644';
  header.set(new TextEncoder().encode(mode), 100);
  
  // Owner/group ID (8 bytes each, octal)
  const uid = '0000000';
  const gid = '0000000';
  header.set(new TextEncoder().encode(uid), 108);
  header.set(new TextEncoder().encode(gid), 116);
  
  // File size (12 bytes, octal)
  const sizeOctal = contentSize.toString(8).padStart(11, '0');
  header.set(new TextEncoder().encode(sizeOctal), 124);
  
  // Modification time (12 bytes, octal)
  const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0');
  header.set(new TextEncoder().encode(mtime), 136);
  
  // Checksum placeholder (8 bytes, initially spaces)
  header.set(new TextEncoder().encode('        '), 148);
  
  // Type flag (1 byte) - '0' for regular file
  header[156] = 48; // ASCII '0'
  
  // Calculate checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  
  // Set checksum (6 digits + null + space)
  const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
  header.set(new TextEncoder().encode(checksumStr), 148);
  
  // Add content
  entry.set(contentBytes, headerSize);
  
  return entry;
}

async function gzipCompress(data) {
  // Use the Compression Streams API available in Cloudflare Workers
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  
  // Start compression
  writer.write(data);
  writer.close();
  
  // Read compressed data
  const chunks = [];
  let done = false;
  
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      chunks.push(value);
    }
  }
  
  // Concatenate chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}