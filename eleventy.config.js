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

  // Collections
  eleventyConfig.addCollection("hazards", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/hazards/*.md");
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
