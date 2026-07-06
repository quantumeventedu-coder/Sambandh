module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testTimeout: 60000 // first run may download the in-memory MongoDB binary
};
