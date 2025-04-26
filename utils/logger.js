// utils/logger.js
const logInfo = (msg) => console.log(`✅ [INFO] ${msg}`);
const logWarn = (msg) => console.warn(`⚠️ [WARN] ${msg}`);
const logError = (msg, error) => {
  console.error(`❌ [ERROR] ${msg}`);
  if (error) console.error(error);
};

module.exports = { logInfo, logWarn, logError };