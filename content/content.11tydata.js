// This is a built-in Node.js module for running shell commands
const { execSync } = require("child_process");

// A helper function to get the last Git commit date for a file
function getGitLastModified(inputPath) {
  try {
    // This command gets the date of the last commit for this specific file
    const cmd = `git log -1 --format=%cI "${inputPath}"`;
    const date = execSync(cmd).toString().trim();
    
    // If we get a valid date, return it as a Date object
    if (date) {
      return new Date(date);
    }
  } catch (e) {
    // If it's a new file not in Git yet, or any other error
    // (This will also run on your 'Next/Previous' links, which is fine)
  }
  
  // Fallback to the current time
  return new Date();
}

module.exports = {
  // eleventyComputed lets us dynamically set data
  eleventyComputed: {
    
    // This is the magic line
    date: data => {
      // Use the 'date' from front matter IF it exists...
      // ...otherwise, get the Git last modified date.
      return data.date || getGitLastModified(data.page.inputPath);
    }
  }
};