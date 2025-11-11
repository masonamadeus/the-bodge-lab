// _11ty/fileTypes.js

// The list of extensions Eleventy will process as templates
const TEMPLATE_EXTENSIONS = [
    '.md', 
    '.njk', 
    '.html',
];

// Define our media categories
const IMAGE_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp','.svg', '.bmp', '.tiff', '.ico',
];

const VIDEO_EXTENSIONS = [
    '.mp4', '.webm', '.ogg', '.m4a', '.mov', '.avi', '.wmv', '.flv', '.mkv','.swf','.fla',
];

const AUDIO_EXTENSIONS = [
    '.mp3', '.wav', 
    '.flac', '.opus' 
];

const DATA_EXTENSIONS = [
    '.json', '.csv', '.yaml', '.yml', '.xml',
    '.zip', '.rar', '.7z', '.tar', '.gz','.js', '.css',
    '.exe', '.dmg', '.azw',
];

const DOCUMENT_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.rtf', 
];

const MISC_EXTENSIONS = [ 
    '.epub', '.mobi',
];

// Combine all non-template types into one list
const PASSTHROUGH_EXTENSIONS = [
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...DATA_EXTENSIONS,
    ...DOCUMENT_EXTENSIONS,
    ...MISC_EXTENSIONS
];

// Export all our definitions
module.exports = {
    TEMPLATE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS,
    DATA_EXTENSIONS,
    DOCUMENT_EXTENSIONS,
    MISC_EXTENSIONS,
    PASSTHROUGH_EXTENSIONS
};