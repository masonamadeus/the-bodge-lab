// The list of extensions Eleventy will process as templates
const TEMPLATE_EXTENSIONS = [
    '.md', 
    '.njk', 
    '.html',
];

// Define our media categories
const IMAGE_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
];

const VIDEO_EXTENSIONS = [
    '.mp4', '.webm', '.ogg', '.m4a'
];

const AUDIO_EXTENSIONS = [
    '.mp3', '.wav', 
    '.flac', '.opus' 
];

// Combine all media types into one list for easy checking
const MEDIA_EXTENSIONS = [
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS
];

// Export all our definitions
module.exports = {
    TEMPLATE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS,
    MEDIA_EXTENSIONS
};