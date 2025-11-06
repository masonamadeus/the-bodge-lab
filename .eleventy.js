module.exports = function(eleventyConfig) {

  // This is the key for your "Download Page" button.
  // It copies all source .md files to the output,
  // preserving their folder structure.
  eleventyConfig.addPassthroughCopy("content/**/*.md");
  
  // This recursively finds all .md files to create your "directory"
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("./**/*.md")
      .filter(item => {
        // Exclude the main home and categories pages from the "posts" list
        return item.inputPath !== "./index.md" && 
               item.inputPath !== "./categories.md";
      });
  });

  return {
    dir: {
      // Tell 11ty to build from the "content" folder
      input: "content",
      
      // Tell 11ty to look *up one level* for the includes folder
      includes: "../_includes",
      
      // Output directory remains the same
      output: "_site"
    }
  };
};