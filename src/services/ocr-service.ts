/**
 * OCR Service using Tesseract.js
 */

import Tesseract from 'tesseract.js';
import { logger } from '../utils/logger.js';

/**
 * OCR Service class
 */
export class OCRService {
  /**
   * Extract text from image using OCR
   */
  public async extractText(imageBase64: string): Promise<string> {
    try {
      logger.debug('Starting OCR text extraction');

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      // Perform OCR
      const result = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: (info) => {
          if (info.status === 'recognizing text') {
            logger.debug(`OCR progress: ${Math.round(info.progress * 100)}%`);
          }
        },
      });

      const extractedText = result.data.text.trim();

      logger.debug('OCR text extraction completed', {
        textLength: extractedText.length,
        confidence: result.data.confidence,
      });

      return extractedText;
    } catch (error) {
      logger.error('OCR extraction failed', {
        error: (error as Error).message,
      });
      throw new Error(`OCR failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract text from multiple images
   */
  public async extractTextFromMultiple(imageBase64List: string[]): Promise<string[]> {
    logger.info(`Extracting text from ${imageBase64List.length} images`);

    const results = await Promise.all(
      imageBase64List.map(async (imageBase64, index) => {
        try {
          return await this.extractText(imageBase64);
        } catch (error) {
          logger.warn(`Failed to extract text from image ${index}`, {
            error: (error as Error).message,
          });
          return ''; // Return empty string on failure
        }
      })
    );

    return results;
  }

}
