const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text content from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}


/**
 * Extract text from a DOCX file
 * @param {string} filePath - Path to the DOCX file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromDocx(filePath) {
  const data = await fs.promises.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer: data });
  return result.value;
}


/**
 * Extract text from a plain TXT file
 * @param {string} filePath - Path to the TXT file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromTxt(filePath) {
  const data = await fs.promises.readFile(filePath, 'utf8');
  return data;
}

module.exports = {extractTextFromTxt,extractTextFromDocx,extractTextFromPDF};
