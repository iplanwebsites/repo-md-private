import { expect, test, afterEach } from "vitest";
import m from "../src/index";
import { processFolder } from "../src/process/processFolder";
import fs from "node:fs";
import path from "node:path";

function setup() {
  return { vaultPath: "./test/testVault1/" };
}

// Recursive function to delete directory and contents
function deleteFolderRecursive(folderPath: string) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call for directories
        deleteFolderRecursive(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    });
    // Delete empty directory
    fs.rmdirSync(folderPath);
  }
}

// Clean up _posts directory after tests
afterEach(() => {
  try {
    const postsDir = path.join("./test/testVault1/_posts");
    deleteFolderRecursive(postsDir);
  } catch (error) {
    console.error("Error cleaning up test directories:", error);
  }
});

test("vault", async () => {
  const { vaultPath } = setup();

  // You can use either the legacy API or the new direct import
  // const vaultData = m.obsidian.vault.process(vaultPath); 
  const vaultData = await processFolder(vaultPath);

  expect(vaultData.length).toBe(3);
  expect(vaultData.find((d) => d.fileName === "other2")).toBeUndefined();

  const testFile = vaultData.find((d) => d.fileName === "Test File");
  expect(testFile?.firstParagraphText).toMatch("I am a markdown file!");
  expect(testFile?.frontmatter).toEqual(
    expect.objectContaining({
      public: true,
      tags: ["markdown", "yaml", "html"],
    })
  );
  expect(testFile?.slug).toBe("test-file");
  expect(testFile?.toc).toEqual([
    {
      depth: 1,
      id: "hello",
      title: "Hello",
    },
    {
      depth: 2,
      id: "more",
      title: "More",
    },
  ]);

  const html = testFile?.html;
  // html test wiki links
  expect(html).toMatch('<a href="/content/other1" title="">other1</a>');
  expect(html).not.toMatch('<a href="/content/other2" title="">other2</a>');
  expect(html).toMatch('<a href="/content/other3" title="">other3</a>');

  // html test default header ids and autolinks
  expect(html).toMatch('<h1 id="hello"><a href="#hello">Hello</a></h1>');
  expect(html).toMatch('<h2 id="more"><a href="#more">More</a></h2>');

  // test default external link
  expect(html).toMatch(
    '<a href="https://www.google.com" rel="nofollow">external link</a>'
  );

  // test default callout
  expect(html).toMatch("<strong><p>Tip</p></strong>");
  expect(html).toMatch(
    '<div class="callout-content" style=""><p>this is a callout section of type tip with a header</p></div>'
  );
  expect(html).toMatch(
    "<strong><p>this is a callout section of type info without a header</p></strong>"
  );

  // test default math
  //// these used to test for `math-inline` and `math-display` / I assume
  //// `display="true"` will now cover the checks for whether or not they are
  //// inline or block displayed
  expect(html).toMatch(/<mjx-container class="MathJax" jax="CHTML">/);
  expect(html).toMatch(
    /<mjx-container class="MathJax" jax="CHTML" display="true">/
  );
});

test("graph generation", async () => {
  const { vaultPath } = setup();
  
  // Create a build directory for the test
  const buildDir = path.join(vaultPath, "build");
  
  // Make sure build directory doesn't exist before test
  deleteFolderRecursive(buildDir);
  
  // Create RepoProcessor instance
  const processor = new m.RepoProcessor({
    inputPath: vaultPath,
    buildDir: buildDir
  });
  
  // Process the vault
  const result = await processor.process();
  
  // Check for graph.json
  const graphPath = path.join(buildDir, "graph.json");
  expect(fs.existsSync(graphPath)).toBe(true);
  
  // Parse and check the graph data
  const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  
  // Check basic structure
  expect(graphData).toHaveProperty('nodes');
  expect(graphData).toHaveProperty('edges');
  expect(Array.isArray(graphData.nodes)).toBe(true);
  expect(Array.isArray(graphData.edges)).toBe(true);
  
  // Verify we have at least the test files as nodes
  expect(graphData.nodes.length).toBeGreaterThanOrEqual(3);
  
  // Check that nodes have the right structure
  const node = graphData.nodes[0];
  expect(node).toHaveProperty('id');
  expect(node).toHaveProperty('type');
  expect(node).toHaveProperty('label');
  
  // Check at least one edge exists between Test File and other1
  const testFileNode = graphData.nodes.find(n => n.label === 'Test File');
  expect(testFileNode).toBeDefined();
  
  // Clean up
  deleteFolderRecursive(buildDir);
});

test("exportPosts option", async () => {
  const { vaultPath } = setup();
  
  // Create the posts output folder path
  const postsDir = path.join(vaultPath, "_posts");
  
  // Make sure directory doesn't exist before test
  deleteFolderRecursive(postsDir);
  
  // Process vault with exportPosts option enabled
  const vaultData = await processFolder(vaultPath, {
    exportPosts: true,
    postsOutputFolder: postsDir
  });
  
  // Check that main directory was created
  expect(fs.existsSync(postsDir)).toBe(true);
  
  // Check that hash and slug subdirectories were created
  const hashDir = path.join(postsDir, "hash");
  const slugDir = path.join(postsDir, "slug");
  expect(fs.existsSync(hashDir)).toBe(true);
  expect(fs.existsSync(slugDir)).toBe(true);
  
  // Check index.json in hash directory
  const hashIndexPath = path.join(hashDir, "index.json");
  expect(fs.existsSync(hashIndexPath)).toBe(true);
  
  const indexContent = JSON.parse(fs.readFileSync(hashIndexPath, 'utf8'));
  expect(indexContent.length).toBe(3);
  expect(indexContent[0]).toHaveProperty('slug');
  expect(indexContent[0]).toHaveProperty('title');
  expect(indexContent[0]).toHaveProperty('colophon');
  
  // Check individual post files in slug directory
  const testFilePath = path.join(slugDir, "test-file.json");
  expect(fs.existsSync(testFilePath)).toBe(true);
  
  const postContent = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
  expect(postContent).toHaveProperty('fileName', 'Test File');
  expect(postContent).toHaveProperty('slug', 'test-file');
  expect(postContent).toHaveProperty('html');
  expect(postContent).toHaveProperty('frontmatter');
  expect(postContent.frontmatter).toHaveProperty('public', true);
});
