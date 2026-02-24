// Symbol used to replace spaces (can be changed if needed)
const SPACE_REPLACEMENT_SYMBOL = '_';

/**
 * Sanitizes email addresses
 * - Preserves @ and . (required for emails)
 * - Removes dangerous control characters
 * - Trims whitespace
 */
function sanitizeEmail(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // Trim whitespace and convert to lowercase (emails are case-insensitive)
    let sanitized = input.trim().toLowerCase();
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove control characters (keep only printable characters)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
}

/**
 * Sanitizes passwords
 * - Preserves ALL special characters (they're required for password validation)
 * - Only removes truly dangerous control characters
 * - Trims whitespace (optional - you might want to keep leading/trailing spaces in passwords)
 */
function sanitizePassword(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // Trim whitespace
    let sanitized = input.trim();
    
    // Remove null bytes (very dangerous)
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove only the most dangerous control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
}

/**
 * Sanitizes general text (names, descriptions, etc.)
 * - Replaces all spaces with replacement symbol (for storage/processing)
 * - Removes dangerous characters
 * - Trims whitespace
 * - Use restoreSpaces() when displaying to convert back to spaces
 */
function sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // Trim whitespace
    let sanitized = input.trim();
    
    // Replace all spaces with replacement symbol
    sanitized = sanitized.replace(/\s+/g, SPACE_REPLACEMENT_SYMBOL);
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
}

/**
 * Sanitizes numeric input (converts to number, validates)
 * Returns the number if valid, or NaN if invalid
 */
function sanitizeNumber(input: string | number): number {
    if (typeof input === 'number') {
        return isNaN(input) ? NaN : input;
    }
    
    if (!input || typeof input !== 'string') {
        return NaN;
    }
    
    // Trim and remove any non-numeric characters except decimal point and minus
    const cleaned = input.trim().replace(/[^0-9.-]/g, '');
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? NaN : num;
}

/**
 * Converts the space replacement symbol back to spaces
 * Use this when displaying data to users
 */
function restoreSpaces(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }
    return input.replace(new RegExp(SPACE_REPLACEMENT_SYMBOL, 'g'), ' ');
}

// Export all sanitization functions and restore function
export { sanitizeEmail, sanitizePassword, sanitizeText, sanitizeNumber, restoreSpaces };
