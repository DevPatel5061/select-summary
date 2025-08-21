# Select Summary - AI Text Summarizer

Select Summary is a browser extension that allows users to summarize text of any length from any website using Google Gemini to get the core and important information out of the text. 

## Features
- **Text Summarization**: Summary any text with Google Gemini 2.5 Flash-Lite and get a fast and accurate summary.
- **History**: Check previous summarized text with timestamps.
- **API Key Management**: Manage and change your API key.
- **Clean & Responsive UI/UX**: Easy to view and use pop-up and summary card.
- **Secure**: Stores API key in `chrome.storage.local`.

## How to Use
1. **Download or Clone** this extension folder to your computer.
2. **Open Chrome** and go to `chrome://extensions/`.
3. **Enable Developer Mode** (toggle in the top right).
4. **Click "Load unpacked"** and select the `chrome-extension` folder.
5. **Click** on the extension in the extension bar or **Press** `Alt + G` or for MacOS `Option + G` and follow the instructions.
7. **Navigate** to any of the article or website with text (e.g., `News Articles`, `Reddit Posts`).
8. **Highlight** any piece of text.
9. **Right click** `Summarize with Google Gemini`.
10. **View** the summary in the bottom right.

## Preview
![Select_Summary_GIF](https://github.com/user-attachments/assets/d2097ced-b680-4b07-a014-192808543494)

## Changelog
- **Updated AI**: Gemini 2.0 Flash → Gemini 2.5 Flash-Lite.
  (Gemini 2.5 Flash-Lite provides quicker and more accurate responses and allows for 1000 requests/day compared to the 200 requests)
- **Shortcuts**: To open the popup and to summarize.
  (Alt + G or Option + G to open popup) and (Ctrl + Z or Command + Z to summarize)
- **UI/UX Changes**: Tweaked the UI/UX of the popup and summary card for an enhanced user experience.
- **Bug Fixes**: Fixed a closing button issue, tweaked Gemini's instruction for better summaries and more.

## Important Information
- **Never share your API key**
- **Your API key will give you 1000 requests per day** *(`Ensure within a minute less than 15 requests are made`)*
