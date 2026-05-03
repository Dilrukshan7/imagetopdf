let latestQrDataUrl = '';
let latestQrCreatedAt = 0;

function setLatestQr(dataUrl) {
  latestQrDataUrl = dataUrl;
  latestQrCreatedAt = Date.now();
}

function clearLatestQr() {
  latestQrDataUrl = '';
  latestQrCreatedAt = 0;
}

function getLatestQr() {
  return {
    dataUrl: latestQrDataUrl,
    createdAt: latestQrCreatedAt
  };
}

module.exports = {
  setLatestQr,
  clearLatestQr,
  getLatestQr
};
