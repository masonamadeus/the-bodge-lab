module.exports = function(eleventyConfig) {
  // Tell 11ty to process our content files
  // We'll put our content in a folder named "posts"
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("posts/*.md");
  });

  // Set the input/output directories
  return {
    dir: {
      input: ".",
      output: "_site", // GitHub Pages deploys from here
      includes: "_includes" // This is where our layout lives
    }
  };
};