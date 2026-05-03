const { PDFDocument, rgb } = require('pdf-lib');
const sharp = require('sharp');

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 28;

async function normalizeImageForPdf(imageBuffer) {
  return sharp(imageBuffer, { failOn: 'error' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

async function createImagesPdf(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('No images were provided for PDF generation.');
  }

  const pdfDoc = await PDFDocument.create();

  for (const image of images) {
    const normalizedBuffer = await normalizeImageForPdf(image.buffer);
    const embeddedImage = await pdfDoc.embedJpg(normalizedBuffer);
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      color: rgb(1, 1, 1)
    });

    const maxWidth = A4_WIDTH - PAGE_MARGIN * 2;
    const maxHeight = A4_HEIGHT - PAGE_MARGIN * 2;
    const imageScale = Math.min(maxWidth / embeddedImage.width, maxHeight / embeddedImage.height);
    const drawWidth = embeddedImage.width * imageScale;
    const drawHeight = embeddedImage.height * imageScale;

    page.drawImage(embeddedImage, {
      x: (A4_WIDTH - drawWidth) / 2,
      y: (A4_HEIGHT - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    });
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return Buffer.from(pdfBytes);
}

function createPdfFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');

  return `images-to-pdf-${stamp}.pdf`;
}

module.exports = {
  createImagesPdf,
  createPdfFileName
};
