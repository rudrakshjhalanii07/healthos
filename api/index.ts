/// <reference types="node" />
// Vercel serverless entry: serves the Expo Router API routes from the `expo export` server build.
// Pages and assets are served statically from dist/client; anything else (the API) is rewritten here.
const path = require('node:path');
const { createRequestHandler } = require('expo-server/adapter/vercel');

module.exports = createRequestHandler({ build: path.join(__dirname, '../dist/server') });
