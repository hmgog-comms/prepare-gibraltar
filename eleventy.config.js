import markdownIt from "markdown-it";
const md = markdownIt({ html: true, linkify: false, typographer: true });

// Indented code blocks are switched off everywhere. Page content now lives in YAML
// block scalars that the CMS rewrites on save, and if Decap ever re-indents one by
// four spaces, markdown-it would silently render the whole paragraph inside
// <pre><code> — a total loss of formatting on a live page that looks like nothing
// but a whitespace change in the diff. Nothing on an emergency preparedness site
// has any reason to render code. Fenced blocks use a separate rule and still work.
md.disable("code");

export default function(eleventyConfig) {
  // The same guard for Eleventy's own markdown instance, which renders the .md
  // bodies of the three policy pages.
  eleventyConfig.amendLibrary("md", (mdLib) => mdLib.disable("code"));

  // Passthrough copy
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("src/_redirects");
  eleventyConfig.addPassthroughCopy("src/_headers");

  // The Decap CMS bundle is copied from the installed package rather than committed,
  // so the version is governed by package.json and visible to npm audit / Dependabot.
  eleventyConfig.addPassthroughCopy({
    "node_modules/decap-cms/dist/decap-cms.js": "admin/decap-cms.js"
  });

  // The standalone download documents are passthrough-copied verbatim;
  // without this they'd also be processed as page templates.
  eleventyConfig.ignores.add("src/assets/**/*.html");

  // Markdown filter for rendering frontmatter markdown fields
  eleventyConfig.addFilter("markdownify", function(content) {
    if (!content) return "";
    return md.render(content);
  });

  // The same, without the wrapping <p>. Table cells and other inline positions
  // need the markdown (links, bold) but not a block element around it.
  eleventyConfig.addFilter("markdownifyInline", function(content) {
    if (!content) return "";
    return md.renderInline(content);
  });

  // Collections
  eleventyConfig.addCollection("hazards", function(collectionApi) {
    // The index page is src/hazards/index.md, which this glob also matches.
    // Filter by layout so it does not appear as a nineteenth hazard card inside
    // its own grid — and so "a hazard" has a definition, rather than being
    // whatever happens to sit in the folder.
    //
    // Sorted by title, explicitly. No hazard file sets `date`, so Eleventy's
    // default sort falls back to each file's modification time — which means the
    // grid order depends on the filesystem. It only looks stable in production
    // because a CI checkout gives every file the same timestamp and Eleventy then
    // falls back to filename. Build locally after editing one page and the cards
    // reshuffle. Sorting by title makes the order the same everywhere, and it is
    // the order the cards are actually read in.
    return collectionApi
      .getFilteredByGlob("src/hazards/*.md")
      .filter((item) => item.data.layout === "layouts/hazard.njk")
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    }
  };
}
