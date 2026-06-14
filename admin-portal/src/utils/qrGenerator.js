/**
 * XLAND INFRA QR Code Generator Utility
 * High-quality QR code generation with SVG/PNG support
 */

// QR Code generation using QR Server API (fallback)
// For production, consider using local library like 'qrcode' npm package
const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

// Detect iOS devices (iPhone, iPad, iPod)
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Generate QR code URL
 * @param {string} data - Data to encode
 * @param {Object} options - Generation options
 * @returns {string} QR code image URL
 */
export const generateQRUrl = (data, options = {}) => {
  const {
    size = 400,
    format = 'svg',
    errorCorrection = 'H',
    margin = 4,
    foreground = '000000',
    background = 'FFFFFF'
  } = options;

  const params = new URLSearchParams({
    data: data,
    size: `${size}x${size}`,
    format: format,
    ecc: errorCorrection,
    margin: margin,
    color: foreground.replace('#', ''),
    bgcolor: background.replace('#', '')
  });

  return `${QR_API_BASE}?${params.toString()}`;
};

/**
 * Generate SVG QR code locally (Reed-Solomon error correction)
 * This is a simplified implementation - for production, use 'qrcode' library
 * @param {string} data - Data to encode
 * @param {Object} options - Generation options
 * @returns {string} SVG string
 */
export const generateQRSVG = (data, options = {}) => {
  const {
    size = 400,
    margin = 4,
    foreground = '#1a1a1a',
    background = '#FFFFFF',
    errorCorrection = 'H',
    style = 'square' // square, rounded, dots
  } = options;

  // For this implementation, we'll use the API but generate downloadable SVG
  // In production, use 'qrcode' npm package for offline generation
  const qrUrl = generateQRUrl(data, { ...options, format: 'svg' });
  
  return {
    url: qrUrl,
    download: async () => {
      try {
        const response = await fetch(qrUrl);
        const svgText = await response.text();
        return svgText;
      } catch (error) {
        console.error('Error generating QR SVG:', error);
        return null;
      }
    }
  };
};

/**
 * Download QR code as file
 * @param {string} data - Data to encode
 * @param {string} filename - Download filename
 * @param {string} format - File format (svg, png, pdf)
 * @param {Object} options - Generation options
 */
export const downloadQR = async (data, filename, format = 'png', options = {}) => {
  const {
    size = 1000, // High resolution for print
    errorCorrection = 'H',
    foreground = '1a1a1a',
    background = 'FFFFFF'
  } = options;

  const qrUrl = generateQRUrl(data, {
    size,
    format: format === 'pdf' ? 'png' : format,
    errorCorrection,
    foreground,
    background
  });

  try {
    const response = await fetch(qrUrl);
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    
    if (isIOS()) {
      // iOS Safari doesn't support download attribute
      // Open in new tab where user can long-press to save
      const newWindow = window.open(url, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Fallback for popup blockers
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      // Clean up after delay
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } else {
      // Standard download for desktop and Android
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
    
    return true;
  } catch (error) {
    console.error('Error downloading QR code:', error);
    return false;
  }
};

/**
 * Generate print-ready QR code with branding
 * @param {string} data - Data to encode
 * @param {Object} branding - Branding options
 * @returns {Promise<string>} Data URL of branded QR
 */
export const generateBrandedQR = async (data, branding = {}) => {
  const {
    size = 800,
    logoUrl = null,
    logoSize = 0.25, // 25% of QR size
    label = '',
    labelColor = '#1a1a1a',
    foreground = '#1a1a1a',
    background = '#FFFFFF',
    borderColor = '#d4af37', // XLAND gold
    borderWidth = 8
  } = branding;

  // Generate base QR
  const qrUrl = generateQRUrl(data, {
    size,
    format: 'png',
    errorCorrection: 'H',
    foreground: foreground.replace('#', ''),
    background: background.replace('#', '')
  });

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const totalSize = size + (borderWidth * 2) + (label ? 60 : 0);
    
    canvas.width = totalSize;
    canvas.height = totalSize;

    // Draw background
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Draw border
    if (borderWidth > 0) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(borderWidth / 2, borderWidth / 2, totalSize - borderWidth, size + borderWidth);
    }

    // Load and draw QR code
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      ctx.drawImage(qrImg, borderWidth, borderWidth, size, size);

      // Draw logo if provided
      if (logoUrl) {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.onload = () => {
          const logoActualSize = size * logoSize;
          const logoX = borderWidth + (size - logoActualSize) / 2;
          const logoY = borderWidth + (size - logoActualSize) / 2;
          
          // Draw white background behind logo
          ctx.fillStyle = background;
          ctx.fillRect(logoX - 5, logoY - 5, logoActualSize + 10, logoActualSize + 10);
          
          ctx.drawImage(logoImg, logoX, logoY, logoActualSize, logoActualSize);
          
          // Draw label
          if (label) {
            ctx.fillStyle = labelColor;
            ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, totalSize / 2, size + borderWidth + 40);
          }
          
          resolve(canvas.toDataURL('image/png'));
        };
        logoImg.onerror = () => {
          // Continue without logo
          if (label) {
            ctx.fillStyle = labelColor;
            ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, totalSize / 2, size + borderWidth + 40);
          }
          resolve(canvas.toDataURL('image/png'));
        };
        logoImg.src = logoUrl;
      } else {
        // Draw label
        if (label) {
          ctx.fillStyle = labelColor;
          ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, totalSize / 2, size + borderWidth + 40);
        }
        resolve(canvas.toDataURL('image/png'));
      }
    };
    qrImg.onerror = (e) => reject(e);
    qrImg.src = qrUrl;
  });
};

/**
 * Generate QR code for XLAND INFRA with luxury styling
 * @param {string} slug - QR slug (main, admin, etc.)
 * @param {string} baseUrl - Base redirect URL
 * @param {Object} options - Additional options
 * @returns {Object} QR generation utilities
 */
export const createXLANDQR = (slug, baseUrl = 'https://qr.xlandinfra.com', options = {}) => {
  const qrUrl = `${baseUrl}/${slug}`;
  
  return {
    url: qrUrl,
    
    // Get preview URL
    getPreviewUrl: (size = 200) => generateQRUrl(qrUrl, { size, format: 'png', ...options }),
    
    // Download as PNG
    downloadPNG: (filename = `xland-qr-${slug}`) => downloadQR(qrUrl, filename, 'png', { size: 1000, ...options }),
    
    // Download as SVG
    downloadSVG: (filename = `xland-qr-${slug}`) => downloadQR(qrUrl, filename, 'svg', { size: 1000, ...options }),
    
    // Get branded version with XLAND styling
    getBranded: (label = 'XLAND INFRA') => generateBrandedQR(qrUrl, {
      label,
      borderColor: '#d4af37', // XLAND gold
      foreground: '#1a1a1a',
      background: '#FFFFFF',
      ...options
    }),
    
    // Copy URL to clipboard
    copyUrl: async () => {
      try {
        await navigator.clipboard.writeText(qrUrl);
        return true;
      } catch {
        return false;
      }
    }
  };
};

export default {
  generateQRUrl,
  generateQRSVG,
  downloadQR,
  generateBrandedQR,
  createXLANDQR
};
