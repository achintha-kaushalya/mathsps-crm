module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/login'],
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 60000,
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless --disable-gpu'
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%.report.%%EXTENSION%%'
    }
  }
}
