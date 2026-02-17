const fs = require('fs');
const filePath = 'dist/adapters/WebChatAdapter.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the problematic line
const oldLine = '        if (data.content.length > config.maxMessageLength) {';
const newLine = '        if (!data.content || data.content.length > config.maxMessageLength) {';

if (content.includes(oldLine)) {
    content = content.replace(oldLine, newLine);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(' Fixed WebChatAdapter.js successfully!');
} else {
    console.log(' Could not find the line to fix');
}
