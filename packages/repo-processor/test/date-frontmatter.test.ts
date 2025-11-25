import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { processFolder } from "../src/process/processFolder";

// Create a temporary test directory
const testDir = path.join(__dirname, "temp-date-test");

describe("Date frontmatter parsing", () => {
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test markdown file with date frontmatter (both padded and non-padded)
    const testContent = `---
date: 2025-10-30
title: Test Post with Date
author: Test Author
published: 2025-10-28
tags:
  - test
  - date
metadata:
  created: 2025-10-25
  modified: 2025-10-30
public: true
---

# Test Post

This is a test post to verify date frontmatter parsing.`;

    const nonPaddedContent = `---
date: 2025-10-7
title: Non-padded Date Post
created: 2025-3-9
updated: 2025-1-1
metadata:
  archived: 2025-12-31
  scheduled: 2025-5-15
public: true
---

# Non-padded Date Post

Testing non-zero-padded dates.`;

    fs.writeFileSync(path.join(testDir, "test-post.md"), testContent);
    fs.writeFileSync(path.join(testDir, "non-padded-post.md"), nonPaddedContent);
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should preserve date fields in frontmatter as Date objects that serialize to ISO strings", async () => {
    const result = await processFolder(testDir, {
      processAllFiles: true,
      debug: 0
    });

    // We have 2 files now
    expect(result.length).toBeGreaterThanOrEqual(2);
    const post = result.find(p => p.title === "Test Post with Date")!;

    // Check that the frontmatter exists
    expect(post.frontmatter).toBeDefined();

    // Check that date fields are preserved and serializable
    expect(post.frontmatter.date).toBeDefined();
    expect(post.frontmatter.published).toBeDefined();
    expect(post.frontmatter.metadata?.created).toBeDefined();
    expect(post.frontmatter.metadata?.modified).toBeDefined();

    // Check that they serialize correctly to JSON (not as empty objects)
    const jsonString = JSON.stringify(post.frontmatter);
    const parsed = JSON.parse(jsonString);

    // Dates should be ISO strings after serialization, not empty objects
    expect(parsed.date).toBe("2025-10-30T00:00:00.000Z");
    expect(parsed.published).toBe("2025-10-28T00:00:00.000Z");
    expect(parsed.metadata.created).toBe("2025-10-25T00:00:00.000Z");
    expect(parsed.metadata.modified).toBe("2025-10-30T00:00:00.000Z");

    // Ensure no empty objects
    expect(parsed.date).not.toEqual({});
    expect(parsed.published).not.toEqual({});
    expect(parsed.metadata.created).not.toEqual({});
    expect(parsed.metadata.modified).not.toEqual({});
  });

  it("should parse non-zero-padded dates correctly", async () => {
    const result = await processFolder(testDir, {
      processAllFiles: true,
      debug: 0
    });

    const nonPaddedPost = result.find(p => p.title === "Non-padded Date Post");
    expect(nonPaddedPost).toBeDefined();

    // Check that the frontmatter exists
    expect(nonPaddedPost!.frontmatter).toBeDefined();

    // Check that non-padded date fields are now Date objects
    expect(nonPaddedPost!.frontmatter.date).toBeDefined();
    expect(nonPaddedPost!.frontmatter.created).toBeDefined();
    expect(nonPaddedPost!.frontmatter.updated).toBeDefined();

    // Check that they serialize correctly to JSON
    const jsonString = JSON.stringify(nonPaddedPost!.frontmatter);
    const parsed = JSON.parse(jsonString);

    // Non-padded dates should now be ISO strings after serialization
    expect(parsed.date).toBe("2025-10-07T00:00:00.000Z");
    expect(parsed.created).toBe("2025-03-09T00:00:00.000Z");
    expect(parsed.updated).toBe("2025-01-01T00:00:00.000Z");
    expect(parsed.metadata.archived).toBe("2025-12-31T00:00:00.000Z");
    expect(parsed.metadata.scheduled).toBe("2025-05-15T00:00:00.000Z");

    // Ensure no empty objects
    expect(parsed.date).not.toEqual({});
    expect(parsed.created).not.toEqual({});
    expect(parsed.updated).not.toEqual({});
  });

  it("should handle mixed frontmatter with dates and other types", async () => {
    const mixedContent = `---
date: 2025-10-30
title: Mixed Content Post
count: 42
ratio: 3.14159
enabled: true
list:
  - item1
  - item2
nested:
  date: 2025-10-28
  value: test
public: true
---

# Mixed Content

Testing mixed frontmatter types.`;

    const mixedFile = path.join(testDir, "mixed-post.md");
    fs.writeFileSync(mixedFile, mixedContent);

    const result = await processFolder(testDir, {
      processAllFiles: true,
      debug: 0
    });

    const mixedPost = result.find(p => p.title === "Mixed Content Post");
    expect(mixedPost).toBeDefined();

    // Serialize and parse back
    const jsonString = JSON.stringify(mixedPost!.frontmatter);
    const parsed = JSON.parse(jsonString);

    // Check all types are preserved correctly
    expect(parsed.date).toBe("2025-10-30T00:00:00.000Z");
    expect(parsed.title).toBe("Mixed Content Post");
    expect(parsed.count).toBe(42);
    expect(parsed.ratio).toBe(3.14159);
    expect(parsed.enabled).toBe(true);
    expect(parsed.list).toEqual(["item1", "item2"]);
    expect(parsed.nested.date).toBe("2025-10-28T00:00:00.000Z");
    expect(parsed.nested.value).toBe("test");

    // Clean up
    fs.unlinkSync(mixedFile);
  });

  it("should not parse invalid date formats", async () => {
    const invalidContent = `---
notADate: "not-a-date"
almostDate: 2025-10
version: 2025-1-1-beta
time: 10:30:00
year: 2025
invalidDay: 2025-2-31
tooManyDays: 2025-4-31
public: true
---

# Invalid Date Test

Testing that invalid dates remain as strings.`;

    const invalidFile = path.join(testDir, "invalid-dates.md");
    fs.writeFileSync(invalidFile, invalidContent);

    const result = await processFolder(testDir, {
      processAllFiles: true,
      debug: 0
    });

    const invalidPost = result.find(p => p.fileName === "invalid-dates");
    expect(invalidPost).toBeDefined();

    // Serialize and parse back
    const jsonString = JSON.stringify(invalidPost!.frontmatter);
    const parsed = JSON.parse(jsonString);

    // These should remain as strings, not be parsed as dates (our parser validates correctly)
    expect(parsed.notADate).toBe("not-a-date");
    expect(parsed.almostDate).toBe("2025-10"); // Missing day
    expect(parsed.version).toBe("2025-1-1-beta"); // Extra text
    expect(parsed.time).toBe(37800); // YAML parses time as seconds (10:30:00 = 37800 seconds)
    expect(parsed.year).toBe(2025); // Number
    expect(parsed.invalidDay).toBe("2025-2-31"); // Feb 31 doesn't exist (not parsed by our function)
    expect(parsed.tooManyDays).toBe("2025-4-31"); // April 31 doesn't exist (not parsed by our function)

    // Clean up
    fs.unlinkSync(invalidFile);
  });
});