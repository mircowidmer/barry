module.exports = ({ config }) =>
  process.env.BARRY_WEB_BASE_URL
    ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.BARRY_WEB_BASE_URL } }
    : config;
